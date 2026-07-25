import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { format, getDaysInMonth } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { FileSpreadsheet, Printer } from "lucide-react";
import ExcelJS from "exceljs";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const searchSchema = z.object({
  bulan: fallback(z.number().int(), new Date().getMonth() + 1).default(new Date().getMonth() + 1),
  tahun: fallback(z.number().int(), new Date().getFullYear()).default(new Date().getFullYear()),
  unit: fallback(z.string(), "all").default("all"),
});

export const Route = createFileRoute("/_authenticated/riwayat")({
  validateSearch: zodValidator(searchSchema),
  component: RiwayatPage,
  head: () => ({
    meta: [
      { title: "Rekap Absensi — SIPASTI" },
      { name: "description", content: "Rekap matriks absensi apel pagi pegawai." },
    ],
  }),
});

type Cell = {
  label: string;
  kind: "hadir" | "terlambat" | "sakit" | "izin" | "tugas_luar" | "cuti" | "alpha" | "libur" | "empty";
};

function cellFromAttendance(a: { status: string; keterangan: string | null }): Cell {
  const ket = (a.keterangan ?? "").toLowerCase();
  const isTugasLuar = ket.includes("tugas luar");
  if (a.status === "hadir")
    return isTugasLuar
      ? { label: "Tugas Luar", kind: "tugas_luar" }
      : { label: "Hadir", kind: "hadir" };
  if (a.status === "terlambat")
    return isTugasLuar
      ? { label: "Tugas Luar", kind: "tugas_luar" }
      : { label: "Terlambat", kind: "terlambat" };
  if (a.status === "sakit") return { label: "Sakit", kind: "sakit" };
  if (a.status === "izin")
    return ket.includes("cuti")
      ? { label: "Cuti", kind: "cuti" }
      : { label: "Izin", kind: "izin" };
  if (a.status === "libur") return { label: "Libur", kind: "libur" };
  if (a.status === "tidak_hadir") return { label: "Alpha", kind: "alpha" };
  return { label: "", kind: "empty" };
}

function cellTone(kind: Cell["kind"]): string {
  switch (kind) {
    case "hadir":
      return "text-emerald-700";
    case "terlambat":
      return "text-amber-700";
    case "sakit":
      return "text-purple-700";
    case "izin":
      return "text-blue-700";
    case "tugas_luar":
      return "text-cyan-700";
    case "cuti":
      return "text-indigo-700";
    case "alpha":
      return "text-red-700 font-semibold";
    case "libur":
      return "text-red-700";
    default:
      return "text-muted-foreground";
  }
}

