import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { me } from "@/lib/auth.functions";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    try {
      await me();
    } catch {
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});
