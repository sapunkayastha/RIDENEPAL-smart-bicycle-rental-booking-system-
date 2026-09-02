import { useState, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  User,
  LayoutDashboard,
  MessageSquare,
  ShieldCheck,
  LogOut,
  ChevronDown,
  Radio,
} from "lucide-react";

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

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function go(link: string) {
    setOpen(false);
    navigate({ to: link as "/dashboard" });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label="Account menu"
        className={`relative flex items-center gap-1 ${linkCls}`}
        onClick={() => setOpen((o) => !o)}
      >
        <User className="size-5" />
        <ChevronDown className="size-3.5 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-lg border bg-background shadow-lg z-50 text-foreground">
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
