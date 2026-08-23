import { createFileRoute } from "@tanstack/react-router";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { verifySessionToken } from "@/lib/auth/session";

function getCookieValue(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  const match = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

export const Route = createFileRoute("/api/gallery-upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = getCookieValue(request, "ridenepal_session");
        if (!token) return new Response("Unauthorized", { status: 401 });
        const decoded = verifySessionToken(token);
        if (!decoded) return new Response("Unauthorized", { status: 401 });

        const pool = (await import("@/lib/mysql/db.server")).default;
        const [rows] = await pool.query(
          "SELECT id FROM sessions WHERE id = :id AND user_id = :userId AND expires_at > NOW()",
          { id: decoded.sessionId, userId: decoded.userId },
        );
        if ((rows as unknown[]).length === 0) return new Response("Unauthorized", { status: 401 });

        const formData = await request.formData();
        const file = formData.get("file");
        if (!(file instanceof File)) return new Response("No file provided", { status: 400 });

        const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!allowed.includes(file.type))
          return new Response("Unsupported file type", { status: 400 });
        if (file.size > 8 * 1024 * 1024)
          return new Response("File too large (max 8MB)", { status: 400 });

        const extMap: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
          "image/gif": "gif",
        };
        const ext = extMap[file.type] ?? "jpg";
        const filename = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const userDir = path.join(process.cwd(), "public", "uploads", "gallery", decoded.userId);
        await mkdir(userDir, { recursive: true });
        const filepath = path.join(userDir, filename);
        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(filepath, buffer);

        const publicPath = `/uploads/gallery/${decoded.userId}/${filename}`;
        return new Response(JSON.stringify({ path: publicPath }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
