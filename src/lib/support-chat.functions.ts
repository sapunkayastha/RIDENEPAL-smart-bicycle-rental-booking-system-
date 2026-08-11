import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getOrCreateConversation(supabaseAdmin: any, userId: string) {
  const { data: existing } = await supabaseAdmin
    .from("support_conversations")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await supabaseAdmin
    .from("support_conversations")
    .insert({ user_id: userId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
}

// ---- Customer-facing ----

export const listMySupportMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const conversationId = await getOrCreateConversation(supabaseAdmin, context.userId);

    const { data: messages, error } = await supabaseAdmin
      .from("support_messages")
      .select("id, body, is_staff, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    // Mark staff messages as read now that the customer has fetched them.
    await supabaseAdmin
      .from("support_messages")
      .update({ read: true })
      .eq("conversation_id", conversationId)
      .eq("is_staff", true)
      .eq("read", false);

    return messages ?? [];
  });

export const sendMySupportMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ body: z.string().trim().min(1).max(2000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const conversationId = await getOrCreateConversation(supabaseAdmin, context.userId);

    const { error } = await supabaseAdmin.from("support_messages").insert({
      conversation_id: conversationId,
      sender_id: context.userId,
      is_staff: false,
      body: data.body,
    });
    if (error) throw new Error(error.message);

    const { notifyStaff } = await import("@/lib/notifications.functions");
    await notifyStaff({
      title: "New support message",
      body: data.body.slice(0, 120),
      link: "/messages",
    });

    return { ok: true };
  });

// ---- Staff-facing (RLS on support_conversations/support_messages already
// restricts SELECT to super_admin; these additionally assert it so a bad
// call fails with a clear error instead of just quietly returning nothing) ----

async function assertStaff(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (!data) throw new Error("Forbidden");
}

export const listSupportConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: conversations, error } = await supabaseAdmin
      .from("support_conversations")
      .select("id, user_id, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (conversations ?? []).map((c) => c.id);
    const userIds = (conversations ?? []).map((c) => c.user_id);
    const [{ data: lastMsgs }, { data: unread }, { data: profiles }] = await Promise.all([
      supabaseAdmin
        .from("support_messages")
        .select("conversation_id, body, created_at, is_staff")
        .in("conversation_id", ids.length ? ids : ["-"])
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("support_messages")
        .select("conversation_id")
        .in("conversation_id", ids.length ? ids : ["-"])
        .eq("is_staff", false)
        .eq("read", false),
      supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds.length ? userIds : ["-"]),
    ]);

    return (conversations ?? [])
      .map((c) => {
        const msgsForConvo = (lastMsgs ?? []).filter((m) => m.conversation_id === c.id);
        const last = msgsForConvo[0]; // already sorted desc
        return {
          id: c.id,
          user_id: c.user_id,
          customer_name: (profiles ?? []).find((p) => p.id === c.user_id)?.full_name || "Customer",
          last_message: last?.body ?? null,
          last_message_at: last?.created_at ?? c.created_at,
          unread_count: (unread ?? []).filter((m) => m.conversation_id === c.id).length,
        };
      })
      .sort(
        (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
      );
  });

export const getSupportConversationMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ conversation_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: messages, error } = await supabaseAdmin
      .from("support_messages")
      .select("id, body, is_staff, created_at")
      .eq("conversation_id", data.conversation_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("support_messages")
      .update({ read: true })
      .eq("conversation_id", data.conversation_id)
      .eq("is_staff", false)
      .eq("read", false);

    return messages ?? [];
  });

export const sendStaffReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ conversation_id: z.string().uuid(), body: z.string().trim().min(1).max(2000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.from("support_messages").insert({
      conversation_id: data.conversation_id,
      sender_id: context.userId,
      is_staff: true,
      body: data.body,
    });
    if (error) throw new Error(error.message);

    // Let the customer know they got a reply.
    const { data: convo } = await supabaseAdmin
      .from("support_conversations")
      .select("user_id")
      .eq("id", data.conversation_id)
      .single();
    if (convo) {
      await supabaseAdmin.from("notifications").insert({
        recipient_id: convo.user_id,
        title: "RIDENEPAL Support replied",
        body: data.body.slice(0, 120),
        link: "/chat",
      });
    }

    return { ok: true };
  });
