import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Send, Loader2, LifeBuoy } from "lucide-react";
import {
  listSupportConversations,
  getSupportConversationMessages,
  sendStaffReply,
} from "@/lib/support-chat.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/messages")({
  component: AdminMessages,
  head: () => ({ meta: [{ title: "Support Inbox — RIDENEPAL Admin" }] }),
});

function AdminMessages() {
  const fetchConvos = useServerFn(listSupportConversations);
  const fetchMessages = useServerFn(getSupportConversationMessages);
  const reply = useServerFn(sendStaffReply);
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading: loadingConvos } = useQuery({
    queryKey: ["admin-support-conversations"],
    queryFn: () => fetchConvos(),
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!activeId && conversations && conversations.length > 0) setActiveId(conversations[0].id);
  }, [conversations, activeId]);

  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ["admin-support-messages", activeId],
    queryFn: () => fetchMessages({ data: { conversation_id: activeId! } }),
    enabled: Boolean(activeId),
    refetchInterval: 10_000,
  });

  const replyMutation = useMutation({
    mutationFn: (body: string) => reply({ data: { conversation_id: activeId!, body } }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["admin-support-messages", activeId] });
      qc.invalidateQueries({ queryKey: ["admin-support-conversations"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not send reply"),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="min-h-screen bg-secondary/20">
      <SiteHeader />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center gap-2 mb-6">
          <LifeBuoy className="size-5 text-primary" />
          <h1 className="text-2xl font-bold">Support Inbox</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-5 h-[70vh]">
          <Card className="border-0 shadow-sm overflow-y-auto">
            {loadingConvos ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                <Loader2 className="size-4 animate-spin mx-auto mb-2" /> Loading…
              </div>
            ) : (conversations ?? []).length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No conversations yet.</p>
            ) : (
              <ul className="divide-y">
                {(conversations ?? []).map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => setActiveId(c.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-secondary/50 ${activeId === c.id ? "bg-primary/5" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{c.customer_name}</span>
                        {c.unread_count > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {c.last_message ?? "No messages yet"}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="border-0 shadow-sm flex flex-col overflow-hidden">
            {!activeId ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Select a conversation
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {loadingMessages ? (
                    <div className="text-center text-muted-foreground py-10">
                      <Loader2 className="size-5 animate-spin mx-auto" />
                    </div>
                  ) : (messages ?? []).length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-10">
                      No messages yet.
                    </p>
                  ) : (
                    (messages ?? []).map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${m.is_staff ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${m.is_staff ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
                        >
                          {m.body}
                          <div
                            className={`text-[10px] mt-1 ${m.is_staff ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                          >
                            {new Date(m.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={bottomRef} />
                </div>
                <div className="flex gap-2 p-4 border-t">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && text.trim()) replyMutation.mutate(text.trim());
                    }}
                    placeholder="Reply as RIDENEPAL Support…"
                    className="flex-1 border rounded-full px-4 py-2 text-sm bg-background"
                  />
                  <button
                    onClick={() => text.trim() && replyMutation.mutate(text.trim())}
                    disabled={replyMutation.isPending || !text.trim()}
                    className="size-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50"
                  >
                    <Send className="size-4" />
                  </button>
                </div>
              </>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
