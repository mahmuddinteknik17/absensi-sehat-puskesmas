import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { BriefcaseBusiness, Loader2, Plus, Trash2, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export const Route = createFileRoute("/_authenticated/tugas-luar")({
  component: TugasLuarPage,
  head: () => ({
    meta: [
      { title: "Tugas Luar — SIPASTI" },
      {
        name: "description",
        content:
          "Catat Tugas Luar pegawai agar sistem absensi apel mengetahui pegawai tidak wajib absen.",
      },
      { property: "og:title", content: "Tugas Luar — SIPASTI" },
      {
        property: "og:description",
        content: "Pencatatan Tugas Luar pegawai pada sistem absensi apel SIPASTI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type TugasLuarRow = {
  id: string;
  user_id: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  keterangan: string | null;
};

function TugasLuarPage() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const isAdmin = user.role === "admin";

  const { data: periods, isLoading } = useQuery({
    queryKey: ["tugas-luar-periods", isAdmin ? "all" : user.id],
    enabled: !user.loading && !!user.id,
    queryFn: async () => {
      let q = supabase
        .from("leaves")
        .select("id,user_id,tanggal_mulai,tanggal_selesai,keterangan")
        .eq("jenis", "tugas_luar")
        .order("tanggal_mulai", { ascending: false });
      if (!isAdmin) q = q.eq("user_id", user.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as TugasLuarRow[];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles-min"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,nama,nip");
      if (error) throw error;
      return data ?? [];
    },
  });

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    (profiles ?? []).forEach((p) => m.set(p.id, p.nama));
    return m;
  }, [profiles]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leaves").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Data Tugas Luar dihapus");
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal menghapus"),
  });

  if (user.loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Tugas Luar</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Referensi data sakit seluruh pegawai. Pegawai yang tercatat sakit tidak diwajibkan absen apel."
              : "Catat Tugas Luar Anda agar tidak diwajibkan absen apel pada tanggal tersebut."}
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] hover:brightness-105"
        >
          <Plus className="h-4 w-4" /> Tambah Tugas Luar
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-[var(--shadow-soft)]">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60 text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {isAdmin && <th className="px-4 py-3 text-left">Pegawai</th>}
                <th className="px-4 py-3 text-left">Mulai</th>
                <th className="px-4 py-3 text-left">Selesai</th>
                <th className="px-4 py-3 text-left">Lama</th>
                <th className="px-4 py-3 text-left">Keterangan</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-muted-foreground">
                    Memuat…
                  </td>
                </tr>
              )}
              {!isLoading && (periods ?? []).length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-4 py-10 text-center text-muted-foreground">
                    Belum ada data Tugas Luar.
                  </td>
                </tr>
              )}
              {(periods ?? []).map((r) => {
                const days =
                  differenceInCalendarDays(parseISO(r.tanggal_selesai), parseISO(r.tanggal_mulai)) + 1;
                const mine = r.user_id === user.id;
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    {isAdmin && (
                      <td className="px-4 py-3 font-medium">
                        {nameById.get(r.user_id) ?? (mine ? user.profile?.nama : "—")}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {format(parseISO(r.tanggal_mulai), "d MMM yyyy", { locale: idLocale })}
                    </td>
                    <td className="px-4 py-3">
                      {format(parseISO(r.tanggal_selesai), "d MMM yyyy", { locale: idLocale })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        {days} hari
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.keterangan ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {mine ? (
                        <button
                          onClick={() => del.mutate(r.id)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Hapus"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {open && <TugasLuarForm userId={user.id} onClose={() => setOpen(false)} />}
    </div>
  );
}

function TugasLuarForm({ userId, onClose }: { userId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [mulai, setMulai] = useState(today);
  const [selesai, setSelesai] = useState(today);
  const [keterangan, setKeterangan] = useState("");

  const valid = mulai && selesai && selesai >= mulai;
  const lama = valid ? differenceInCalendarDays(parseISO(selesai), parseISO(mulai)) + 1 : 0;

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leaves").insert({
        user_id: userId,
        jenis: "tugas_luar",
        tanggal_mulai: mulai,
        tanggal_selesai: selesai,
        keterangan: keterangan.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tugas Luar tersimpan");
      qc.invalidateQueries();
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal menyimpan"),
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BriefcaseBusiness className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold">Tambah Tugas Luar</h2>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Tanggal Mulai Tugas Luar</span>
            <input
              type="date"
              value={mulai}
              onChange={(e) => setMulai(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Tanggal Selesai Tugas Luar</span>
            <input
              type="date"
              value={selesai}
              min={mulai}
              onChange={(e) => setSelesai(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
            Lama Tugas Luar:{" "}
            <span className="font-bold text-foreground">{valid ? `${lama} hari` : "—"}</span>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Keterangan (opsional)</span>
            <input
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              maxLength={200}
              placeholder="Lokasi atau keterangan tugas (opsional)…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          {!valid && (
            <p className="text-xs text-destructive">
              Tanggal selesai tidak boleh lebih awal dari tanggal mulai.
            </p>
          )}
        </div>

        <button
          disabled={!valid || save.isPending}
          onClick={() => save.mutate()}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Simpan Tugas Luar
        </button>
      </div>
    </div>
  );
}
