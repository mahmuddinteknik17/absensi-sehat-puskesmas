import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_attendance",
  title: "Riwayat absensi saya",
  description:
    "Daftar riwayat absensi apel pengguna yang sedang masuk pada rentang tanggal tertentu (format YYYY-MM-DD).",
  inputSchema: {
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Tanggal mulai, YYYY-MM-DD"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Tanggal akhir, YYYY-MM-DD"),
    limit: z.number().int().min(1).max(200).default(100),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("attendance")
      .select("tanggal, jam, status, keterangan, jarak_meter")
      .eq("user_id", ctx.getUserId() ?? "")
      .gte("tanggal", from)
      .lte("tanggal", to)
      .order("tanggal", { ascending: false })
      .limit(limit);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { rows: data ?? [] },
    };
  },
});
