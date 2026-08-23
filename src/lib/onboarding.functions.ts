import { createServerFn } from "@tanstack/react-start";
import { requireMysqlAuth } from "@/lib/auth/auth-middleware";
import { homePathForRoles } from "@/lib/roles";

export const completeCustomerOnboarding = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input: { fullName?: string; phone?: string }) => ({
    fullName: input?.fullName?.trim().slice(0, 100) || null,
    phone: input?.phone?.trim().slice(0, 30) || null,
  }))
  .handler(async ({ data, context }) => {
    const pool = (await import("@/lib/mysql/db.server")).default;

    if (data.fullName || data.phone) {
      const setParts: string[] = [];
      const params: Record<string, unknown> = { id: context.userId };
      if (data.fullName) {
        setParts.push("full_name = :fullName");
        params.fullName = data.fullName;
      }
      if (data.phone) {
        setParts.push("phone = :phone");
        params.phone = data.phone;
      }
      await pool.execute(`UPDATE users SET ${setParts.join(", ")} WHERE id = :id`, params);
    }

    const [roleRows] = await pool.query("SELECT role FROM user_roles WHERE user_id = :id", {
      id: context.userId,
    });
    const existing = (roleRows as { role: string }[]).map((r) => r.role);
    if (existing.length === 0) {
      await pool.execute("INSERT INTO user_roles (user_id, role) VALUES (:id, 'customer')", {
        id: context.userId,
      });
      existing.push("customer");
    }

    const [userRows] = await pool.query("SELECT otp_verified FROM users WHERE id = :id", {
      id: context.userId,
    });
    const otpVerified = Boolean((userRows as { otp_verified: number }[])[0]?.otp_verified);

    return {
      roles: existing,
      otpVerified,
      next: otpVerified ? homePathForRoles(existing) : "/verify-otp",
    };
  });
