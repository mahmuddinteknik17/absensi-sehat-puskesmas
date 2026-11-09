import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format, parseISO, startOfMonth } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  Users,
  CheckCircle2,
  Clock,
  UserX,
  CalendarDays,
  TrendingUp,
  ImagePlus,
  Loader2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
      <ApelScheduleSection canManage />
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

      <ApelScheduleSection />
    </div>
  );
}

function ApelScheduleSection({ canManage = false }: { canManage?: boolean }) {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const { data: schedule, isLoading, isError } = useQuery({
    queryKey: ["apel-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apel_schedule")
        .select("id, image_path, file_name, updated_at")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: signedImage, error: signedError } = await supabase.storage
        .from("jadwal-apel")
        .createSignedUrl(data.image_path, 60 * 60);
      if (signedError) throw signedError;
      return { ...data, signedUrl: signedImage.signedUrl };
    },
  });

  const [uploading, setUploading] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  async function uploadSchedule(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Pilih file gambar untuk jadwal apel.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Ukuran foto maksimal 10 MB.");
      return;
    }
    if (!user.id) {
      toast.error("Sesi pengguna tidak ditemukan. Silakan masuk kembali.");
      return;
    }

    setUploading(true);
    const path = `current/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    try {
      const { error: uploadError } = await supabase.storage.from("jadwal-apel").upload(path, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { error: saveError } = await supabase.from("apel_schedule").upsert(
        {
          id: 1,
          image_path: path,
          file_name: file.name,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      if (saveError) {
        await supabase.storage.from("jadwal-apel").remove([path]);
        throw saveError;
      }

      const oldPath = schedule?.image_path;
      if (oldPath && oldPath !== path) {
        await supabase.storage.from("jadwal-apel").remove([oldPath]);
      }
      await queryClient.invalidateQueries({ queryKey: ["apel-schedule"] });
      toast.success("Foto jadwal petugas apel berhasil diperbarui.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengunggah foto jadwal.");
    } finally {
      setUploading(false);
      setInputKey((key) => key + 1);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Jadwal Petugas Apel</h2>
          {canManage && (
            <p className="mt-1 text-sm text-muted-foreground">Foto ini akan terlihat di dashboard semua pegawai.</p>
          )}
        </div>
        {canManage && (
          <Button asChild disabled={uploading}>
            <label className="cursor-pointer">
              {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
              {uploading ? "Mengunggah…" : schedule ? "Ganti Foto" : "Tambah Foto"}
              <input
                key={inputKey}
                type="file"
                accept="image/*"
                disabled={uploading}
                className="sr-only"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) void uploadSchedule(file);
                }}
              />
            </label>
          </Button>
        )}
      </div>
      <div className="p-4 sm:p-5">
        {isLoading ? (
          <div className="grid min-h-48 place-items-center text-primary">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        ) : isError ? (
          <p className="py-10 text-center text-sm text-destructive">Foto jadwal belum dapat dimuat. Silakan muat ulang halaman.</p>
        ) : schedule ? (
          <img
            src={schedule.signedUrl}
            alt={`Jadwal petugas apel: ${schedule.file_name}`}
            className="mx-auto max-h-[72vh] w-full rounded-lg bg-muted object-contain object-top"
          />
        ) : (
          <div className="grid min-h-48 place-items-center rounded-lg border border-dashed border-border bg-muted/30 px-5 text-center">
            <div>
              <ImagePlus className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-semibold text-foreground">Jadwal petugas apel belum tersedia</p>
              {canManage && <p className="mt-1 text-sm text-muted-foreground">Tambahkan foto jadwal agar tampil di dashboard pegawai.</p>}
            </div>
          </div>
        )}
      </div>
    </section>
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
