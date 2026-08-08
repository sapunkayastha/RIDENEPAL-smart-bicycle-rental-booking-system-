import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { amISuperAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/_admin")({
  beforeLoad: async () => {
    try {
      const { isSuperAdmin } = await amISuperAdmin();
      if (!isSuperAdmin) throw redirect({ to: "/dashboard" });
    } catch (err) {
      if (err && typeof err === "object" && "to" in (err as Record<string, unknown>)) throw err;
      throw redirect({ to: "/dashboard" });
    }
  },
  component: () => <Outlet />,
});
