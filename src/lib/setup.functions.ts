import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const USERNAME_DOMAIN = "sipasti.local";
const usernameEmail = (u: string) => `${u.trim().toLowerCase()}@${USERNAME_DOMAIN}`;

// Public: only works if there are ZERO admin users. Used to bootstrap the first admin.
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        nip: z.string().trim().min(1).max(50),
        username: z
          .string()
          .trim()
          .toLowerCase()
          .min(3)
          .max(50)
          .regex(/^[a-z0-9._-]+$/),
        password: z.string().min(6).max(72),
        nama: z.string().trim().min(1).max(120),
        jabatan: z.string().trim().max(120).optional().nullable(),
        unit_kerja: z.string().trim().max(120).optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count, error: cErr } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) > 0) {
      throw new Error("Administrator sudah ada. Silakan hubungi admin untuk membuat akun.");
    }

    const { data: created, error: uErr } = await supabaseAdmin.auth.admin.createUser({
      email: usernameEmail(data.username),
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username, nama: data.nama, nip: data.nip },
    });
    if (uErr || !created.user) throw new Error(uErr?.message ?? "Gagal membuat pengguna.");
    const uid = created.user.id;

    const { error: pErr } = await supabaseAdmin.from("profiles").insert({
      id: uid,
      nip: data.nip,
      username: data.username,
      nama: data.nama,
      jabatan: data.jabatan ?? "Administrator",
      unit_kerja: data.unit_kerja ?? "UPT Puskesmas Pasar Sabtu",
    });
    if (pErr) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      throw new Error(pErr.message);
    }
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: "admin" });
    if (rErr) throw new Error(rErr.message);
    return { ok: true };
  });

export const adminExists = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  return { exists: (count ?? 0) > 0 };
});
