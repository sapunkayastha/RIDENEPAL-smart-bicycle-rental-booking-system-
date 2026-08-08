import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "ridenepal_ai_chat_v1";

function loadMessages(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as UIMessage[];
  } catch {
    return [];
  }
}

export function AiChatBubble() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [initial] = useState<UIMessage[]>(() => loadMessages());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, setMessages } = useChat({
    messages: initial,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* ignore */
    }
  }, [messages]);

  // Autoscroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  // Focus on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input.trim() });
    setInput("");
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <>
      {/* Floating bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 size-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 hover:shadow-xl transition-all flex items-center justify-center group"
          aria-label="Open AI chat"
        >
          <MessageCircle className="size-6 group-hover:scale-110 transition-transform" />
          <span className="absolute -top-1 -right-1 size-4 rounded-full bg-green-500 border-2 border-background" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100vh-2rem))] bg-background rounded-2xl shadow-2xl border flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <Sparkles className="size-4" />
              </div>
              <div>
                <div className="font-semibold text-sm leading-tight">RIDENEPAL Assistant</div>
                <div className="text-[10px] opacity-80">AI-powered • Always online</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="text-[10px] px-2 py-1 rounded hover:bg-primary-foreground/10"
                  title="Clear conversation"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="size-8 rounded-md hover:bg-primary-foreground/10 flex items-center justify-center"
                aria-label="Close chat"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-secondary/20">
            {messages.length === 0 && (
              <div className="text-center py-8 px-4">
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="size-6 text-primary" />
                </div>
                <p className="text-sm font-medium">Hi! I'm your RIDENEPAL assistant 🚴</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ask me about bikes, bookings, payments, or trails.
                </p>
                <div className="grid gap-2 mt-4 text-xs">
                  {[
                    "What bikes do you have?",
                    "How do I book a bike?",
                    "Best trails near Pokhara?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage({ text: q })}
                      className="text-left px-3 py-2 rounded-lg border bg-background hover:bg-primary/5 hover:border-primary transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => {
              const text = m.parts
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("");
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex",
                    m.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-background border rounded-bl-sm",
                    )}
                  >
                    {text || (
                      <span className="text-muted-foreground italic">…</span>
                    )}
                  </div>
                </div>
              );
            })}

            {status === "submitted" && (
              <div className="flex justify-start">
                <div className="bg-background border rounded-2xl rounded-bl-sm px-3 py-2 text-sm flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Thinking…
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <form onSubmit={handleSubmit} className="border-t p-2 flex gap-2 bg-background">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Ask anything…"
              rows={1}
              className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 max-h-24"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="bg-primary hover:bg-primary/90 shrink-0"
            >
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
