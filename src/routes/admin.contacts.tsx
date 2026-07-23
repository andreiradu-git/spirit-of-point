import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAdmin } from "@/hooks/use-admin";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listContactMessages, updateContactMessage, deleteContactMessage } from "@/lib/contact.functions";

export const Route = createFileRoute("/admin/contacts")({
  head: () => ({ meta: [{ title: "Contacts — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminContactsPage,
});

function AdminContactsPage() {
  const { user, isAdmin, loading } = useAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listContactMessages);
  const update = useServerFn(updateContactMessage);
  const del = useServerFn(deleteContactMessage);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate({ to: "/auth" });
  }, [loading, user, isAdmin, navigate]);

  const { data: messages = [] } = useQuery({
    queryKey: ["admin", "contact_messages"],
    queryFn: () => list(),
    enabled: !!isAdmin,
  });

  if (loading || !isAdmin) return null;

  const unread = messages.filter((m) => !m.read_at && !m.archived).length;

  return (
    <div className="min-h-screen bg-neutral-50 pt-14 pb-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-serif">Messages</h1>
          <p className="text-sm text-neutral-600 mt-1">
            {messages.length} total · <span className="text-black font-medium">{unread} unread</span>
          </p>
        </div>

        <div className="space-y-3">
          {messages.length === 0 && (
            <div className="bg-white border rounded-lg p-8 text-center text-neutral-500 text-sm">
              No messages yet. When someone submits the contact form, they'll appear here.
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`bg-white border rounded-lg p-5 ${m.read_at ? "opacity-70" : ""} ${m.archived ? "border-dashed" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-neutral-500">
                    <a className="hover:underline" href={`mailto:${m.email}`}>{m.email}</a>
                    {m.phone && <> · <a className="hover:underline" href={`tel:${m.phone}`}>{m.phone}</a></>}
                  </div>
                </div>
                <div className="text-xs text-neutral-500 text-right">
                  {new Date(m.created_at).toLocaleString()}
                  {m.source_path && <div className="opacity-70">from {m.source_path}</div>}
                </div>
              </div>
              {m.subject && <div className="text-sm font-medium mb-1">{m.subject}</div>}
              <div className="text-sm text-neutral-800 whitespace-pre-wrap">{m.message}</div>
              <div className="mt-3 flex gap-2 flex-wrap">
                <button
                  onClick={async () => {
                    await update({ data: { id: m.id, read: !m.read_at } });
                    qc.invalidateQueries({ queryKey: ["admin", "contact_messages"] });
                  }}
                  className="text-xs px-2 py-1 border rounded hover:bg-neutral-50"
                >
                  {m.read_at ? "Mark unread" : "Mark read"}
                </button>
                <button
                  onClick={async () => {
                    await update({ data: { id: m.id, archived: !m.archived } });
                    qc.invalidateQueries({ queryKey: ["admin", "contact_messages"] });
                  }}
                  className="text-xs px-2 py-1 border rounded hover:bg-neutral-50"
                >
                  {m.archived ? "Unarchive" : "Archive"}
                </button>
                <a
                  href={`mailto:${m.email}?subject=${encodeURIComponent("Re: " + (m.subject ?? "your message"))}`}
                  className="text-xs px-2 py-1 border rounded hover:bg-neutral-50"
                >
                  Reply by email
                </a>
                <button
                  onClick={async () => {
                    if (!confirm("Delete this message?")) return;
                    await del({ data: { id: m.id } });
                    qc.invalidateQueries({ queryKey: ["admin", "contact_messages"] });
                  }}
                  className="text-xs px-2 py-1 border border-red-300 text-red-700 rounded hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
