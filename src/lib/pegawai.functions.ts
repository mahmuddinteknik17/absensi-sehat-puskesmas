import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const USERNAME_DOMAIN = "sipasti.local";
const usernameEmail = (u: string) => `${u.trim().toLowerCase()}@${USERNAME_DOMAIN}`;

async function assertAdmin(context: {
  supabase: Awaited<ReturnType<typeof requireSupabaseAuth extends never ? never : never>>;
  userId: string;
}) {
  const { data, error } = await (context.supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: boolean | null; error: unknown }>;
  }).rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !data) throw new Error("Akses ditolak: hanya administrator.");
}

const CreatePegawaiSchema = z.object({
  nip: z.string().trim().min(1, "NIP wajib diisi").max(50),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Username minimal 3 karakter")
    .max(50)
    .regex(/^[a-z0-9._-]+$/, "Hanya huruf, angka, titik, garis bawah, dan strip"),
  password: z.string().min(6, "Password minimal 6 karakter").max(72),
  nama: z.string().trim().min(1).max(120),
  jabatan: z.string().trim().max(120).optional().nullable(),
  unit_kerja: z.string().trim().max(120).optional().nullable(),
  role: z.enum(["admin", "pegawai"]).default("pegawai"),
});

export const createPegawai = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => CreatePegawaiSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: userErr } = await supabaseAdmin.auth.admin.createUser({
      email: usernameEmail(data.username),
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username, nama: data.nama, nip: data.nip },
    });
    if (userErr || !created.user) throw new Error(userErr?.message ?? "Gagal membuat pengguna.");

    const uid = created.user.id;
    const { error: profErr } = await supabaseAdmin.from("profiles").insert({
      id: uid,
      nip: data.nip,
      username: data.username,
      nama: data.nama,
      jabatan: data.jabatan ?? null,
      unit_kerja: data.unit_kerja ?? null,
    });
    if (profErr) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      throw new Error(profErr.message);
    }

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: data.role });
    if (roleErr) throw new Error(roleErr.message);

    return { id: uid };
  });

const UpdatePegawaiSchema = z.object({
  id: z.string().uuid(),
  nip: z.string().trim().min(1).max(50),
  nama: z.string().trim().min(1).max(120),
  jabatan: z.string().trim().max(120).nullable().optional(),
  unit_kerja: z.string().trim().max(120).nullable().optional(),
  role: z.enum(["admin", "pegawai"]),
});

export const updatePegawai = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => UpdatePegawaiSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({
        nip: data.nip,
        nama: data.nama,
        jabatan: data.jabatan ?? null,
        unit_kerja: data.unit_kerja ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (pErr) throw new Error(pErr.message);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.id, role: data.role });
    if (rErr) throw new Error(rErr.message);
    return { ok: true };
  });

export const deletePegawai = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string().uuid(), password: z.string().min(6).max(72) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
