import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/logo-puskesmas.png.asset.json";

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

function oauthApi(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { redirect: next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="grid min-h-screen place-items-center bg-primary-soft px-4">
      <div className="max-w-md rounded-2xl bg-card p-6 text-center shadow-[var(--shadow-soft)]">
        <h1 className="text-lg font-bold text-foreground">Permintaan tidak dapat dimuat</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {String((error as Error)?.message ?? error)}
        </p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData() as any;
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "Aplikasi";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauthApi().approveAuthorization(authorization_id)
      : await oauthApi().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Server otorisasi tidak mengembalikan alamat pengalihan.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="grid min-h-screen place-items-center bg-primary-soft px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-border">
            <img src={logoAsset.url} alt="Logo UPT Puskesmas Pasar Sabtu" className="h-10 w-10 object-contain" />
          </div>
          <div>
            <div className="text-sm font-extrabold">SIPASTI</div>
            <div className="text-[11px] text-muted-foreground">Presensi Apel Terintegrasi</div>
          </div>
        </div>

        <h1 className="mt-6 text-lg font-bold text-foreground">
          Hubungkan {clientName} ke akun Anda?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {clientName} akan dapat membaca profil, riwayat absensi, hari libur, dan mencatat cuti
          atas nama Anda.
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Izinkan
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-semibold text-foreground disabled:opacity-60"
          >
            Tolak
          </button>
        </div>
      </div>
    </main>
  );
}
