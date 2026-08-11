import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select("id, title, body, link, read, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("notifications")
      .update({ read: true })
      .eq("id", data.id)
      .eq("recipient_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("notifications")
      .update({ read: true })
      .eq("recipient_id", context.userId)
      .eq("read", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Internal helper (not a route-exposed server fn) — notifies every staff
 * member (super_admin + admin) about something. Called from other server
 * functions using the service role, e.g. right after a booking is created.
 */
export async function notifyStaff(params: { title: string; body?: string; link?: string }) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Query super_admin and admin separately — if the 'admin' enum value
    // doesn't exist yet in this database, filtering by it directly would
    // throw and silently kill the whole notification (and, if unguarded,
    // whatever action triggered it — e.g. booking creation).
    const results = await Promise.allSettled([
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "super_admin"),
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
    ]);
    const staffIds = new Set<string>();
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.data) {
        for (const row of r.value.data) staffIds.add(row.user_id);
      }
    }
    if (staffIds.size === 0) return;

    const rows = [...staffIds].map((id) => ({
      recipient_id: id,
      title: params.title,
      body: params.body ?? null,
      link: params.link ?? null,
    }));
    await supabaseAdmin.from("notifications").insert(rows);
  } catch (err) {
    console.error("notifyStaff failed:", err);
  }
}
