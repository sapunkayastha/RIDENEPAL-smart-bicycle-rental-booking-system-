import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { myRole, logout } from "@/lib/auth.functions";
import { me } from "@/lib/auth.functions";
import { UserMenu } from "@/components/user-menu";
import { NotificationBell } from "@/components/notification-bell";
import { useNavigate } from "@tanstack/react-router";

export function SiteHeader({ transparent = false }: { transparent?: boolean }) {
  const navigate = useNavigate();
  const fetchMe = useServerFn(me);
  const fetchRole = useServerFn(myRole);
  const doLogout = useServerFn(logout);

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => fetchMe(),
    retry: false,
  });

  const { data: roleFlags } = useQuery({
    queryKey: ["my-role"],
    queryFn: () => fetchRole(),
    enabled: Boolean(user),
    retry: false,
  });

  async function handleSignOut() {
    await doLogout();
    navigate({ to: "/auth" });
  }

  const wrap = transparent ? "absolute top-0 left-0 right-0 z-20" : "border-b bg-background";
  const linkCls = transparent
    ? "text-white/90 hover:text-white"
    : "text-foreground/80 hover:text-foreground";

  return (
    <header className={wrap}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 font-extrabold text-xl tracking-widest text-primary"
        >
          <img
            src="/favicon.png"
            alt="RideNepal logo"
            width={32}
            height={32}
            className="size-8 rounded-md"
          />
          RIDENEPAL
        </Link>
        <nav className="hidden md:flex gap-6 text-sm">
          <Link to="/" className={linkCls}>
            Explore
          </Link>
          <Link to="/fleet" search={{ pickup: undefined, date: undefined }} className={linkCls}>
            Fleet
          </Link>
          <Link to="/bulk-rent" className={linkCls}>
            Bulk Rent
          </Link>
          <Link to="/gallery" className={linkCls}>
            Gallery
          </Link>
          <Link to="/rewards" className={linkCls}>
            Rewards
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <NotificationBell linkCls={linkCls} />
              <UserMenu
                linkCls={linkCls}
                isStaff={roleFlags?.isStaff ?? false}
                isSuperAdmin={roleFlags?.isSuperAdmin ?? false}
                onSignOut={handleSignOut}
              />
            </>
          ) : (
            <Link
              to="/auth"
              className="inline-flex items-center gap-1 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-3 py-1.5"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
