import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ShieldCheck, Loader2, Eye, EyeOff } from "lucide-react";
import logoAsset from "@/assets/logo-puskesmas.png.asset.json";

import { supabase } from "@/integrations/supabase/client";
import { usernameToEmail } from "@/lib/username";
import { adminExists, bootstrapAdmin } from "@/lib/setup.functions";

const searchSchema = z.object({
  redirect: z.string().optional(),
  setup: z.enum(["1"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (raw) => searchSchema.parse(raw),
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Masuk — SIPASTI" },
      {
        name: "description",
        content: "Masuk ke SIPASTI untuk melakukan absensi apel pegawai.",
      },
    ],
  }),
});

function AuthPage() {
  const search = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "setup">("login");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        navigate({ to: search.redirect ?? "/dashboard" });
        return;
      }
      const res = await adminExists();
      if (cancelled) return;
      if (!res.exists) setMode("setup");
      else if (search.setup === "1") setMode("setup");
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, search.redirect, search.setup]);

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-primary-soft">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-primary-soft">
      <div
        className="hidden lg:flex flex-col justify-between p-12 text-primary-foreground relative overflow-hidden"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="flex items-center gap-3 relative z-10">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white p-1">
            <img src={logoAsset.url} alt="Logo UPT Puskesmas Pasar Sabtu" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="text-lg font-bold">SIPASTI</div>
            <div className="text-xs opacity-80">Presensi Apel Terintegrasi</div>
          </div>
        </div>
        <div className="relative z-10 space-y-4">
          <h1 className="text-4xl font-extrabold leading-tight">
            Absensi apel pagi<br />lebih cepat & akurat.
          </h1>
          <p className="max-w-md text-white/85">
            Sistem informasi absensi berbasis lokasi untuk pegawai UPT Puskesmas Pasar Sabtu.
            Cukup satu ketukan, lokasi terverifikasi otomatis.
          </p>
          <div className="flex items-center gap-2 text-sm text-white/85">
            <ShieldCheck className="h-4 w-4" /> Verifikasi GPS &middot; Radius kantor &middot; Anti kecurangan
          </div>
        </div>
        <div className="text-xs opacity-70 relative z-10">
          &copy; {new Date().getFullYear()} UPT Puskesmas Pasar Sabtu
        </div>
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -top-20 -left-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Leaf className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-bold text-foreground">SIPASTI</div>
              <div className="text-xs text-muted-foreground">Presensi Apel Terintegrasi</div>
            </div>
          </div>
          {mode === "login" ? <LoginForm /> : <SetupForm onDone={() => setMode("login")} />}
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("sipasti.username") : null;
    if (saved) setUsername(saved);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(username),
        password,
      });
      if (error) throw error;
      if (remember) localStorage.setItem("sipasti.username", username);
      else localStorage.removeItem("sipasti.username");
      toast.success("Berhasil masuk");
      navigate({ to: search.redirect ?? "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal masuk");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-card p-8 shadow-[var(--shadow-card)] border border-border/60">
      <h2 className="text-2xl font-bold text-foreground">Selamat datang kembali</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Masuk dengan username & password Anda.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground">Username</label>
          <input
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="mis. admin"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Password</label>
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
              aria-label="Tampilkan/sembunyikan password"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-[color:var(--primary)]"
          />
          Ingat saya
        </label>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-all hover:brightness-105 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Masuk
        </button>
      </form>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Lupa password? Hubungi administrator instansi Anda.
      </p>
      <div className="mt-4 text-center">
        <Link to="/auth" search={{ setup: "1" }} className="text-xs text-primary hover:underline">
          Belum ada admin? Setup admin pertama
        </Link>
      </div>
    </div>
  );
}

function SetupForm({ onDone }: { onDone: () => void }) {
  const [nama, setNama] = useState("");
  const [nip, setNip] = useState("");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await bootstrapAdmin({
        data: {
          nama,
          nip,
          username,
          password,
          jabatan: "Administrator",
          unit_kerja: "UPT Puskesmas Pasar Sabtu",
        },
      });
      toast.success("Admin pertama berhasil dibuat. Silakan masuk.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal setup admin");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-card p-8 shadow-[var(--shadow-card)] border border-border/60">
      <h2 className="text-2xl font-bold text-foreground">Setup administrator</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Halaman ini hanya aktif jika belum ada administrator.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <Field label="Nama Lengkap" value={nama} onChange={setNama} required />
        <Field label="NIP" value={nip} onChange={setNip} required />
        <Field label="Username" value={username} onChange={setUsername} required />
        <Field
          label="Password (min. 6 karakter)"
          value={password}
          onChange={setPassword}
          type="password"
          required
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] hover:brightness-105 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Buat Admin
        </button>
      </form>
      <button
        onClick={onDone}
        className="mt-4 block w-full text-center text-xs text-primary hover:underline"
      >
        Kembali ke login
      </button>
    </div>
  );
}

function Field({
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
        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
