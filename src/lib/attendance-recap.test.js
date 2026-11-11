import { describe, expect, it } from "bun:test";
import { getPeriodRecapType, getRecapStatusCode } from "./attendance-recap";

describe("Tugas Luar attendance recap", () => {
  it("recognizes each date inside a recorded Tugas Luar period", () => {
    const periods = [
      {
        user_id: "pegawai-1",
        tanggal_mulai: "2026-11-09",
        tanggal_selesai: "2026-11-12",
        jenis: "tugas_luar",
      },
    ];

    expect(getPeriodRecapType(periods, "pegawai-1", "2026-11-10")).toBe("tugas_luar");
    expect(getPeriodRecapType(periods, "pegawai-1", "2026-11-13")).toBeNull();
  });

  it("exports Tugas Luar with the TL status code", () => {
    expect(getRecapStatusCode("tugas_luar")).toBe("TL");
  });
});