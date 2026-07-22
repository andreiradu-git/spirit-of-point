import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type AuthOAuth = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

function oauth(): AuthOAuth {
  return (supabase.auth as unknown as { oauth: AuthOAuth }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-8 bg-background text-foreground">
      <div className="max-w-md space-y-2">
        <h1 className="text-xl font-semibold">Could not load this authorization request</h1>
        <p className="text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData() as any;
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message ?? String(error));
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "an app";
  const scopes: string[] = details?.scopes ?? details?.requested_scopes ?? [];

  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <div className="w-full max-w-md border border-border p-8 space-y-5">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Point Studio</div>
          <h1 className="mt-2 text-2xl font-serif">Connect {clientName}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          This lets {clientName} use Point Studio as you — reading and managing galleries, menu, pages
          and settings through your admin permissions.
        </p>
        {scopes.length > 0 && (
          <ul className="text-xs text-muted-foreground space-y-1">
            {scopes.map((s) => (
              <li key={s}>• {s}</li>
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 bg-foreground text-background py-2 text-sm uppercase tracking-widest disabled:opacity-50"
          >
            Approve
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 border border-border py-2 text-sm uppercase tracking-widest disabled:opacity-50"
          >
            Deny
          </button>
        </div>
      </div>
    </main>
  );
}
