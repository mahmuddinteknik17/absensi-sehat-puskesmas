import { auth, defineMcp } from "@lovable.dev/mcp-js";

import getMyProfile from "./tools/get-my-profile";
import listMyAttendance from "./tools/list-my-attendance";
import listHolidays from "./tools/list-holidays";
import listMyLeaves from "./tools/list-my-leaves";
import createLeave from "./tools/create-leave";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "absensi-sehat-puskesmas",
  title: "Absensi Sehat Puskesmas",
  version: "0.1.0",
  instructions:
    "Tools SIPASTI (presensi apel UPT Puskesmas Pasar Sabtu). Gunakan get_my_profile untuk data pegawai, list_my_attendance untuk riwayat absensi, list_holidays untuk hari libur, serta list_my_leaves dan create_leave untuk data cuti. Semua data terbatas pada pengguna yang masuk.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyProfile, listMyAttendance, listHolidays, listMyLeaves, createLeave],
});
