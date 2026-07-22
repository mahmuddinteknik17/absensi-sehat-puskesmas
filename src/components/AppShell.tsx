import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import {
  Leaf,
  LayoutDashboard,
  MapPin,
  History,
  Users,
  CalendarDays,
  Settings,
  LogOut,
  Menu,
  X,
  Loader2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
  mobile?: boolean;
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, mobile: true },
  { to: "/absen", label: "Absen", icon: MapPin, mobile: true },
  { to: "/riwayat", label: "Riwayat", icon: History, mobile: true },
  { to: "/pegawai", label: "Pegawai", icon: Users, adminOnly: true },
  { to: "/hari-libur", label: "Hari Libur", icon: CalendarDays, adminOnly: true },
  { to: "/pengaturan", label: "Pengaturan", icon: Settings, adminOnly: true, mobile: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const [openMobile, setOpenMobile] = useState(false);

  if (user.loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const items = NAV.filter((n) => !n.adminOnly || user.role === "admin");
  const mobileItems = items.filter((n) => n.mobile);

  return (
    <div className="min-h-screen bg-primary-soft/40">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 border-r border-border/60 bg-sidebar flex-col z-30">
        <SidebarBrand />
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {items.map((it) => (
            <SidebarLink key={it.to} item={it} />
          ))}
        </nav>
        <UserFooter user={user} />
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-card/95 backdrop-blur px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Leaf className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">SIPASTI</div>
            <div className="text-[10px] text-muted-foreground leading-tight">
              Presensi Apel
            </div>
          </div>
        </div>
        <button
          onClick={() => setOpenMobile(true)}
          className="grid h-9 w-9 place-items-center rounded-lg border border-border text-foreground"
          aria-label="Buka menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      {openMobile && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpenMobile(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-sidebar shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border/60">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <Leaf className="h-5 w-5" />
                </div>
                <div className="text-sm font-bold">SIPASTI</div>
              </div>
              <button
                onClick={() => setOpenMobile(false)}
                className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground"
                aria-label="Tutup menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {items.map((it) => (
                <SidebarLink key={it.to} item={it} onClick={() => setOpenMobile(false)} />
              ))}
            </nav>
            <UserFooter user={user} />
          </div>
        </div>
      )}

      {/* Main */}
      <main className="lg:pl-64 pb-24 lg:pb-8">
        <div className="mx-auto max-w-6xl px-4 py-5 lg:px-8 lg:py-8">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border/60 bg-card/95 backdrop-blur">
        <div className="grid grid-cols-4 gap-1 p-2">
          {mobileItems.slice(0, 4).map((it) => (
            <BottomLink key={it.to} item={it} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function SidebarBrand() {
  return (
    <div className="flex items-center gap-3 p-5 border-b border-sidebar-border/60">
      <div
        className="grid h-10 w-10 place-items-center rounded-xl text-primary-foreground shadow-[var(--shadow-soft)]"
        style={{ background: "var(--gradient-primary)" }}
      >
        <Leaf className="h-5 w-5" />
      </div>
      <div>
        <div className="text-sm font-extrabold text-foreground leading-tight">SIPASTI</div>
        <div className="text-[10px] text-muted-foreground leading-tight">
          Presensi Apel Terintegrasi
        </div>
      </div>
    </div>
  );
}

function SidebarLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const active = path === item.to || path.startsWith(item.to + "/");
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/60"
      }`}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}

function BottomLink({ item }: { item: NavItem }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const active = path === item.to || path.startsWith(item.to + "/");
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={`flex flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      <Icon className="h-5 w-5" />
      {item.label}
    </Link>
  );
}

function UserFooter({
  user,
}: {
  user: ReturnType<typeof useCurrentUser>;
}) {
  const navigate = useNavigate();
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }
  const initials = user.profile?.nama
    ?.split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  return (
    <div className="border-t border-sidebar-border/60 p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
          {initials ?? "?"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">
            {user.profile?.nama ?? user.email}
          </div>
          <div className="truncate text-[11px] text-muted-foreground capitalize">
            {user.role ?? "pegawai"}
          </div>
        </div>
        <button
          onClick={signOut}
          className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive"
          aria-label="Keluar"
          title="Keluar"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Register auth listener at module import time is not ideal; do it once at first render.
let _listenerBound = false;
export function useAuthRefresh() {
  useEffect(() => {
    if (_listenerBound) return;
    _listenerBound = true;
    supabase.auth.onAuthStateChange(() => {
      /* trigger re-render via useCurrentUser subscription */
    });
  }, []);
}
