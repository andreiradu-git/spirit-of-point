import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAdmin, signOut } from "@/hooks/use-admin";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
  head: () => ({
    meta: [
      { title: "Admin — Point Studio" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AdminLayout() {
  const { loading, user, isAdmin } = useAdmin();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Point Studio Admin</div>
        <h1 className="font-sans font-bold uppercase text-2xl">Not authorized</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Your account <strong>{user.email}</strong> is signed in but has no admin role.
          Ask an existing admin to grant you access, or run the bootstrap SQL if this is the first admin account.
        </p>
        <div className="text-xs bg-muted p-4 rounded font-mono text-left max-w-lg">
          insert into public.user_roles (user_id, role)<br />
          values ('{user.id}', 'admin');
        </div>
        <button onClick={() => signOut().then(() => navigate({ to: "/auth" }))} className="text-sm underline">
          Sign out
        </button>
      </div>
    );
  }

  const nav = [
    { to: "/admin", label: "Dashboard" },
    { to: "/admin/galleries", label: "Galleries" },
    { to: "/admin/menu", label: "Menu" },
    { to: "/admin/pages", label: "Pages" },
    { to: "/admin/settings", label: "Site settings" },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 border-r border-border p-4 flex flex-col gap-1 shrink-0">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-4 px-2">Admin</div>
        {nav.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className={`px-2 py-2 text-sm rounded ${path === n.to ? "bg-foreground text-background" : "hover:bg-muted"}`}
          >
            {n.label}
          </Link>
        ))}
        <div className="flex-1" />
        <div className="text-xs text-muted-foreground px-2 truncate">{user.email}</div>
        <button
          onClick={() => signOut().then(() => navigate({ to: "/auth" }))}
          className="text-left px-2 py-2 text-sm rounded hover:bg-muted"
        >
          Sign out
        </button>
        <Link to="/" className="px-2 py-2 text-sm rounded hover:bg-muted">
          ← View site
        </Link>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        {path === "/admin" ? <AdminHome /> : <Outlet />}
      </main>
    </div>
  );
}

function AdminHome() {
  return (
    <div className="max-w-3xl">
      <h1 className="font-sans font-bold uppercase text-3xl">Dashboard</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        Manage your site content. Choose a section from the left.
      </p>
      <div className="mt-8 grid grid-cols-2 gap-4">
        <AdminCard to="/admin/galleries" title="Galleries" desc="Add, order and label photos in each category" />
        <AdminCard to="/admin/menu" title="Menu" desc="Nav links in the site header" />
        <AdminCard to="/admin/pages" title="Pages" desc="Edit page content and SEO" />
        <AdminCard to="/admin/settings" title="Site settings" desc="Header, footer, contact, social links" />
      </div>
    </div>
  );
}

function AdminCard({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link to={to} className="border border-border p-6 hover:bg-muted transition">
      <div className="font-sans font-bold uppercase">{title}</div>
      <div className="text-sm text-muted-foreground mt-1">{desc}</div>
    </Link>
  );
}
