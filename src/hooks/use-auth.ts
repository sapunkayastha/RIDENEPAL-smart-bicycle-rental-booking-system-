import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { me, logout as logoutFn } from "@/lib/auth.functions";

export function useAuth() {
  const fetchMe = useServerFn(me);
  const doLogout = useServerFn(logoutFn);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => fetchMe(),
    retry: false,
    // Not being logged in is a normal, expected state — don't treat it as an error.
    throwOnError: false,
  });

  async function signOut() {
    await doLogout();
    queryClient.invalidateQueries({ queryKey: ["me"] });
    navigate({ to: "/auth" });
  }

  return {
    user: user ?? null,
    loading: isLoading,
    signOut,
  };
}
