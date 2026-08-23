import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  User,
  LayoutDashboard,
  MessageSquare,
  Bell,
  ShieldCheck,
  LogOut,
  ChevronDown,
  Radio,
} from "lucide-react";
import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/notifications.functions";

type UserMenuProps = {
  linkCls: string;
  isStaff: boolean;
  isSuperAdmin: boolean;
  onSignOut: () => void;
};

export function UserMenu({ linkCls, isStaff, isSuperAdmin, onSignOut }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchNotifications = useServerFn(listMyNotifications);
  const markRead = useServerFn(markNotificationRead);
  const markAllRead = useServerFn(markAllNotificationsRead);

  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(),
    refetchInterval: 30_000,
  });

  const readMutation = useMutation({
    mutationFn: (id: string) => markRead({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const readAllMutation = useMutation({
    mutationFn: () => markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const unreadCount = (notifications ?? []).filter((n) => !n.read).length;
  const recentNotifications = (notifications ?? []).slice(0, 5);

  function go(link: string | null) {
    setOpen(false);
    if (link) navigate({ to: link as "/dashboard" });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label="Account menu"
        className={`relative flex items-center gap-1 ${linkCls}`}
        onClick={() => setOpen((o) => !o)}
      >
        <User className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        <ChevronDown className="size-3.5 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[28rem] overflow-y-auto rounded-lg border bg-background shadow-lg z-50 text-foreground">
          {/* Notifications section */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="font-semibold text-sm flex items-center gap-1.5">
              <Bell className="size-3.5" /> Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => readAllMutation.mutate()}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {recentNotifications.length === 0 ? (
            <p className="px-4 py-4 text-center text-xs text-muted-foreground border-b">
              No notifications yet
            </p>
          ) : (
            <ul className="divide-y border-b">
              {recentNotifications.map((n) => {
                const content = (
                  <div className={`px-4 py-2.5 text-sm ${!n.read ? "bg-primary/5" : ""}`}>
                    <div className="font-medium flex items-center gap-2 text-xs">
                      {!n.read && <span className="size-1.5 rounded-full bg-primary shrink-0" />}
                      {n.title}
                    </div>
                    {n.body && (
                      <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">{n.body}</p>
                    )}
                  </div>
                );
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => {
                        if (!n.read) readMutation.mutate(n.id);
                        go(n.link);
                      }}
                      className="block w-full text-left hover:bg-secondary/50"
                    >
                      {content}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Quick links */}
          <nav className="py-1">
            <button
              onClick={() => go("/dashboard")}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-secondary/50 text-left"
            >
              <LayoutDashboard className="size-4 text-muted-foreground" /> Dashboard
            </button>
            <button
              onClick={() => go("/chat")}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-secondary/50 text-left"
            >
              <MessageSquare className="size-4 text-muted-foreground" /> Messages
            </button>
            <button
              onClick={() => go("/profile")}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-secondary/50 text-left"
            >
              <User className="size-4 text-muted-foreground" /> Profile
            </button>
            {isStaff && (
              <>
                <button
                  onClick={() => go("/admin")}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-secondary/50 text-left font-medium text-primary"
                >
                  <ShieldCheck className="size-4" /> {isSuperAdmin ? "Super Admin" : "Admin"}{" "}
                  Console
                </button>
                <button
                  onClick={() => go("/tracking")}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-secondary/50 text-left font-medium text-primary"
                >
                  <Radio className="size-4" /> Live Bike Tracking
                </button>
              </>
            )}
          </nav>

          <div className="border-t py-1">
            <button
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-secondary/50 text-left text-muted-foreground"
            >
              <LogOut className="size-4" /> Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
