import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, MessageCircle, Bookmark, Plus, MapPin, Search, Loader2 } from "lucide-react";
import { listGalleryPosts, toggleGalleryLike } from "@/lib/gallery.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/community")({
  component: Community,
  head: () => ({ meta: [{ title: "The Trail — RideNepal Community" }] }),
});

const stories = ["Aanya", "Bishal", "Maya", "Kiran", "Anu"];

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Community() {
  const fetchPosts = useServerFn(listGalleryPosts);
  const toggleLike = useServerFn(toggleGalleryLike);
  const qc = useQueryClient();

  const { data: posts, isLoading } = useQuery({
    queryKey: ["gallery-posts"],
    queryFn: () => fetchPosts({ data: { limit: 20 } }),
  });

  const likeMutation = useMutation({
    mutationFn: (postId: string) => toggleLike({ data: { post_id: postId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gallery-posts"] }),
    onError: () => toast.error("Sign in to like posts"),
  });

  return (
    <div className="min-h-screen bg-secondary/30">
      <SiteHeader />
      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[200px_1fr_280px] gap-6">
        {/* Side nav */}
        <aside className="space-y-1 text-sm">
          <h3 className="font-bold text-primary mb-3">The Trail</h3>
          {["Home","Trending","Riders","Gallery","Events","Settings"].map((n,i)=>(
            <button key={n} className={`w-full text-left px-3 py-2 rounded-md ${i===0?'bg-primary text-primary-foreground':'hover:bg-muted'}`}>{n}</button>
          ))}
          <Button asChild className="w-full mt-4 bg-primary hover:bg-primary/90"><Link to="/gallery">Start Expedition</Link></Button>
        </aside>

        {/* Feed */}
        <section className="space-y-5">
          <Card className="p-4 border-0 shadow-sm flex items-center gap-3 overflow-x-auto">
            <button className="size-14 rounded-full border-2 border-dashed border-primary flex items-center justify-center shrink-0"><Plus className="size-5 text-primary" /></button>
            {stories.map(s => (
              <div key={s} className="text-center shrink-0">
                <div className="size-14 rounded-full bg-gradient-to-br from-primary to-primary/40 p-0.5">
                  <div className="size-full rounded-full bg-background flex items-center justify-center text-sm font-semibold">{s[0]}</div>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">{s}</div>
              </div>
            ))}
          </Card>

          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground"><Loader2 className="size-5 animate-spin mx-auto mb-2" /> Loading the trail…</div>
          ) : (posts ?? []).length === 0 ? (
            <Card className="p-10 border-0 shadow-sm text-center text-muted-foreground">
              No stories yet. <Link to="/gallery" className="text-primary hover:underline">Be the first to post a ride →</Link>
            </Card>
          ) : (posts ?? []).map(p => (
            <Card key={p.id} className="overflow-hidden border-0 shadow-sm">
              <div className="p-4 flex items-center gap-3">
                <div className="size-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold">{p.user_name[0]}</div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">{p.user_name}</div>
                  <div className="text-xs text-muted-foreground">{timeAgo(p.created_at)}{p.place ? ` · ${p.place}` : ""}</div>
                </div>
              </div>
              <div className="aspect-[16/9] bg-muted">
                <img src={p.image_url} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="p-5">
                {p.caption && <p className="text-sm text-muted-foreground leading-relaxed">{p.caption}</p>}
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="flex gap-5 text-sm text-muted-foreground">
                    <button onClick={() => likeMutation.mutate(p.id)} className="flex items-center gap-1.5 hover:text-primary"><Heart className="size-4" /> {p.like_count}</button>
                    <button className="flex items-center gap-1.5 hover:text-primary"><MessageCircle className="size-4" /> {p.comments.length}</button>
                  </div>
                  <button className="text-muted-foreground hover:text-primary"><Bookmark className="size-4" /></button>
                </div>
              </div>
            </Card>
          ))}
        </section>

        {/* Right rail */}
        <aside className="space-y-5">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search trail stories" className="pl-9" />
          </div>
          <Card className="p-4 border-0 shadow-sm">
            <h4 className="font-semibold text-sm mb-3">Trending Trails</h4>
            <div className="space-y-3 text-sm">
              <div><div className="text-[10px] text-primary font-semibold">TREK</div><div className="font-medium">Lower Mustang Loop</div><div className="text-xs text-muted-foreground">128 expeditions this week</div></div>
              <div><div className="text-[10px] text-primary font-semibold">DISCOVER</div><div className="font-medium">Pokhara to Sarangkot</div><div className="text-xs text-muted-foreground">87 expeditions</div></div>
            </div>
          </Card>
          <Card className="p-4 border-0 shadow-sm">
            <h4 className="font-semibold text-sm mb-3">Suggested Riders</h4>
            {[{n:"Nabil Karki",r:"Pro"},{n:"Priya Lama",r:"Explorer"}].map(r => (
              <div key={r.n} className="flex items-center gap-2 py-2">
                <div className="size-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">{r.n[0]}</div>
                <div className="flex-1"><div className="text-xs font-medium">{r.n}</div><div className="text-[10px] text-muted-foreground">{r.r}</div></div>
                <Button size="sm" variant="outline" className="h-7 text-xs">Follow</Button>
              </div>
            ))}
          </Card>
          <Card className="p-4 border-0 shadow-sm">
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-1"><MapPin className="size-3 text-primary" /> Riders Near You</h4>
            <div className="aspect-square rounded-md bg-gradient-to-br from-primary/20 to-secondary" />
          </Card>
        </aside>
      </main>
      <Link to="/gallery" className="fixed bottom-6 right-6 size-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 flex items-center justify-center"><Plus className="size-5" /></Link>
    </div>
  );
}
