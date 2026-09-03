import { useEffect, useState } from "react";
import { db, type AuthUser } from "@/lib/cms-client";

export function useAdmin() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const apply = (u: AuthUser | null) => {
      if (!mounted) return;
      setUser(u);
      setIsAdmin(u?.role === "admin");
      setLoading(false);
    };

    db.auth.getUser().then(({ data }) => apply(data.user));
    const { data: sub } = db.auth.onAuthStateChange((_event, session) => apply(session?.user ?? null));

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, isAdmin, loading };
}
