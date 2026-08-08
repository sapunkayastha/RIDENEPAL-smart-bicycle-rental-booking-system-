import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase as anonClient } from "@/integrations/supabase/client";

const GALLERY_BUCKET = "gallery";

function publicUrlFor(path: string) {
  const { data } = anonClient.storage.from(GALLERY_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export const listGalleryPosts = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ limit: z.number().int().min(1).max(50).default(20) }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: posts, error } = await supabaseAdmin
      .from("gallery_posts")
      .select("id, user_id, image_path, caption, place, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);

    const ids = (posts ?? []).map((p) => p.id);
    const userIds = [...new Set((posts ?? []).map((p) => p.user_id))];
    const [{ data: likes }, { data: comments }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from("gallery_likes").select("post_id, user_id").in("post_id", ids.length ? ids : ["-"]),
      supabaseAdmin.from("gallery_comments").select("id, post_id, user_id, body, created_at")
        .in("post_id", ids.length ? ids : ["-"]).order("created_at", { ascending: true }),
      supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds.length ? userIds : ["-"]),
    ]);

    const nameFor = (uid: string) => (profiles ?? []).find((p) => p.id === uid)?.full_name || "Rider";

    return (posts ?? []).map((p) => ({
      id: p.id,
      user_id: p.user_id,
      user_name: nameFor(p.user_id),
      image_url: publicUrlFor(p.image_path),
      caption: p.caption,
      place: p.place,
      created_at: p.created_at,
      like_count: (likes ?? []).filter((l) => l.post_id === p.id).length,
      comments: (comments ?? [])
        .filter((c) => c.post_id === p.id)
        .map((c) => ({ id: c.id, body: c.body, user_name: nameFor(c.user_id) })),
    }));
  });

export const createGalleryPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      image_path: z.string().min(1),
      caption: z.string().trim().max(500).optional().nullable(),
      place: z.string().trim().max(120).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Confirm the uploaded object actually lives in this user's own folder —
    // the storage policy already enforces this at upload time, but re-check
    // here so a forged path can't be attached to a post server-side either.
    if (!data.image_path.startsWith(`${context.userId}/`)) {
      throw new Error("Invalid image path");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: post, error } = await supabaseAdmin
      .from("gallery_posts")
      .insert({ user_id: context.userId, image_path: data.image_path, caption: data.caption || null, place: data.place || null })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return post;
  });

export const toggleGalleryLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ post_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("gallery_likes")
      .select("post_id")
      .eq("post_id", data.post_id)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin.from("gallery_likes").delete().eq("post_id", data.post_id).eq("user_id", context.userId);
      return { liked: false };
    }
    await supabaseAdmin.from("gallery_likes").insert({ post_id: data.post_id, user_id: context.userId });
    return { liked: true };
  });

export const addGalleryComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ post_id: z.string().uuid(), body: z.string().trim().min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("gallery_comments")
      .insert({ post_id: data.post_id, user_id: context.userId, body: data.body });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
