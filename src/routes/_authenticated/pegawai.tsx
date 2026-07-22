import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Edit, Trash2, KeyRound, Loader2, X, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  createPegawai,
  updatePegawai,
  deletePegawai,
  resetPassword,
} from "@/lib/pegawai.functions";

export const Route = createFileRoute("/_authenticated/pegawai")({
  component: PegawaiPage,
  head: () => ({
    meta: [
      { title: "Master Pegawai — SIPASTI" },
      { name: "description", content: "Kelola data pegawai UPT Puskesmas Pasar Sabtu." },
    ],
  }),
});

type Row = {
  id: string;
  nip: string;
  username: string;
  nama: string;
  jabatan: string | null;
  unit_kerja: string | null;
  role?: "admin" | "pegawai";
};

function PegawaiPage() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [resetFor, setResetFor] = useState<Row | null>(null);

  if (user.loading) return null;
  if (user.role !== "admin") {
    throw redirect({ to: "/dashboard" });
  }

  const { data: rows } = useQuery({
    queryKey: ["pegawai", q],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("nama");
      if (error) throw error;
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]) ?? []);
      const all: Row[] = profiles.map((p) => ({ ...p, role: roleMap.get(p.id) }));
      if (!q) return all;
      const s = q.toLowerCase();
      return all.filter(
        (r) =>
          r.nama.toLowerCase().includes(s) ||
          r.nip.toLowerCase().includes(s) ||
          r.username.toLowerCase().includes(s),
      );
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => deletePegawai({ data: { id } }),
    onSuccess: () => {
      toast.success("Pegawai dihapus");
      qc.invalidateQueries({ queryKey: ["pegawai"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Master Pegawai</h1>
          <p className="text-sm text-muted-foreground">Kelola akun dan data pegawai.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] hover:brightness-105"
        >
          <Plus className="h-4 w-4" /> Tambah Pegawai
        </button>
      </div>

      <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-soft)] border border-border/50">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama, NIP, username…"
            className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-soft)] border border-border/50">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60 text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">NIP</th>
                <th className="px-4 py-3 text-left">Username</th>
                <th className="px-4 py-3 text-left">Jabatan</th>
                <th className="px-4 py-3 text-left">Unit Kerja</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Belum ada data pegawai.
                  </td>
                </tr>
              )}
              {rows?.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{r.nama}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.nip}</td>
                  <td className="px-4 py-3">{r.username}</td>
                  <td className="px-4 py-3">{r.jabatan ?? "—"}</td>
                  <td className="px-4 py-3">{r.unit_kerja ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        r.role === "admin"
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.role ?? "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setResetFor(r)}
                        className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                        title="Reset password"
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditing(r)}
                        className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Hapus pegawai "${r.nama}"? Tindakan ini permanen.`))
                            del.mutate(r.id);
                        }}
                        className="grid h-8 w-8 place-items-center rounded-md text-destructive hover:bg-destructive/10"
                        title="Hapus"
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

      {showAdd && <AddDialog onClose={() => setShowAdd(false)} />}
      {editing && <EditDialog row={editing} onClose={() => setEditing(null)} />}
      {resetFor && <ResetDialog row={resetFor} onClose={() => setResetFor(null)} />}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    nama: "",
    nip: "",
    username: "",
    password: "",
    jabatan: "",
    unit_kerja: "UPT Puskesmas Pasar Sabtu",
    role: "pegawai" as "admin" | "pegawai",
  });
  const m = useMutation({
    mutationFn: async () => createPegawai({ data: f }),
    onSuccess: () => {
      toast.success("Pegawai ditambahkan");
      qc.invalidateQueries({ queryKey: ["pegawai"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });
  return (
    <Modal title="Tambah Pegawai" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
        className="space-y-3"
      >
        <Input label="Nama Lengkap" value={f.nama} onChange={(v) => setF({ ...f, nama: v })} required />
        <Input label="NIP" value={f.nip} onChange={(v) => setF({ ...f, nip: v })} required />
        <Input label="Username" value={f.username} onChange={(v) => setF({ ...f, username: v })} required />
        <Input
          label="Password"
          type="password"
          value={f.password}
          onChange={(v) => setF({ ...f, password: v })}
          required
        />
        <Input label="Jabatan" value={f.jabatan} onChange={(v) => setF({ ...f, jabatan: v })} />
        <Input label="Unit Kerja" value={f.unit_kerja} onChange={(v) => setF({ ...f, unit_kerja: v })} />
        <div>
          <label className="text-sm font-medium text-foreground">Role</label>
          <select
            value={f.role}
            onChange={(e) => setF({ ...f, role: e.target.value as "admin" | "pegawai" })}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="pegawai">Pegawai</option>
            <option value="admin">Administrator</option>
          </select>
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
    </Modal>
  );
}

function EditDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    id: row.id,
    nip: row.nip,
    nama: row.nama,
    jabatan: row.jabatan ?? "",
    unit_kerja: row.unit_kerja ?? "",
    role: (row.role ?? "pegawai") as "admin" | "pegawai",
  });
  const m = useMutation({
    mutationFn: async () => updatePegawai({ data: f }),
    onSuccess: () => {
      toast.success("Data diperbarui");
      qc.invalidateQueries({ queryKey: ["pegawai"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });
  return (
    <Modal title="Edit Pegawai" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
        className="space-y-3"
      >
        <Input label="Nama Lengkap" value={f.nama} onChange={(v) => setF({ ...f, nama: v })} required />
        <Input label="NIP" value={f.nip} onChange={(v) => setF({ ...f, nip: v })} required />
        <Input label="Jabatan" value={f.jabatan} onChange={(v) => setF({ ...f, jabatan: v })} />
        <Input label="Unit Kerja" value={f.unit_kerja} onChange={(v) => setF({ ...f, unit_kerja: v })} />
        <div>
          <label className="text-sm font-medium text-foreground">Role</label>
          <select
            value={f.role}
            onChange={(e) => setF({ ...f, role: e.target.value as "admin" | "pegawai" })}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="pegawai">Pegawai</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={m.isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {m.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Simpan Perubahan
        </button>
      </form>
    </Modal>
  );
}

function ResetDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const [pwd, setPwd] = useState("");
  const m = useMutation({
    mutationFn: async () => resetPassword({ data: { id: row.id, password: pwd } }),
    onSuccess: () => {
      toast.success("Password direset");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });
  return (
    <Modal title={`Reset Password: ${row.nama}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
        className="space-y-3"
      >
        <Input label="Password Baru" type="password" value={pwd} onChange={setPwd} required />
        <button
          type="submit"
          disabled={m.isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {m.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Simpan Password
        </button>
      </form>
    </Modal>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-foreground">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
