import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Send, Phone, MoreVertical } from "lucide-react";

export const Route = createFileRoute("/chat")({
  component: Chat,
  head: () => ({ meta: [{ title: "Chat — RIDENEPAL" }] }),
});

const contacts = [
  { name: "RIDENEPAL Support", last: "Your booking is confirmed!", time: "2m", unread: 2, active: true },
  { name: "Aarav Giri", last: "See you at Phewa Pass 🚴", time: "1h", unread: 0 },
  { name: "Trail Guide — Maya", last: "Weather looks clear tomorrow.", time: "3h", unread: 1 },
  { name: "Sneha Shrestha", last: "Loved the new e-bike!", time: "1d", unread: 0 },
];

const initial = [
  { from: "them", text: "Hi! Welcome to RIDENEPAL. How can we help?", time: "10:32" },
  { from: "me", text: "I want to extend my rental by one more day.", time: "10:33" },
  { from: "them", text: "Sure — head over to your dashboard and tap 'Extend Rental'. Payment is required to confirm.", time: "10:33" },
  { from: "me", text: "Got it, thanks!", time: "10:34" },
];

function Chat() {
  const [msgs, setMsgs] = useState(initial);
  const [text, setText] = useState("");

  const send = () => {
    if (!text.trim()) return;
    setMsgs([...msgs, { from: "me", text, time: "now" }]);
    setText("");
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <SiteHeader />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-4">Messages</h1>
        <Card className="border-0 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-[300px_1fr] h-[70vh]">
          {/* Contacts */}
          <aside className="border-r flex flex-col">
            <div className="p-3 border-b">
              <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background">
                <Search className="size-4 text-muted-foreground" />
                <input placeholder="Search chats" className="bg-transparent flex-1 text-sm outline-none" />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {contacts.map(c => (
                <button key={c.name} className={`w-full text-left p-3 flex items-center gap-3 border-b hover:bg-secondary/50 ${c.active ? "bg-primary/5" : ""}`}>
                  <div className="size-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold shrink-0">{c.name[0]}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="font-semibold text-sm truncate">{c.name}</span>
                      <span className="text-[10px] text-muted-foreground">{c.time}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-xs text-muted-foreground truncate">{c.last}</span>
                      {c.unread > 0 && <span className="bg-primary text-primary-foreground text-[10px] rounded-full px-1.5">{c.unread}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {/* Thread */}
          <section className="flex flex-col">
            <div className="border-b p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold">R</div>
                <div>
                  <div className="font-semibold text-sm">RIDENEPAL Support</div>
                  <div className="text-xs text-primary flex items-center gap-1"><span className="size-1.5 rounded-full bg-primary" /> Online</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <button><Phone className="size-4" /></button>
                <button><MoreVertical className="size-4" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-secondary/20">
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${m.from === "me" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-background border rounded-bl-sm"}`}>
                    {m.text}
                    <div className={`text-[10px] mt-1 ${m.from === "me" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{m.time}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t p-3 flex gap-2">
              <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a message..." />
              <Button onClick={send} className="bg-primary hover:bg-primary/90"><Send className="size-4" /></Button>
            </div>
          </section>
        </Card>
      </main>
    </div>
  );
}
