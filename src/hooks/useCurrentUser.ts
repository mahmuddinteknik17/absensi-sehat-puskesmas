import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CurrentUser = {
  id: string;
  email: string | null;
  profile: {
    nip: string;
    username: string;
    nama: string;
    jabatan: string | null;
    unit_kerja: string | null;
  } | null;
  role: "admin" | "pegawai" | null;
  loading: boolean;
};

export function useCurrentUser(): CurrentUser {
  const [state, setState] = useState<CurrentUser>({
    id: "",
    email: null,
    profile: null,
    role: null,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) {
        if (mounted) setState((s) => ({ ...s, loading: false }));
        return;
      }
      const [{ data: profile }, { data: roleRow }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      ]);
      if (!mounted) return;
      setState({
        id: user.id,
        email: user.email ?? null,
        profile: profile
          ? {
              nip: profile.nip,
              username: profile.username,
              nama: profile.nama,
              jabatan: profile.jabatan,
              unit_kerja: profile.unit_kerja,
            }
          : null,
        role: (roleRow?.role as "admin" | "pegawai" | undefined) ?? null,
        loading: false,
      });
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
