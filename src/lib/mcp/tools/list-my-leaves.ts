import { defineTool } from "@lovable.dev/mcp-js";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_leaves",
  title: "Hari cuti saya",
  description: "Daftar periode cuti yang sudah dicatat oleh pengguna yang sedang masuk.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("leaves")
      .select("id, tanggal_mulai, tanggal_selesai, keterangan")
      .eq("user_id", ctx.getUserId() ?? "")
      .order("tanggal_mulai", { ascending: false });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { rows: data ?? [] },
    };
  },
});
