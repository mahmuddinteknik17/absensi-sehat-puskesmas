// Haversine distance in meters between two lat/lng pairs.
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // Earth radius (m)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatMeters(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

export class GeoError extends Error {
  code: "unsupported" | "insecure" | "denied" | "unavailable" | "timeout" | "unknown";
  inIframe: boolean;
  constructor(code: GeoError["code"], message: string) {
    super(message);
    this.code = code;
    this.inIframe = typeof window !== "undefined" && window.self !== window.top;
  }
}

function rawGetPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function mapError(err: unknown): GeoError {
  const e = err as GeolocationPositionError | undefined;
  if (e && typeof e.code === "number") {
    if (e.code === 1)
      return new GeoError(
        "denied",
        "Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini di pengaturan browser, lalu coba lagi.",
      );
    if (e.code === 2)
      return new GeoError(
        "unavailable",
        "Lokasi tidak tersedia. Pastikan GPS/Location aktif dan Anda tidak berada di area tanpa sinyal.",
      );
    if (e.code === 3)
      return new GeoError("timeout", "Waktu pengambilan lokasi habis. Coba tekan tombol perbarui lagi.");
  }
  return new GeoError("unknown", "Gagal mengambil lokasi. Silakan coba lagi.");
}

export async function getCurrentPosition(
  options: PositionOptions = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
): Promise<GeolocationPosition> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new GeoError("unsupported", "Perangkat/browser ini tidak mendukung GPS.");
  }
  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw new GeoError(
      "insecure",
      "Lokasi hanya bisa diakses melalui koneksi aman (HTTPS). Buka aplikasi lewat alamat https://.",
    );
  }
  try {
    return await rawGetPosition(options);
  } catch (err) {
    const mapped = mapError(err);
    // Retry sekali dengan akurasi rendah + cache: sering berhasil saat GPS lambat/terhalang.
    if (mapped.code === "timeout" || mapped.code === "unavailable") {
      try {
        return await rawGetPosition({
          enableHighAccuracy: false,
          timeout: 25000,
          maximumAge: 120000,
        });
      } catch (err2) {
        throw mapError(err2);
      }
    }
    throw mapped;
  }
}


export function deviceName(): string {
  if (typeof navigator === "undefined") return "Unknown";
  const ua = navigator.userAgent;
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData?.platform;
  return platform ?? ua.slice(0, 120);
}
