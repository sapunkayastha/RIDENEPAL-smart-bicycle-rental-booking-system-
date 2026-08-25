import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireMysqlAuth } from "@/lib/auth/auth-middleware";

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: number;
  created_at: string;
};

async function getPool() {
  return (await import("@/lib/mysql/db.server")).default;
}

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT id, title, body, link, \`read\`, created_at FROM notifications
       WHERE recipient_id = :userId
       ORDER BY created_at DESC LIMIT 30`,
      { userId: context.userId },
    );
    return rows as NotificationRow[];
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const pool = await getPool();
    await pool.execute(
      "UPDATE notifications SET `read` = TRUE WHERE id = :id AND recipient_id = :userId",
      { id: data.id, userId: context.userId },
    );
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    const pool = await getPool();
    await pool.execute(
      "UPDATE notifications SET `read` = TRUE WHERE recipient_id = :userId AND `read` = FALSE",
      { userId: context.userId },
    );
    return { ok: true };
  });

export async function notifyStaff(params: { title: string; body?: string; link?: string }) {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT user_id FROM user_roles WHERE role IN ('super_admin', 'admin')",
    );
    const staffIds = (rows as { user_id: string }[]).map((r) => r.user_id);
    if (staffIds.length === 0) return;

    for (const id of staffIds) {
      await pool.execute(
        `INSERT INTO notifications (id, recipient_id, title, body, link)
         VALUES (:id, :recipientId, :title, :body, :link)`,
        {
          id: crypto.randomUUID(),
          recipientId: id,
          title: params.title,
          body: params.body ?? null,
          link: params.link ?? null,
        },
      );
    }
  } catch (err) {
    console.error("notifyStaff failed:", err);
  }
}

export async function notifyUser(params: {
  userId: string;
  title: string;
  body?: string;
  link?: string;
}) {
  try {
    const pool = await getPool();
    await pool.execute(
      `INSERT INTO notifications (id, recipient_id, title, body, link)
       VALUES (:id, :recipientId, :title, :body, :link)`,
      {
        id: crypto.randomUUID(),
        recipientId: params.userId,
        title: params.title,
        body: params.body ?? null,
        link: params.link ?? null,
      },
    );
  } catch (err) {
    console.error("notifyUser failed:", err);
  }
}
