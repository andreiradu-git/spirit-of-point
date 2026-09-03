import { useEffect, useState } from "react";
import { db, type AuthUser } from "@/lib/cms-client";

/**
 * Shared admin session state.
 *
 * Every editable component (each gallery, each editable text block) used to run
 * its own `getSessionUser()` request and keep its own `loading` flag. On a page
 * with many editable blocks that meant dozens of parallel session requests that
 * resolved at different times, so admin controls appeared piecemeal — often only
 * after a scroll or hover forced a re-render — and could flip back to
 * "not admin" while another request was still in flight.
 *
 * The session is now fetched once per page load into a module-level store that
 * all consumers subscribe to, so admin state is identical and stable everywhere.
 */
type State = { user: AuthUser | null; loading: boolean };

let state: State = { user: null, loading: true };
let inflight: Promise<void> | null = null;
const subscribers = new Set<(s: State) => void>();

function setState(next: State) {
  state = next;
  for (const notify of subscribers) notify(state);
}

function load(force = false): Promise<void> {
  if (inflight && !force) return inflight;
  inflight = db.auth
    .getUser()
    .then((res) => setState({ user: res?.data?.user ?? null, loading: false }))
    .catch(() => setState({ user: null, loading: false }))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function refreshAdminSession() {
  return load(true);
}

export function useAdmin() {
  const [local, setLocal] = useState<State>(state);

  useEffect(() => {
    subscribers.add(setLocal);
    setLocal(state);
    if (state.loading) void load();

    const { data: sub } = db.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, loading: false });
    });

    return () => {
      subscribers.delete(setLocal);
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user: local.user, isAdmin: local.user?.role === "admin", loading: local.loading };
}
