import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useAdmin() {
  const [state, setState] = useState<{
    loading: boolean;
    user: { id: string; email: string | null } | null;
    isAdmin: boolean;
  }>({ loading: true, user: null, isAdmin: false });

  useEffect(() => {
    let active = true;
    async function check() {
      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user;
      if (!user) {
        if (active) setState({ loading: false, user: null, isAdmin: false });
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (!active) return;
      setState({
        loading: false,
        user: { id: user.id, email: user.email ?? null },
        isAdmin: (roles ?? []).some((r) => r.role === "admin"),
      });
    }
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function signOut() {
  await supabase.auth.signOut();
}
