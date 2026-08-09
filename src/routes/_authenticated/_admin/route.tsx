import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { amIStaff } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/_admin")({
  beforeLoad: async () => {
    try {
      const { isStaff } = await amIStaff();
      if (!isStaff) throw redirect({ to: "/dashboard" });
    } catch (err) {
      if (err && typeof err === "object" && "to" in (err as Record<string, unknown>)) throw err;
      throw redirect({ to: "/dashboard" });
    }
  },
  component: () => <Outlet />,
});
