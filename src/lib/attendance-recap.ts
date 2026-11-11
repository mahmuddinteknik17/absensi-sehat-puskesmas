export type RecapCellKind =
  | "hadir"
  | "terlambat"
  | "sakit"
  | "izin"
  | "tugas_luar"
  | "bidan_desa"
  | "cuti"
  | "alpha"
  | "libur"
  | "empty";

export type LeavePeriod = {
  user_id: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  jenis: string;
};

export function hasPeriodOnDate(
  periods: readonly LeavePeriod[],
  userId: string,
  isoDate: string,
  jenis: "cuti" | "sakit" | "tugas_luar",
): boolean {
  return periods.some(
    (item) =>
      item.user_id === userId &&
      item.tanggal_mulai <= isoDate &&
      item.tanggal_selesai >= isoDate &&
      item.jenis === jenis,
  );
}

export function getRecapStatusCode(kind: RecapCellKind): string {
  switch (kind) {
    case "hadir": return "H";
    case "terlambat": return "T";
    case "sakit": return "S";
    case "izin": return "I";
    case "tugas_luar": return "TL";
    case "bidan_desa": return "BD";
    case "cuti": return "CT";
    case "alpha": return "A";
    case "libur": return "L";
    default: return "";
  }
}