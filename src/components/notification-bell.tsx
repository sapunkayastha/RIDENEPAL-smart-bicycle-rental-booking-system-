import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/notifications.functions";

export function NotificationBell({ linkCls }: { linkCls: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const fetchNotifications = useServerFn(listMyNotifications);
  const markRead = useServerFn(markNotificationRead);
  const markAllRead = useServerFn(markAllNotificationsRead);

  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(),
    refetchInterval: 30_000, // poll every 30s so new bookings show up without a full reload
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

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label="Notifications"
        className={`relative ${linkCls}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-lg border bg-background shadow-lg z-50 text-foreground">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => readAllMutation.mutate()}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          {(notifications ?? []).length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No notifications yet
            </p>
          ) : (
            <ul className="divide-y">
              {(notifications ?? []).map((n) => {
                const content = (
                  <div className={`px-4 py-3 text-sm ${!n.read ? "bg-primary/5" : ""}`}>
                    <div className="font-medium flex items-center gap-2">
                      {!n.read && <span className="size-1.5 rounded-full bg-primary shrink-0" />}
                      {n.title}
                    </div>
                    {n.body && <p className="text-muted-foreground text-xs mt-0.5">{n.body}</p>}
                    <p className="text-muted-foreground text-[10px] mt-1">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <a
                        href={n.link}
                        onClick={() => {
                          if (!n.read) readMutation.mutate(n.id);
                          setOpen(false);
                        }}
                        className="block hover:bg-secondary/50"
                      >
                        {content}
                      </a>
                    ) : (
                      <button
                        onClick={() => !n.read && readMutation.mutate(n.id)}
                        className="block w-full text-left hover:bg-secondary/50"
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
