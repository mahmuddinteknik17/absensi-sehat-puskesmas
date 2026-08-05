import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_leave",
  title: "Catat hari cuti",
  description: "Catat periode cuti baru untuk pengguna yang sedang masuk (tanggal format YYYY-MM-DD).",
  inputSchema: {
    tanggal_mulai: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    tanggal_selesai: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    keterangan: z.string().trim().max(300).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ tanggal_mulai, tanggal_selesai, keterangan }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    if (tanggal_selesai < tanggal_mulai) {
      return {
        content: [{ type: "text", text: "Tanggal selesai tidak boleh sebelum tanggal mulai." }],
        isError: true,
      };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("leaves")
      .insert({
        user_id: ctx.getUserId() ?? "",
        tanggal_mulai,
        tanggal_selesai,
        keterangan: keterangan ?? null,
      })
      .select()
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { row: data },
    };
  },
});
