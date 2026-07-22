import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Plus, Trash2, Loader2, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export const Route = createFileRoute("/_authenticated/hari-libur")({
  component: HariLiburPage,
  head: () => ({
    meta: [
      { title: "Hari Libur — SIPASTI" },
      { name: "description", content: "Kelola daftar hari libur." },
    ],
  }),
});

function HariLiburPage() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  if (user.loading) return null;
  if (user.role !== "admin") throw redirect({ to: "/dashboard" });

  const { data: rows } = useQuery({
    queryKey: ["holidays"],
    queryFn: async () => {
      const { data, error } = await supabase.from("holidays").select("*").order("tanggal");
      if (error) throw error;
      return data;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("holidays").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Hari libur dihapus");
      qc.invalidateQueries({ queryKey: ["holidays"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Hari Libur</h1>
          <p className="text-sm text-muted-foreground">
            Absensi otomatis dinonaktifkan pada tanggal berikut.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] hover:brightness-105"
        >
          <Plus className="h-4 w-4" /> Tambah Hari Libur
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-soft)] border border-border/50">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60 text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Tanggal</th>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Keterangan</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    Belum ada hari libur.
                  </td>
                </tr>
              )}
              {rows?.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    {format(parseISO(r.tanggal), "EEEE, d MMMM yyyy", { locale: idLocale })}
                  </td>
                  <td className="px-4 py-3 font-medium">{r.nama}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.keterangan ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          if (confirm(`Hapus hari libur "${r.nama}"?`)) del.mutate(r.id);
                        }}
                        className="grid h-8 w-8 place-items-center rounded-md text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && <AddHolidayDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function AddHolidayDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    tanggal: format(new Date(), "yyyy-MM-dd"),
    nama: "",
    keterangan: "",
  });
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("holidays").insert(f);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Hari libur ditambahkan");
      qc.invalidateQueries({ queryKey: ["holidays"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Tambah Hari Libur</h3>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="text-sm font-medium">Tanggal</label>
            <input
              type="date"
              required
              value={f.tanggal}
              onChange={(e) => setF({ ...f, tanggal: e.target.value })}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Nama Hari Libur</label>
            <input
              type="text"
              required
              value={f.nama}
              onChange={(e) => setF({ ...f, nama: e.target.value })}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Keterangan</label>
            <textarea
              value={f.keterangan}
              onChange={(e) => setF({ ...f, keterangan: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            disabled={m.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {m.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan
          </button>
        </form>
      </div>
    </div>
  );
}
