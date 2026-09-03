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

  const [filter, setFilter] = useState<
    "all" | "unreferenced" | "active" | "archival-master" | "legacy-optimized"
  >("unreferenced");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [dryRun, setDryRun] = useState<string[] | null>(null);
  const [result, setResult] = useState<string[] | null>(null);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["r2-orphans"],
    queryFn: () => scan(),
    enabled: isAdmin,
  });

  const rows = useMemo(() => {
    if (!data) return [];
    return data.objects
      .filter((r) =>
        filter === "all"
          ? true
          : filter === "legacy-optimized"
            ? r.category.startsWith("legacy-optimized")
            : r.category === filter,
      )
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

  const selectable = rows.filter((r) => selected.has(r.key) && !r.protected && !r.referenced);

  const runDryRun = () => {
    setResult(null);
    setDryRun(
      [...selected].map((key) => {
        const row = rows.find((r) => r.key === key);
        if (!row) return `${key} — not in current scan (skipped)`;
        if (row.protected) return `${key} — archival master, will be REFUSED`;
        if (row.referenced) return `${key} — still referenced, will be REFUSED`;
        return `${key} — ${fmtBytes(row.size)}, will be deleted`;
      }),
    );
  };

  const deleteSelected = async () => {
    if (selectable.length === 0) return;
    if (
      !confirm(
        `Permanently delete ${selectable.length} unreferenced object(s) from R2? This cannot be undone.`,
      )
    )
      return;
    setDeleting(true);
    const log: string[] = [];
    try {
      for (const row of selectable) {
        try {
          const res = await del({ data: { key: row.key } });
          log.push(`${row.key} — ${res.ok ? "deleted" : `refused (${res.reason})`}`);
        } catch (e) {
          log.push(`${row.key} — failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      setSelected(new Set());
      setDryRun(null);
      setResult(log);
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
            <Stat label="Unreferenced" value={data.orphanCount.toString()} tone="warn" />
            <Stat label="Recoverable" value={fmtBytes(data.orphanBytes)} tone="warn" />
          </div>
        )}

        {data && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(data.byCategory).map(([cat, v]) => (
              <Stat key={cat} label={cat.replace(/-/g, " ")} value={`${v.count} · ${fmtBytes(v.bytes)}`} />
            ))}
          </div>
        )}

        {data && data.missingReferences.length > 0 && (
          <div className="border border-amber-300 bg-amber-50 rounded p-3 text-xs">
            <div className="font-medium mb-1">
              Broken references ({data.missingReferences.length}) — content points at objects that
              are not in R2:
            </div>
            <ul className="space-y-0.5 max-h-40 overflow-auto font-mono">
              {data.missingReferences.map((m) => (
                <li key={`${m.source}-${m.key}`}>
                  {m.key} — {m.source}
                </li>
              ))}
            </ul>
          </div>
        )}

        {dryRun && (
          <div className="border rounded p-3 text-xs bg-neutral-50">
            <div className="font-medium mb-1">Dry run — nothing has been deleted:</div>
            <ul className="space-y-0.5 max-h-48 overflow-auto font-mono">
              {dryRun.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {result && (
          <div className="border rounded p-3 text-xs bg-white">
            <div className="font-medium mb-1">Deletion result:</div>
            <ul className="space-y-0.5 max-h-48 overflow-auto font-mono">
              {result.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex gap-2">
            {(["unreferenced", "active", "archival-master", "legacy-optimized", "all"] as const).map((k) => (
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
                {k.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase())}
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
            onClick={runDryRun}
            disabled={selected.size === 0}
            className="inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-neutral-50"
          >
            Dry run ({selected.size})
          </button>
          <button
            onClick={deleteSelected}
            disabled={selectable.length === 0 || deleting || !dryRun}
            className="inline-flex items-center gap-2 rounded bg-red-600 text-white px-3 py-1.5 text-sm disabled:opacity-40"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete confirmed ({selectable.length})
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
                    {r.protected ? (
                      <span className="inline-flex items-center gap-1 text-blue-700 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Archival master (protected)
                      </span>
                    ) : r.referenced ? (
                      <span className="inline-flex items-center gap-1 text-green-700 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {r.category.replace(/-/g, " ")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700 text-xs">
                        <AlertTriangle className="h-3.5 w-3.5" /> {r.category.replace(/-/g, " ")}
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