function RiwayatPage() {
  const user = useCurrentUser();
  const { bulan, tahun, unit } = Route.useSearch();
  const navigate = useNavigate({ from: "/riwayat" });
  const printRef = useRef<HTMLDivElement>(null);

  const isAdmin = user.role === "admin";

  const from = `${tahun}-${String(bulan).padStart(2, "0")}-01`;
  const daysInMonth = getDaysInMonth(new Date(tahun, bulan - 1, 1));
  const to = `${tahun}-${String(bulan).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  const monthLabel = format(new Date(tahun, bulan - 1, 1), "MMMM yyyy", { locale: idLocale }).toUpperCase();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: pegawai } = useQuery({
    queryKey: ["pegawai-all"],
    enabled: !!user.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nama, nip, unit_kerja")
        .order("nama");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: attendance } = useQuery({
    queryKey: ["attendance-matrix", from, to],
    enabled: !!user.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("user_id, tanggal, status, keterangan")
        .gte("tanggal", from)
        .lte("tanggal", to);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: holidays } = useQuery({
    queryKey: ["holidays-range", from, to],
    enabled: !!user.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holidays")
        .select("tanggal, nama")
        .gte("tanggal", from)
        .lte("tanggal", to);
      if (error) throw error;
      return data ?? [];
    },
  });

  const units = useMemo(() => {
    const s = new Set<string>();
    (pegawai ?? []).forEach((p) => p.unit_kerja && s.add(p.unit_kerja));
    return Array.from(s).sort();
  }, [pegawai]);

  const filteredPegawai = useMemo(() => {
    let list = pegawai ?? [];
    if (!isAdmin) list = list.filter((p) => p.id === user.id);
    if (unit !== "all") list = list.filter((p) => p.unit_kerja === unit);
    return list;
  }, [pegawai, isAdmin, user.id, unit]);

  const holidayMap = useMemo(() => {
    const m = new Map<string, string>();
    (holidays ?? []).forEach((h) => m.set(h.tanggal, h.nama));
    return m;
  }, [holidays]);

  const attMap = useMemo(() => {
    const m = new Map<string, { status: string; keterangan: string | null }>();
    (attendance ?? []).forEach((a) => m.set(`${a.user_id}|${a.tanggal}`, a));
    return m;
  }, [attendance]);

  const dates = useMemo(
    () =>
      Array.from({ length: daysInMonth }, (_, i) => {
        const d = i + 1;
        const iso = `${tahun}-${String(bulan).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const dt = new Date(tahun, bulan - 1, d);
        const dow = dt.getDay(); // 0 sun 6 sat
        const isWeekend = dow === 0;
        const holidayName = holidayMap.get(iso);
        return { iso, d, header: `${String(d).padStart(2, "0")}/${String(bulan).padStart(2, "0")}`, isHoliday: !!holidayName || isWeekend, holidayName: holidayName ?? (isWeekend ? "Minggu" : undefined) };
      }),
    [daysInMonth, tahun, bulan, holidayMap],
  );

  function getCell(userId: string, iso: string, isHoliday: boolean): Cell {
    const a = attMap.get(`${userId}|${iso}`);
    if (a) return cellFromAttendance(a);
    if (isHoliday) return { label: "Libur", kind: "libur" };
    if (iso <= today) return { label: "Alpha", kind: "alpha" };
    return { label: "", kind: "empty" };
  }

  function exportExcel() {
    const header = ["No", "Nama Pegawai", ...dates.map((d) => d.header)];
    const rows = filteredPegawai.map((p, idx) => {
      const row: (string | number)[] = [idx + 1, p.nama];
      dates.forEach((d) => row.push(getCell(p.id, d.iso, d.isHoliday).label));
      return row;
    });
    const ws = XLSX.utils.aoa_to_sheet([
      [`REKAP DETAIL ABSENSI APEL PAGI - ${monthLabel}`],
      [],
      header,
      ...rows,
    ]);
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap");
    XLSX.writeFile(wb, `Rekap-Absensi-${monthLabel.replace(" ", "-")}.xlsx`);
  }

  function doPrint() {
    window.print();
  }

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #rekap-print, #rekap-print * { visibility: visible; }
          #rekap-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex flex-wrap items-start justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Rekap Absensi</h1>
          <p className="text-sm text-muted-foreground">
            Matriks kehadiran pegawai per bulan.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportExcel}
            disabled={filteredPegawai.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Excel
          </button>
          <button
            onClick={doPrint}
            disabled={filteredPegawai.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-soft)] border border-border/50 no-print">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Bulan</label>
            <select
              value={bulan}
              onChange={(e) =>
                navigate({ search: (p: Record<string, unknown>) => ({ ...p, bulan: Number(e.target.value) }) })
              }
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
              onChange={(e) =>
                navigate({ search: (p: Record<string, unknown>) => ({ ...p, tahun: Number(e.target.value) }) })
              }
              className="mt-1 block rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          {isAdmin && units.length > 0 && (
            <div className="min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground">Unit Kerja</label>
              <select
                value={unit}
                onChange={(e) =>
                  navigate({ search: (p: Record<string, unknown>) => ({ ...p, unit: e.target.value }) })
                }
                className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">Semua unit</option>
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div id="rekap-print" ref={printRef} className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-soft)] border border-border/50">
        <div className="bg-white px-4 py-3 border-b border-border/60">
          <h2 className="text-base font-extrabold text-foreground tracking-wide">
            REKAP DETAIL ABSENSI APEL PAGI - {monthLabel}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="bg-[#1e40af] text-white">
                <th className="sticky left-0 z-20 bg-[#1e40af] border border-blue-900 px-2 py-2 text-center w-12">
                  No
                </th>
                <th className="sticky left-12 z-20 bg-[#1e40af] border border-blue-900 px-3 py-2 text-left min-w-[220px]">
                  Nama Pegawai
                </th>
                {dates.map((d) => (
                  <th
                    key={d.iso}
                    title={d.holidayName ?? ""}
                    className={`border border-blue-900 px-2 py-2 text-center whitespace-nowrap min-w-[70px] ${
                      d.isHoliday ? "bg-red-600" : "bg-[#1e40af]"
                    }`}
                  >
                    {d.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPegawai.length === 0 && (
                <tr>
                  <td colSpan={dates.length + 2} className="px-4 py-10 text-center text-muted-foreground border border-border/60">
                    Belum ada data pegawai.
                  </td>
                </tr>
              )}
              {filteredPegawai.map((p, idx) => (
                <tr key={p.id} className="odd:bg-white even:bg-slate-50 hover:bg-primary-soft/40">
                  <td className="sticky left-0 z-10 bg-inherit border border-border/70 px-2 py-1.5 text-center text-foreground">
                    {idx + 1}
                  </td>
                  <td className="sticky left-12 z-10 bg-inherit border border-border/70 px-3 py-1.5 text-left font-medium text-foreground whitespace-nowrap">
                    {p.nama}
                  </td>
                  {dates.map((d) => {
                    const c = getCell(p.id, d.iso, d.isHoliday);
                    const bg = d.isHoliday ? "bg-red-500 text-white" : "";
                    return (
                      <td
                        key={d.iso}
                        className={`border border-border/70 px-2 py-1.5 text-center whitespace-nowrap ${bg} ${
                          !d.isHoliday ? cellTone(c.kind) : ""
                        }`}
                      >
                        {d.isHoliday && c.kind !== "hadir" && c.kind !== "terlambat" && c.kind !== "tugas_luar" ? "" : c.label}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
