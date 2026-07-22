import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, startOfMonth } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  Users,
  CheckCircle2,
  Clock,
  UserX,
  CalendarDays,
  MapPin,
  TrendingUp,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard — SIPASTI" },
      { name: "description", content: "Ringkasan kehadiran apel pegawai." },
    ],
  }),
});

function DashboardPage() {
  const user = useCurrentUser();
  return user.role === "admin" ? <AdminDashboard /> : <PegawaiDashboard />;
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "primary",
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  tone?: "primary" | "success" | "warning" | "destructive";
}) {
  const toneClass = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning-foreground",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];
  return (
    <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-soft)] border border-border/50">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="mt-1 text-3xl font-extrabold text-foreground">{value}</div>
        </div>
        <div className={`grid h-11 w-11 place-items-center rounded-xl ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: stats } = useQuery({
    queryKey: ["admin-stats", today],
    queryFn: async () => {
      const [{ count: total }, todayRows, holiday] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("attendance").select("status").eq("tanggal", today),
        supabase.from("holidays").select("*").gte("tanggal", today).order("tanggal").limit(1),
      ]);
      const hadir = todayRows.data?.filter((r) => r.status === "hadir").length ?? 0;
      const terlambat = todayRows.data?.filter((r) => r.status === "terlambat").length ?? 0;
      const belum = (total ?? 0) - hadir - terlambat;
      return {
        total: total ?? 0,
        hadir,
        terlambat,
        belum: Math.max(0, belum),
        nextHoliday: holiday.data?.[0],
      };
    },
  });

  const { data: chart } = useQuery({
    queryKey: ["admin-chart-month"],
    queryFn: async () => {
      const from = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const { data } = await supabase
        .from("attendance")
        .select("tanggal, status")
        .gte("tanggal", from)
        .order("tanggal");
      const map = new Map<string, { hadir: number; terlambat: number }>();
      (data ?? []).forEach((r) => {
        const key = r.tanggal;
        const cur = map.get(key) ?? { hadir: 0, terlambat: 0 };
        if (r.status === "hadir") cur.hadir++;
        else if (r.status === "terlambat") cur.terlambat++;
        map.set(key, cur);
      });
      return Array.from(map.entries())
        .map(([tanggal, v]) => ({
          tanggal: format(parseISO(tanggal), "d MMM", { locale: idLocale }),
          ...v,
        }))
        .slice(-14);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Dashboard Administrator</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, d MMMM yyyy", { locale: idLocale })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={Users} label="Jumlah Pegawai" value={stats?.total ?? "—"} />
        <StatCard icon={CheckCircle2} label="Hadir Hari Ini" value={stats?.hadir ?? "—"} tone="success" />
        <StatCard icon={Clock} label="Terlambat" value={stats?.terlambat ?? "—"} tone="warning" />
        <StatCard icon={UserX} label="Belum Absen" value={stats?.belum ?? "—"} tone="destructive" />
        <StatCard
          icon={CalendarDays}
          label="Libur Berikutnya"
          value={
            stats?.nextHoliday
              ? format(parseISO(stats.nextHoliday.tanggal), "d MMM", { locale: idLocale })
              : "—"
          }
        />
      </div>

      <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-soft)] border border-border/50">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">Grafik Kehadiran 14 Hari Terakhir</h2>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <BarChart data={chart ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="tanggal" fontSize={11} stroke="var(--muted-foreground)" />
              <YAxis fontSize={11} stroke="var(--muted-foreground)" />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="hadir" name="Hadir" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              <Bar
                dataKey="terlambat"
                name="Terlambat"
                fill="var(--warning)"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function PegawaiDashboard() {
  const user = useCurrentUser();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: attToday } = useQuery({
    queryKey: ["me-today", user.id, today],
    enabled: !!user.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .eq("tanggal", today)
        .maybeSingle();
      return data;
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["me-recent", user.id],
    enabled: !!user.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .order("tanggal", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const statusPill = attToday
    ? statusLabel(attToday.status)
    : { label: "Belum Absen", tone: "bg-muted text-muted-foreground" };

  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl p-6 text-primary-foreground shadow-[var(--shadow-card)]"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="text-sm opacity-90">Selamat datang,</div>
        <div className="mt-1 text-2xl font-extrabold">{user.profile?.nama ?? "-"}</div>
        <div className="mt-1 text-sm opacity-90">
          {user.profile?.jabatan ?? "-"} · {user.profile?.unit_kerja ?? "-"}
        </div>
        <div className="mt-4 text-xs opacity-80">
          {format(new Date(), "EEEE, d MMMM yyyy", { locale: idLocale })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-soft)] border border-border/50">
          <div className="text-xs font-medium text-muted-foreground">Status Hari Ini</div>
          <div className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusPill.tone}`}>
            {statusPill.label}
          </div>
        </div>
        <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-soft)] border border-border/50">
          <div className="text-xs font-medium text-muted-foreground">Jam Masuk</div>
          <div className="mt-1 text-2xl font-bold text-foreground">
            {attToday ? format(parseISO(attToday.jam), "HH:mm") : "—"}
          </div>
        </div>
        <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-soft)] border border-border/50">
          <div className="text-xs font-medium text-muted-foreground">Jarak dari Kantor</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-foreground">
              {attToday?.jarak_meter != null ? Math.round(attToday.jarak_meter) : "—"}
            </span>
            <span className="text-xs text-muted-foreground">m</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-soft)] border border-border/50">
        <div className="mb-4 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">Riwayat Terakhir</h2>
        </div>
        {(!recent || recent.length === 0) && (
          <div className="text-sm text-muted-foreground">Belum ada riwayat absensi.</div>
        )}
        <ul className="divide-y divide-border/60">
          {recent?.map((r) => {
            const s = statusLabel(r.status);
            return (
              <li key={r.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {format(parseISO(r.tanggal), "EEEE, d MMM yyyy", { locale: idLocale })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(parseISO(r.jam), "HH:mm")} ·{" "}
                    {r.jarak_meter != null ? `${Math.round(r.jarak_meter)} m` : "—"}
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.tone}`}>
                  {s.label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function statusLabel(status: string): { label: string; tone: string } {
  switch (status) {
    case "hadir":
      return { label: "🟢 Hadir", tone: "bg-success/15 text-success" };
    case "terlambat":
      return { label: "🟡 Terlambat", tone: "bg-warning/25 text-warning-foreground" };
    case "tidak_hadir":
      return { label: "🔴 Tidak Hadir", tone: "bg-destructive/15 text-destructive" };
    case "libur":
      return { label: "⚪ Libur", tone: "bg-muted text-muted-foreground" };
    case "izin":
      return { label: "🔵 Izin", tone: "bg-blue-100 text-blue-700" };
    case "sakit":
      return { label: "🟣 Sakit", tone: "bg-purple-100 text-purple-700" };
    default:
      return { label: status, tone: "bg-muted text-muted-foreground" };
  }
}
