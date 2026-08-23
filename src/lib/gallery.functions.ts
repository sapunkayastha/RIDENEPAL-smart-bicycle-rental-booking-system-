import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireMysqlAuth } from "@/lib/auth/auth-middleware";

async function getPool() {
  return (await import("@/lib/mysql/db.server")).default;
}

type PostRow = {
  id: string;
  user_id: string;
  image_path: string;
  caption: string | null;
  place: string | null;
  created_at: string;
  full_name: string | null;
};

type LikeRow = { post_id: string };
type CommentRow = { id: string; post_id: string; body: string; full_name: string | null };

export const listGalleryPosts = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ limit: z.number().int().min(1).max(50).default(20) }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const pool = await getPool();
    const [posts] = await pool.query(
      `SELECT p.id, p.user_id, p.image_path, p.caption, p.place, p.created_at, u.full_name
       FROM gallery_posts p
       LEFT JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC
       LIMIT :limit`,
      { limit: data.limit },
    );
    const postRows = posts as PostRow[];
    const ids = postRows.map((p) => p.id);
    if (ids.length === 0) return [];

    const [likeRows] = await pool.query(
      "SELECT post_id FROM gallery_likes WHERE post_id IN (:ids)",
      { ids },
    );
    const [commentRows] = await pool.query(
      `SELECT c.id, c.post_id, c.body, u.full_name
       FROM gallery_comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.post_id IN (:ids)
       ORDER BY c.created_at ASC`,
      { ids },
    );

    const likes = likeRows as LikeRow[];
    const comments = commentRows as CommentRow[];

    return postRows.map((p) => ({
      id: p.id,
      user_id: p.user_id,
      user_name: p.full_name || "Rider",
      image_url: p.image_path,
      caption: p.caption,
      place: p.place,
      created_at: p.created_at,
      like_count: likes.filter((l) => l.post_id === p.id).length,
      comments: comments
        .filter((c) => c.post_id === p.id)
        .map((c) => ({ id: c.id, body: c.body, user_name: c.full_name || "Rider" })),
    }));
  });

export const createGalleryPost = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) =>
    z
      .object({
        image_path: z.string().min(1),
        caption: z.string().trim().max(500).optional().nullable(),
        place: z.string().trim().max(120).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!data.image_path.startsWith(`/uploads/gallery/${context.userId}/`)) {
      throw new Error("Invalid image path");
    }
    const pool = await getPool();
    const id = crypto.randomUUID();
    await pool.execute(
      `INSERT INTO gallery_posts (id, user_id, image_path, caption, place)
       VALUES (:id, :userId, :imagePath, :caption, :place)`,
      {
        id,
        userId: context.userId,
        imagePath: data.image_path,
        caption: data.caption || null,
        place: data.place || null,
      },
    );
    return { id };
  });

export const toggleGalleryLike = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) => z.object({ post_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT post_id FROM gallery_likes WHERE post_id = :postId AND user_id = :userId",
      { postId: data.post_id, userId: context.userId },
    );
    if ((rows as unknown[]).length > 0) {
      await pool.execute(
        "DELETE FROM gallery_likes WHERE post_id = :postId AND user_id = :userId",
        { postId: data.post_id, userId: context.userId },
      );
      return { liked: false };
    }
    await pool.execute("INSERT INTO gallery_likes (post_id, user_id) VALUES (:postId, :userId)", {
      postId: data.post_id,
      userId: context.userId,
    });
    return { liked: true };
  });

export const addGalleryComment = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) =>
    z.object({ post_id: z.string().uuid(), body: z.string().trim().min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const pool = await getPool();
    await pool.execute(
      "INSERT INTO gallery_comments (id, post_id, user_id, body) VALUES (:id, :postId, :userId, :body)",
      { id: crypto.randomUUID(), postId: data.post_id, userId: context.userId, body: data.body },
    );
    return { ok: true };
  });
