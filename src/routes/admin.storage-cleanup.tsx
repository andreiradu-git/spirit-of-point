import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AdminBar } from "@/components/AdminBar";
import { useAdmin } from "@/hooks/use-admin";
import { deleteR2Object, scanStorageOrphans } from "@/lib/r2.functions";
import { Loader2, RefreshCw, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/admin/storage-cleanup")({
  component: StorageCleanupPage,
  head: () => ({
    meta: [
      { title: "Storage Cleanup — Point Studio Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function StorageCleanupPage() {
  const { isAdmin, loading } = useAdmin();
  const scan = useServerFn(scanStorageOrphans);
  const del = useServerFn(deleteR2Object);
  const qc = useQueryClient();

  const [filter, setFilter] = useState<"all" | "orphan" | "referenced">("orphan");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["r2-orphans"],
    queryFn: () => scan(),
    enabled: isAdmin,
  });

  const rows = useMemo(() => {
    if (!data) return [];
    return data.objects
      .filter((r) => (filter === "orphan" ? !r.referenced : filter === "referenced" ? r.referenced : true))
      .filter((r) =>
        search
          ? r.key.toLowerCase().includes(search.toLowerCase()) ||
            (r.originalName ?? "").toLowerCase().includes(search.toLowerCase())
          : true,
      );
  }, [data, filter, search]);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.key)));
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (
      !confirm(
        `Delete ${selected.size} object(s) from R2 permanently? This cannot be undone.`,
      )
    )
      return;
    setDeleting(true);
    try {
      for (const key of selected) {
        try {
          await del({ data: { key } });
        } catch (e) {
          console.error("Failed to delete", key, e);
        }
      }
      setSelected(new Set());
      await qc.invalidateQueries({ queryKey: ["r2-orphans"] });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return null;
  if (!isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center">
        <p className="text-sm text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <AdminBar />
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Storage Cleanup</h1>
            <p className="text-sm text-neutral-500">
              Review unreferenced objects in Cloudflare R2 and delete them manually. Deletions are
              permanent — nothing is removed automatically.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Re-scan
          </button>
        </header>

        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Objects" value={data.totalObjects.toString()} />
            <Stat label="Total size" value={fmtBytes(data.totalBytes)} />
            <Stat label="Orphans" value={data.orphanCount.toString()} tone="warn" />
            <Stat label="Recoverable" value={fmtBytes(data.orphanBytes)} tone="warn" />
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex gap-2">
            {(["orphan", "referenced", "all"] as const).map((k) => (
              <button
                key={k}
                onClick={() => {
                  setFilter(k);
                  setSelected(new Set());
                }}
                className={`text-xs px-3 py-1.5 rounded border ${
                  filter === k ? "bg-black text-white border-black" : "hover:bg-neutral-50"
                }`}
              >
                {k[0].toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
          <input
            placeholder="Search key or filename…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm border rounded px-2 py-1.5 w-64"
          />
          <button
            onClick={deleteSelected}
            disabled={selected.size === 0 || deleting}
            className="inline-flex items-center gap-2 rounded bg-red-600 text-white px-3 py-1.5 text-sm disabled:opacity-40"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete selected ({selected.size})
          </button>
        </div>

        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2 w-10">
                  <input
                    type="checkbox"
                    checked={selected.size > 0 && selected.size === rows.length}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-3 py-2">Object</th>
                <th className="px-3 py-2">Size</th>
                <th className="px-3 py-2">Uploaded</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-neutral-400">
                    {isFetching ? "Scanning R2…" : "No objects match this filter."}
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.key} className="border-t hover:bg-neutral-50/50">
                  <td className="px-3 py-2 align-top">
                    <input
                      type="checkbox"
                      checked={selected.has(r.key)}
                      onChange={() => toggle(r.key)}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-blue-700 hover:underline break-all"
                    >
                      {r.key}
                    </a>
                    {r.originalName && (
                      <div className="text-xs text-neutral-500">orig: {r.originalName}</div>
                    )}
                    {r.referencedIn.length > 0 && (
                      <div className="text-xs text-neutral-500 mt-0.5">
                        used in: {r.referencedIn.join(", ")}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top whitespace-nowrap">{fmtBytes(r.size)}</td>
                  <td className="px-3 py-2 align-top whitespace-nowrap text-xs text-neutral-600">
                    {new Date(r.uploaded ?? Date.now()).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {r.referenced ? (
                      <span className="inline-flex items-center gap-1 text-green-700 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Referenced
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700 text-xs">
                        <AlertTriangle className="h-3.5 w-3.5" /> Orphan
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div
      className={`border rounded p-3 ${tone === "warn" ? "border-amber-300 bg-amber-50" : "bg-white"}`}
    >
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
