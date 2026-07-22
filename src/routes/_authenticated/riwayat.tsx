import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { statusLabel } from "./dashboard";

export const Route = createFileRoute("/_authenticated/riwayat")({
  component: RiwayatPage,
  head: () => ({
    meta: [
      { title: "Riwayat Absensi — SIPASTI" },
      { name: "description", content: "Riwayat absensi apel pegawai." },
    ],
  }),
});

function RiwayatPage() {
  const user = useCurrentUser();
  const now = new Date();
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahun, setTahun] = useState(now.getFullYear());
  const [pegawaiId, setPegawaiId] = useState<string>("all");
  const [q, setQ] = useState("");

  const from = `${tahun}-${String(bulan).padStart(2, "0")}-01`;
  const toDate = new Date(tahun, bulan, 0);
  const to = format(toDate, "yyyy-MM-dd");

  const isAdmin = user.role === "admin";

  const { data: pegawaiList } = useQuery({
    queryKey: ["pegawai-list"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nama, nip").order("nama");
      return data ?? [];
    },
  });

  const { data: rows } = useQuery({
    queryKey: ["riwayat", isAdmin, user.id, pegawaiId, from, to],
    enabled: !!user.id,
    queryFn: async () => {
      let query = supabase
        .from("attendance")
        .select("*, profiles!inner(nama, nip)")
        .gte("tanggal", from)
        .lte("tanggal", to)
        .order("tanggal", { ascending: false })
        .order("jam", { ascending: false });
      if (!isAdmin) query = query.eq("user_id", user.id);
      else if (pegawaiId !== "all") query = query.eq("user_id", pegawaiId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!q) return rows ?? [];
    const s = q.toLowerCase();
    return (rows ?? []).filter((r) => {
      const p = (r as unknown as { profiles?: { nama?: string; nip?: string } }).profiles;
      return (
        p?.nama?.toLowerCase().includes(s) ||
        p?.nip?.toLowerCase().includes(s) ||
        r.status.toLowerCase().includes(s)
      );
    });
  }, [rows, q]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">Riwayat Absensi</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? "Seluruh riwayat pegawai." : "Riwayat absensi Anda."}
        </p>
      </div>

      <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-soft)] border border-border/50">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Bulan</label>
            <select
              value={bulan}
              onChange={(e) => setBulan(Number(e.target.value))}
              className="mt-1 block rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {format(new Date(2000, m - 1, 1), "MMMM", { locale: idLocale })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Tahun</label>
            <select
              value={tahun}
              onChange={(e) => setTahun(Number(e.target.value))}
              className="mt-1 block rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          {isAdmin && (
            <div className="min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground">Pegawai</label>
              <select
                value={pegawaiId}
                onChange={(e) => setPegawaiId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">Semua pegawai</option>
                {pegawaiList?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama} — {p.nip}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="ml-auto min-w-[180px] flex-1">
            <label className="text-xs font-medium text-muted-foreground">Cari</label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nama, NIP, status…"
                className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-soft)] border border-border/50">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60 text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {isAdmin && <th className="px-4 py-3 text-left">Pegawai</th>}
                <th className="px-4 py-3 text-left">Tanggal</th>
                <th className="px-4 py-3 text-left">Jam</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Jarak</th>
                <th className="px-4 py-3 text-left">Lokasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-4 py-10 text-center text-muted-foreground">
                    Tidak ada data.
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const s = statusLabel(r.status);
                const p = (r as unknown as { profiles?: { nama?: string; nip?: string } }).profiles;
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{p?.nama}</div>
                        <div className="text-xs text-muted-foreground">{p?.nip}</div>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {format(parseISO(r.tanggal), "d MMM yyyy", { locale: idLocale })}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {format(parseISO(r.jam), "HH:mm:ss")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${s.tone}`}
                      >
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.jarak_meter != null ? `${Math.round(r.jarak_meter)} m` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.latitude && r.longitude ? (
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${r.latitude}&mlon=${r.longitude}#map=18/${r.latitude}/${r.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          Lihat peta
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
