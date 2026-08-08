import { Link } from "@tanstack/react-router";
import { Bell, MessageSquare, User, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { amISuperAdmin } from "@/lib/admin.functions";

export function SiteHeader({ transparent = false }: { transparent?: boolean }) {
  const { user, signOut } = useAuth();
  const checkAdmin = useServerFn(amISuperAdmin);
  const { data: adminData } = useQuery({
    queryKey: ["is-super-admin", user?.id],
    queryFn: () => checkAdmin(),
    enabled: Boolean(user),
  });

  const wrap = transparent
    ? "absolute top-0 left-0 right-0 z-20"
    : "border-b bg-background";
  const linkCls = transparent ? "text-white/90 hover:text-white" : "text-foreground/80 hover:text-foreground";

  return (
    <header className={wrap}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-extrabold text-xl tracking-widest text-primary">
          <img src="/favicon.png" alt="RideNepal logo" width={32} height={32} className="size-8 rounded-md" />
          RIDENEPAL
        </Link>
        <nav className="hidden md:flex gap-6 text-sm">
          <Link to="/" className={linkCls}>Explore</Link>
          <Link to="/fleet" search={{ pickup: undefined, date: undefined }} className={linkCls}>Fleet</Link>
          <Link to="/bulk-rent" className={linkCls}>Bulk Rent</Link>
          <Link to="/gallery" className={linkCls}>Gallery</Link>
          <Link to="/rewards" className={linkCls}>Rewards</Link>
          {user && <Link to="/dashboard" className={linkCls}>Dashboard</Link>}
          {adminData?.isSuperAdmin && (
            <Link to="/admin" className={`${linkCls} flex items-center gap-1 font-semibold`}>
              <ShieldCheck className="size-4" /> Admin
            </Link>
          )}

        </nav>
        <div className="flex items-center gap-3">
          <Link to="/chat" aria-label="Messages" className={linkCls}><MessageSquare className="size-5" /></Link>
          <button aria-label="Notifications" className={linkCls}><Bell className="size-5" /></button>
          {user ? (
            <Button size="sm" variant="outline" onClick={() => signOut()}>
              <LogOut className="size-4 mr-1" /> Sign Out
            </Button>
          ) : (
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90">
              <Link to="/auth"><User className="size-4 mr-1" /> Sign In</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
