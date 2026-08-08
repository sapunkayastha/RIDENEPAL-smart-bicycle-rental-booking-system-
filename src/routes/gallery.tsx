import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Heart, MessageCircle, Share2, ImagePlus, MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listGalleryPosts, createGalleryPost, toggleGalleryLike, addGalleryComment } from "@/lib/gallery.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/gallery")({
  component: Gallery,
  head: () => ({ meta: [{ title: "Social Gallery — RIDENEPAL" }] }),
});

type Post = Awaited<ReturnType<typeof listGalleryPosts>>[number];

function Gallery() {
  const fetchPosts = useServerFn(listGalleryPosts);
  const createPost = useServerFn(createGalleryPost);
  const qc = useQueryClient();

  const [caption, setCaption] = useState("");
  const [place, setPlace] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const { data: posts, isLoading } = useQuery({
    queryKey: ["gallery-posts"],
    queryFn: () => fetchPosts({ data: { limit: 20 } }),
  });

  async function submitPost() {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      toast.error("Sign in to post");
      return;
    }
    if (!caption.trim() && !file) return;

    setPosting(true);
    try {
      let image_path = "";
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        image_path = `${session.session.user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("gallery").upload(image_path, file, {
          cacheControl: "3600",
          contentType: file.type,
        });
        if (uploadErr) throw uploadErr;
      } else {
        toast.error("Add a photo to post");
        setPosting(false);
        return;
      }

      await createPost({ data: { image_path, caption: caption.trim() || null, place: place.trim() || null } });
      setCaption(""); setPlace(""); setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      qc.invalidateQueries({ queryKey: ["gallery-posts"] });
      toast.success("Posted!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not post");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Social Gallery</h1>
        <p className="text-muted-foreground mt-1 mb-6">Share your rides. Like, comment, and inspire other RIDENEPAL cyclists.</p>

        <Card className="p-5 border-0 shadow-sm mb-8">
          <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Where did you ride today?" className="resize-none" rows={2} />
          <Input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Location (optional)" className="mt-2" />
          {file && <p className="text-xs text-muted-foreground mt-2">📎 {file.name}</p>}
          <div className="flex items-center justify-between mt-3">
            <button onClick={() => fileInput.current?.click()} className="text-sm text-primary flex items-center gap-2 hover:underline">
              <ImagePlus className="size-4" /> {file ? "Change photo" : "Add photo"}
            </button>
            <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Button className="bg-primary hover:bg-primary/90" disabled={posting || (!caption.trim() && !file)} onClick={submitPost}>
              {posting ? "Posting…" : "Post Ride"}
            </Button>
          </div>
        </Card>

        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground"><Loader2 className="size-5 animate-spin mx-auto mb-2" /> Loading posts…</div>
        ) : (posts ?? []).length === 0 ? (
          <p className="text-center py-10 text-muted-foreground">No rides posted yet — be the first!</p>
        ) : (
          <div className="space-y-6">
            {(posts ?? []).map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        )}

        <div className="text-center mt-10">
          <Button asChild variant="outline"><Link to="/fleet" search={{ pickup: undefined, date: undefined }}>Book your next ride</Link></Button>
        </div>
      </main>
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  const toggleLike = useServerFn(toggleGalleryLike);
  const addComment = useServerFn(addGalleryComment);
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const likeMutation = useMutation({
    mutationFn: () => toggleLike({ data: { post_id: post.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gallery-posts"] }),
    onError: () => toast.error("Sign in to like posts"),
  });

  const commentMutation = useMutation({
    mutationFn: (body: string) => addComment({ data: { post_id: post.id, body } }),
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["gallery-posts"] }); },
    onError: () => toast.error("Sign in to comment"),
  });

  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <div className="p-4 flex items-center gap-3">
        <div className="size-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold">{post.user_name[0]}</div>
        <div>
          <div className="font-semibold text-sm">{post.user_name}</div>
          {post.place && <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="size-3" /> {post.place}</div>}
        </div>
      </div>
      <div className="aspect-square bg-muted"><img src={post.image_url} alt={post.caption ?? ""} className="w-full h-full object-cover" /></div>
      <div className="p-4">
        <div className="flex items-center gap-5 mb-3 text-sm">
          <button onClick={() => likeMutation.mutate()} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary">
            <Heart className="size-5" /> {post.like_count}
          </button>
          <span className="flex items-center gap-1.5 text-muted-foreground"><MessageCircle className="size-5" /> {post.comments.length}</span>
          <button aria-label="Share post" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground ml-auto"><Share2 className="size-4" /></button>
        </div>
        {post.caption && <p className="text-sm"><span className="font-semibold">{post.user_name}</span> {post.caption}</p>}
        {post.comments.length > 0 && (
          <div className="mt-3 space-y-1 text-sm">
            {post.comments.map((c) => <div key={c.id}><span className="font-semibold">{c.user_name}</span> <span className="text-muted-foreground">{c.body}</span></div>)}
          </div>
        )}
        <div className="flex gap-2 mt-3">
          <Input value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) commentMutation.mutate(text.trim()); }}
            placeholder="Add a comment..." />
        </div>
      </div>
    </Card>
  );
}
