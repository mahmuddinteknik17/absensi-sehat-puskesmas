import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import { MapPin, Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { haversineMeters, getCurrentPosition, deviceName, formatMeters } from "@/lib/geo";
import { statusLabel } from "./dashboard";

export const Route = createFileRoute("/_authenticated/absen")({
  component: AbsenPage,
  head: () => ({
    meta: [
      { title: "Absen — SIPASTI" },
      {
        name: "description",
        content: "Lakukan absensi apel berbasis lokasi (GPS).",
      },
    ],
  }),
});

type Pos = { lat: number; lng: number; acc: number } | null;

function AbsenPage() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [pos, setPos] = useState<Pos>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [locErr, setLocErr] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: today_att } = useQuery({
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

  const { data: holiday } = useQuery({
    queryKey: ["holiday", today],
    queryFn: async () => {
      const { data } = await supabase.from("holidays").select("*").eq("tanggal", today).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    fetchLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchLocation() {
    setLocBusy(true);
    setLocErr(null);
    try {
      const p = await getCurrentPosition();
      setPos({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy });
    } catch (e) {
      setLocErr(e instanceof Error ? e.message : "Gagal mengambil lokasi");
    } finally {
      setLocBusy(false);
    }
  }

  const distance =
    pos && settings
      ? haversineMeters(pos.lat, pos.lng, settings.office_lat, settings.office_lng)
      : null;
  const inRange = distance != null && settings ? distance <= settings.radius_meter : false;

  const jamNow = format(now, "HH:mm:ss");
  const [jamBukaOK, jamTutupOK, isLate] = (() => {
    if (!settings) return [false, false, false];
    const hhmm = format(now, "HH:mm");
    return [
      hhmm >= settings.jam_buka.slice(0, 5),
      hhmm <= settings.jam_tutup.slice(0, 5),
      hhmm > settings.batas_terlambat.slice(0, 5),
    ];
  })();

  const isHoliday = !!holiday;
  const alreadyAbsen = !!today_att;

  let blockReason: string | null = null;
  if (isHoliday) blockReason = `Hari ini merupakan hari libur (${holiday?.nama}).`;
  else if (alreadyAbsen) blockReason = "Anda sudah melakukan absensi hari ini.";
  else if (!jamBukaOK) blockReason = "Absensi belum dibuka.";
  else if (!jamTutupOK) blockReason = "Absensi telah ditutup.";
  else if (!pos) blockReason = "Menunggu lokasi GPS…";
  else if (!inRange) blockReason = "Anda berada di luar area absensi.";

  async function submit() {
    if (!pos || !settings || !user.id) return;
    setBusy(true);
    try {
      const status = isLate ? "terlambat" : "hadir";
      const { error } = await supabase.from("attendance").insert({
        user_id: user.id,
        tanggal: today,
        jam: new Date().toISOString(),
        status,
        latitude: pos.lat,
        longitude: pos.lng,
        akurasi: pos.acc,
        jarak_meter: distance ?? null,
        perangkat: deviceName(),
      });
      if (error) throw error;
      toast.success(status === "hadir" ? "✅ Absensi berhasil" : "🟡 Absensi tercatat (Terlambat)");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal absen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">Absensi Apel</h1>
        <p className="text-sm text-muted-foreground">
          {format(now, "EEEE, d MMMM yyyy", { locale: idLocale })}
        </p>
      </div>

      <div
        className="rounded-3xl p-6 text-primary-foreground shadow-[var(--shadow-card)]"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="text-xs opacity-90">Waktu sekarang</div>
        <div className="mt-1 text-5xl font-black tabular-nums tracking-tight">{jamNow}</div>
        {settings && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs opacity-90">
            <span>Buka: {settings.jam_buka.slice(0, 5)}</span>
            <span>·</span>
            <span>Tutup: {settings.jam_tutup.slice(0, 5)}</span>
            <span>·</span>
            <span>Batas hadir: {settings.batas_terlambat.slice(0, 5)}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-soft)] border border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <h2 className="text-base font-bold text-foreground">Lokasi Anda</h2>
            </div>
            <button
              onClick={fetchLocation}
              disabled={locBusy}
              className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
              aria-label="Perbarui lokasi"
            >
              {locBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
          </div>
          {locErr && <div className="mt-3 text-sm text-destructive">{locErr}</div>}
          {pos && settings && (
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Latitude</span>
                <span className="font-mono">{pos.lat.toFixed(6)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Longitude</span>
                <span className="font-mono">{pos.lng.toFixed(6)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Akurasi GPS</span>
                <span>±{Math.round(pos.acc)} m</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Jarak dari kantor</span>
                <span className="font-semibold">{formatMeters(distance ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Radius diperbolehkan</span>
                <span>{settings.radius_meter} m</span>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-soft)] border border-border/50 flex flex-col">
          <div className="flex items-center gap-2">
            {inRange ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
            <h2 className="text-base font-bold text-foreground">Status Area</h2>
          </div>
          <div
            className={`mt-3 rounded-xl p-4 ${
              inRange ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            }`}
          >
            <div className="text-sm font-semibold">
              {inRange ? "🟢 Berada di Area Kerja" : "🔴 Di Luar Area Kerja"}
            </div>
            {distance != null && settings && (
              <div className="mt-1 text-xs opacity-90">
                Lokasi Anda {Math.round(distance)} m dari kantor (radius {settings.radius_meter} m).
              </div>
            )}
          </div>

          <div className="mt-auto pt-5">
            {today_att && (
              <div className="mb-3 rounded-lg bg-muted/60 p-3 text-sm">
                Status hari ini:{" "}
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${statusLabel(today_att.status).tone}`}
                >
                  {statusLabel(today_att.status).label}
                </span>
                <div className="mt-1 text-xs text-muted-foreground">
                  Jam masuk: {format(parseISO(today_att.jam), "HH:mm:ss")}
                </div>
              </div>
            )}
            <button
              disabled={!!blockReason || busy}
              onClick={submit}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-soft)] transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {blockReason ?? (isLate ? "Absen Sekarang (Terlambat)" : "Absen Sekarang")}
            </button>
            {blockReason && (
              <div className="mt-2 text-center text-xs text-muted-foreground">{blockReason}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
