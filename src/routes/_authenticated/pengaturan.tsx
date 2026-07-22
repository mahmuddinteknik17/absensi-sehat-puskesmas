import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, MapPin, Save, ExternalLink, Crosshair } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getCurrentPosition } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/pengaturan")({
  component: PengaturanPage,
  head: () => ({
    meta: [
      { title: "Pengaturan — SIPASTI" },
      { name: "description", content: "Pengaturan lokasi kantor, radius, dan jam absensi." },
    ],
  }),
});

function PengaturanPage() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  if (user.loading) return null;
  if (user.role !== "admin") throw redirect({ to: "/dashboard" });

  const { data: s } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });

  const [f, setF] = useState({
    nama_instansi: "",
    alamat: "",
    office_lat: 0,
    office_lng: 0,
    radius_meter: 100,
    jam_buka: "07:00",
    jam_tutup: "07:30",
    batas_terlambat: "07:10",
  });

  useEffect(() => {
    if (!s) return;
    setF({
      nama_instansi: s.nama_instansi ?? "",
      alamat: s.alamat ?? "",
      office_lat: s.office_lat,
      office_lng: s.office_lng,
      radius_meter: s.radius_meter,
      jam_buka: s.jam_buka.slice(0, 5),
      jam_tutup: s.jam_tutup.slice(0, 5),
      batas_terlambat: s.batas_terlambat.slice(0, 5),
    });
  }, [s]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("settings").update(f).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pengaturan disimpan");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });

  async function pickCurrent() {
    try {
      const p = await getCurrentPosition();
      setF((prev) => ({
        ...prev,
        office_lat: p.coords.latitude,
        office_lng: p.coords.longitude,
      }));
      toast.success("Koordinat diperbarui dari lokasi Anda saat ini");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal ambil lokasi");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">Pengaturan</h1>
        <p className="text-sm text-muted-foreground">
          Atur identitas instansi, lokasi kantor, radius, dan jam absensi.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="grid gap-5 lg:grid-cols-2"
      >
        <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-soft)] border border-border/50 space-y-4">
          <h2 className="text-base font-bold">Identitas Instansi</h2>
          <Field label="Nama Instansi" value={f.nama_instansi} onChange={(v) => setF({ ...f, nama_instansi: v })} />
          <Field label="Alamat" value={f.alamat} onChange={(v) => setF({ ...f, alamat: v })} />
        </div>

        <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-soft)] border border-border/50 space-y-4">
          <h2 className="text-base font-bold">Jam Absensi</h2>
          <div className="grid grid-cols-3 gap-3">
            <TimeField label="Jam Buka" value={f.jam_buka} onChange={(v) => setF({ ...f, jam_buka: v })} />
            <TimeField
              label="Batas Hadir"
              value={f.batas_terlambat}
              onChange={(v) => setF({ ...f, batas_terlambat: v })}
            />
            <TimeField label="Jam Tutup" value={f.jam_tutup} onChange={(v) => setF({ ...f, jam_tutup: v })} />
          </div>
          <p className="text-xs text-muted-foreground">
            Absen sebelum "Batas Hadir" dihitung <b>Hadir</b>. Setelahnya s/d jam tutup dihitung{" "}
            <b>Terlambat</b>.
          </p>
        </div>

        <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-soft)] border border-border/50 space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" /> Lokasi Kantor
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={pickCurrent}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                <Crosshair className="h-3.5 w-3.5" /> Gunakan lokasi saat ini
              </button>
              <a
                href={`https://www.openstreetmap.org/?mlat=${f.office_lat}&mlon=${f.office_lng}#map=18/${f.office_lat}/${f.office_lng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Lihat di Peta
              </a>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <NumberField
              label="Latitude"
              value={f.office_lat}
              step={0.000001}
              onChange={(v) => setF({ ...f, office_lat: v })}
            />
            <NumberField
              label="Longitude"
              value={f.office_lng}
              step={0.000001}
              onChange={(v) => setF({ ...f, office_lng: v })}
            />
            <div>
              <label className="text-sm font-medium">Radius Absensi (meter)</label>
              <select
                value={f.radius_meter}
                onChange={(e) => setF({ ...f, radius_meter: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {[50, 100, 150, 200, 300, 500].map((r) => (
                  <option key={r} value={r}>
                    {r} m
                  </option>
                ))}
              </select>
            </div>
          </div>
          <ClientMap lat={f.office_lat} lng={f.office_lng} radius={f.radius_meter} />
        </div>

        <div className="lg:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={save.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] hover:brightness-105 disabled:opacity-60"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan Pengaturan
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

function ClientMap({ lat, lng, radius }: { lat: number; lng: number; radius: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markerRef = useRef<unknown>(null);
  const circleRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = (L.map as any)(ref.current).setView([lat, lng], 16);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      markerRef.current = L.marker([lat, lng]).addTo(map);
      circleRef.current = L.circle([lat, lng], {
        radius,
        color: "#16a34a",
        fillColor: "#16a34a",
        fillOpacity: 0.15,
      }).addTo(map);
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = mapRef.current as any;
      if (m) m.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = mapRef.current as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const marker = markerRef.current as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const circle = circleRef.current as any;
    if (!m || !marker || !circle) return;
    marker.setLatLng([lat, lng]);
    circle.setLatLng([lat, lng]);
    circle.setRadius(radius);
    m.setView([lat, lng]);
  }, [lat, lng, radius]);

  return (
    <div className="h-72 w-full overflow-hidden rounded-xl border border-border" ref={ref} />
  );
}
