import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireMysqlAuth } from "@/lib/auth/auth-middleware";
import { assertStaff } from "@/lib/auth/role-check";

type ConversationRow = { id: string };
type MessageRow = { id: string; body: string; is_staff: number; created_at: string };
type ConversationListRow = { id: string; user_id: string; created_at: string };
type LastMsgRow = { conversation_id: string; body: string; created_at: string; is_staff: number };
type UnreadRow = { conversation_id: string };
type ProfileRow = { id: string; full_name: string | null };

async function getPool() {
  return (await import("@/lib/mysql/db.server")).default;
}

async function getOrCreateConversation(userId: string): Promise<string> {
  const pool = await getPool();
  const [rows] = await pool.query(
    "SELECT id FROM support_conversations WHERE user_id = :userId LIMIT 1",
    { userId },
  );
  const existing = (rows as ConversationRow[])[0];
  if (existing) return existing.id;

  const id = crypto.randomUUID();
  await pool.execute("INSERT INTO support_conversations (id, user_id) VALUES (:id, :userId)", {
    id,
    userId,
  });
  return id;
}

export const listMySupportMessages = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    const pool = await getPool();
    const conversationId = await getOrCreateConversation(context.userId);
    const [rows] = await pool.query(
      `SELECT id, body, is_staff, created_at FROM support_messages
       WHERE conversation_id = :cid ORDER BY created_at ASC`,
      { cid: conversationId },
    );

    await pool.execute(
      `UPDATE support_messages SET \`read\` = TRUE
       WHERE conversation_id = :cid AND is_staff = TRUE AND \`read\` = FALSE`,
      { cid: conversationId },
    );

    return rows as MessageRow[];
  });

export const sendMySupportMessage = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) => z.object({ body: z.string().trim().min(1).max(2000) }).parse(input))
  .handler(async ({ data, context }) => {
    const pool = await getPool();
    const conversationId = await getOrCreateConversation(context.userId);
    await pool.execute(
      `INSERT INTO support_messages (id, conversation_id, sender_id, is_staff, body)
       VALUES (:id, :cid, :senderId, FALSE, :body)`,
      { id: crypto.randomUUID(), cid: conversationId, senderId: context.userId, body: data.body },
    );

    const { notifyStaff } = await import("@/lib/notifications.functions");
    await notifyStaff({
      title: "New support message",
      body: data.body.slice(0, 120),
      link: "/messages",
    });

    return { ok: true };
  });

export const listSupportConversations = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.userId);
    const pool = await getPool();

    const [conversationRows] = await pool.query(
      "SELECT id, user_id, created_at FROM support_conversations ORDER BY created_at DESC",
    );
    const conversations = conversationRows as ConversationListRow[];
    const ids = conversations.map((c) => c.id);
    const userIds = conversations.map((c) => c.user_id);

    if (ids.length === 0) return [];

    const [lastMsgRows] = await pool.query(
      `SELECT conversation_id, body, created_at, is_staff FROM support_messages
       WHERE conversation_id IN (:ids) ORDER BY created_at DESC`,
      { ids },
    );
    const [unreadRows] = await pool.query(
      `SELECT conversation_id FROM support_messages
       WHERE conversation_id IN (:ids) AND is_staff = FALSE AND \`read\` = FALSE`,
      { ids },
    );
    const [profileRows] = await pool.query("SELECT id, full_name FROM users WHERE id IN (:ids)", {
      ids: userIds.length ? userIds : ["-"],
    });

    const lastMsgs = lastMsgRows as LastMsgRow[];
    const unread = unreadRows as UnreadRow[];
    const profiles = profileRows as ProfileRow[];

    return conversations
      .map((c) => {
        const msgsForConvo = lastMsgs.filter((m) => m.conversation_id === c.id);
        const last = msgsForConvo[0];
        return {
          id: c.id,
          user_id: c.user_id,
          customer_name: profiles.find((p) => p.id === c.user_id)?.full_name || "Customer",
          last_message: last?.body ?? null,
          last_message_at: last?.created_at ?? c.created_at,
          unread_count: unread.filter((m) => m.conversation_id === c.id).length,
        };
      })
      .sort(
        (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
      );
  });

export const getSupportConversationMessages = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) => z.object({ conversation_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);
    const pool = await getPool();

    const [rows] = await pool.query(
      `SELECT id, body, is_staff, created_at FROM support_messages
       WHERE conversation_id = :cid ORDER BY created_at ASC`,
      { cid: data.conversation_id },
    );

    await pool.execute(
      `UPDATE support_messages SET \`read\` = TRUE
       WHERE conversation_id = :cid AND is_staff = FALSE AND \`read\` = FALSE`,
      { cid: data.conversation_id },
    );

    return rows as MessageRow[];
  });

export const sendStaffReply = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) =>
    z
      .object({ conversation_id: z.string().uuid(), body: z.string().trim().min(1).max(2000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);
    const pool = await getPool();

    await pool.execute(
      `INSERT INTO support_messages (id, conversation_id, sender_id, is_staff, body)
       VALUES (:id, :cid, :senderId, TRUE, :body)`,
      {
        id: crypto.randomUUID(),
        cid: data.conversation_id,
        senderId: context.userId,
        body: data.body,
      },
    );

    const [convoRows] = await pool.query(
      "SELECT user_id FROM support_conversations WHERE id = :id",
      { id: data.conversation_id },
    );
    const convo = (convoRows as { user_id: string }[])[0];
    if (convo) {
      await pool.execute(
        `INSERT INTO notifications (id, recipient_id, title, body, link)
         VALUES (:id, :recipientId, :title, :body, :link)`,
        {
          id: crypto.randomUUID(),
          recipientId: convo.user_id,
          title: "RIDENEPAL Support replied",
          body: data.body.slice(0, 120),
          link: "/chat",
        },
      );
    }

    return { ok: true };
  });
