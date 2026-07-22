import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
    throw redirect({ to: "/auth" });
  },
  component: Splash,
});

function Splash() {
  const [_, set] = useState(0);
  useEffect(() => {
    set(1);
  }, []);
  return (
    <div className="grid min-h-screen place-items-center bg-primary-soft">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
