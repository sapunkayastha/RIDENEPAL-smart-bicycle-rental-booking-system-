import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Send, Loader2, LifeBuoy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listMySupportMessages, sendMySupportMessage } from "@/lib/support-chat.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/chat")({
  component: SupportChat,
  head: () => ({ meta: [{ title: "Support Chat — RIDENEPAL" }] }),
});

function SupportChat() {
  const navigate = useNavigate();
  const fetchMessages = useServerFn(listMySupportMessages);
  const send = useServerFn(sendMySupportMessage);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) navigate({ to: "/auth" });
    })();
  }, [navigate]);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["support-messages"],
    queryFn: () => fetchMessages(),
    refetchInterval: 15_000,
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) => send({ data: { body } }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["support-messages"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not send message"),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="min-h-screen bg-secondary/30 flex flex-col">
      <SiteHeader />
      <main className="max-w-2xl w-full mx-auto flex flex-col flex-1 px-4 py-6">
        <div className="flex items-center gap-3 pb-4 border-b mb-4">
          <div className="size-10 rounded-full bg-primary/15 text-primary flex items-center justify-center">
            <LifeBuoy className="size-5" />
          </div>
          <div>
            <div className="font-semibold">RIDENEPAL Support</div>
            <div className="text-xs text-muted-foreground">
              Real staff reply here — usually within a few hours
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pb-4">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-10">
              <Loader2 className="size-5 animate-spin mx-auto mb-2" /> Loading…
            </div>
          ) : (messages ?? []).length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              Send a message below and our team will get back to you here.
            </p>
          ) : (
            (messages ?? []).map((m) => (
              <div key={m.id} className={`flex ${m.is_staff ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${m.is_staff ? "bg-white border" : "bg-primary text-primary-foreground"}`}
                >
                  {m.body}
                  <div
                    className={`text-[10px] mt-1 ${m.is_staff ? "text-muted-foreground" : "text-primary-foreground/70"}`}
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

        <div className="flex gap-2 pt-3 border-t">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim()) sendMutation.mutate(text.trim());
            }}
            placeholder="Type a message…"
            className="flex-1 border rounded-full px-4 py-2 text-sm bg-background"
          />
          <button
            onClick={() => text.trim() && sendMutation.mutate(text.trim())}
            disabled={sendMutation.isPending || !text.trim()}
            className="size-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </div>
      </main>
    </div>
  );
}
