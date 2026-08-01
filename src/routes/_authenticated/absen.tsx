import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import { MapPin, Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { haversineMeters, getCurrentPosition, deviceName, formatMeters, GeoError } from "@/lib/geo";
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
type OutReason = "tugas_luar" | "sakit" | "izin" | "bidan_desa";
const REASON_OPTIONS: { value: OutReason; label: string }[] = [
  { value: "tugas_luar", label: "Tugas Luar" },
  { value: "sakit", label: "Sakit" },
  { value: "izin", label: "Izin" },
  { value: "bidan_desa", label: "Bidan Desa" },
];

function AbsenPage() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [pos, setPos] = useState<Pos>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [locErr, setLocErr] = useState<string | null>(null);
  const [locHint, setLocHint] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const [outReason, setOutReason] = useState<OutReason>("tugas_luar");
  const [keterangan, setKeterangan] = useState("");

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

  const { data: leave } = useQuery({
    queryKey: ["my-leave", user.id, today],
    enabled: !!user.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("leaves")
        .select("*")
        .eq("user_id", user.id)
        .lte("tanggal_mulai", today)
        .gte("tanggal_selesai", today)
        .maybeSingle();
      return data;
    },
  });

  const dow = now.getDay(); // 0=Min ... 6=Sab
  const isApelDay = dow >= 1 && dow <= 4;
  const isHoliday = !!holiday;
  const onLeave = !!leave;
  const closed = !isApelDay || isHoliday || onLeave;

  useEffect(() => {
    if (closed) return;
    fetchLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closed]);

  async function fetchLocation() {
    setLocBusy(true);
    setLocErr(null);
    setLocHint(null);
    try {
      const p = await getCurrentPosition();
      setPos({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy });
    } catch (e) {
      setLocErr(e instanceof Error ? e.message : "Gagal mengambil lokasi");
      if (e instanceof GeoError && e.inIframe && (e.code === "denied" || e.code === "unavailable")) {
        setLocHint(
          "Anda sedang membuka aplikasi di dalam frame pratinjau. Buka aplikasi di tab browser baru agar izin lokasi dapat diberikan.",
        );
      }
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

  const alreadyAbsen = !!today_att;

  let blockReason: string | null = null;
  if (onLeave) blockReason = "Anda sedang menjalani cuti.";
  else if (!isApelDay)
    blockReason = "Absensi apel hanya dibuka pada hari Senin sampai Kamis.";
  else if (isHoliday) blockReason = `Hari ini merupakan hari libur (${holiday?.nama}).`;
  else if (alreadyAbsen) blockReason = "Anda sudah melakukan absensi hari ini.";
  else if (!jamBukaOK) blockReason = "Absensi belum dibuka.";
  else if (!jamTutupOK) blockReason = "Absensi telah ditutup.";
  else if (!pos) blockReason = "Menunggu lokasi GPS…";

  async function submit() {
    if (!pos || !settings || !user.id) return;
    setBusy(true);
    try {
      let status: "hadir" | "terlambat" | "izin" | "sakit";
      let ket: string | null = keterangan.trim() || null;
      if (!inRange) {
        if (outReason === "sakit") {
          status = "sakit";
          ket = ket ? `Sakit — ${ket}` : "Sakit";
        } else if (outReason === "izin") {
          status = "izin";
          ket = ket ? `Izin — ${ket}` : "Izin";
        } else if (outReason === "bidan_desa") {
          status = isLate ? "terlambat" : "hadir";
          ket = ket ? `Bidan Desa — ${ket}` : "Bidan Desa";
        } else {
          status = isLate ? "terlambat" : "hadir";
          ket = ket ? `Tugas Luar — ${ket}` : "Tugas Luar";
        }
      } else {
        status = isLate ? "terlambat" : "hadir";
      }
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
        keterangan: ket,
      });
      if (error) throw error;
      const msg = !inRange
        ? outReason === "sakit"
          ? "🩺 Absensi tercatat (Sakit)"
          : outReason === "izin"
            ? "📝 Absensi tercatat (Izin)"
            : outReason === "bidan_desa"
              ? "🏥 Absensi tercatat (Bidan Desa)"
              : "🚗 Absensi tercatat (Tugas Luar)"
        : status === "terlambat"
          ? "🟡 Absensi tercatat (Terlambat)"
          : "✅ Absensi berhasil";
      toast.success(msg);
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

      {closed ? (
        <div className="rounded-2xl border border-border/50 bg-card p-6 text-center shadow-[var(--shadow-soft)]">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-destructive/10">
            <XCircle className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-foreground">
            {onLeave ? "Anda sedang menjalani cuti." : isHoliday ? "Hari Libur" : "Absensi Apel Ditutup"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {onLeave
              ? `Berdasarkan data cuti yang telah Anda input (${format(parseISO(leave!.tanggal_mulai), "d MMM yyyy", { locale: idLocale })} – ${format(parseISO(leave!.tanggal_selesai), "d MMM yyyy", { locale: idLocale })}), Anda tidak diwajibkan mengikuti absensi apel pada tanggal ini.`
              : isHoliday
                ? `Hari ini merupakan hari libur${holiday?.nama ? ` (${holiday.nama})` : ""} yang telah ditetapkan oleh Admin. Absensi apel tidak dilaksanakan.`
                : "Hari ini tidak terdapat jadwal absensi apel. Absensi hanya dibuka pada hari Senin sampai Kamis."}
          </p>
        </div>
      ) : (
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
          {locBusy && !pos && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Mengambil lokasi GPS…
            </div>
          )}
          {locErr && (
            <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3">
              <div className="text-sm font-medium text-destructive">{locErr}</div>
              {locHint && <div className="mt-1 text-xs text-muted-foreground">{locHint}</div>}
              <button
                onClick={fetchLocation}
                disabled={locBusy}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Coba lagi
              </button>
            </div>
          )}
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

          {!inRange && !blockReason && !alreadyAbsen && pos && (
            <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="text-sm font-semibold text-foreground">
                Alasan berada di luar lokasi
              </div>
              <div className="mt-3 grid gap-2">
                {REASON_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      outReason === opt.value
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="outReason"
                      value={opt.value}
                      checked={outReason === opt.value}
                      onChange={() => setOutReason(opt.value)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="font-medium">{opt.label}</span>
                  </label>
                ))}
              </div>
              <textarea
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Keterangan tambahan (opsional)…"
                rows={2}
                className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

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
              {blockReason ??
                (!inRange
                  ? `Absen Sekarang (${REASON_OPTIONS.find((o) => o.value === outReason)?.label})`
                  : isLate
                    ? "Absen Sekarang (Terlambat)"
                    : "Absen Sekarang")}
            </button>
            {blockReason && (
              <div className="mt-2 text-center text-xs text-muted-foreground">{blockReason}</div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
