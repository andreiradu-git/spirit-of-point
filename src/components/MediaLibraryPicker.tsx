import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAllAssets, type SiteAsset } from "@/lib/assets.functions";
import { cdn } from "@/components/SiteLayout";
import { X, Loader2, Search } from "lucide-react";

type Props = {
  open: boolean;
  kind?: "image" | "video";
  onClose: () => void;
  onPick: (asset: SiteAsset) => void;
};

export function MediaLibraryPicker({ open, kind = "image", onClose, onPick }: Props) {
  const list = useServerFn(listAllAssets);
  const [q, setQ] = useState("");

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["media-picker", "assets"],
    queryFn: () => list() as Promise<SiteAsset[]>,
    enabled: open,
    staleTime: 30_000,
  });

  const shown = useMemo(() => {
    const seen = new Set<string>();
    return assets
      .filter((a) => a.kind === kind)
      .filter((a) => {
        if (seen.has(a.url)) return false;
        seen.add(a.url);
        return true;
      })
      .filter((a) =>
        !q ||
        `${a.url} ${a.name ?? ""} ${a.alt ?? ""} ${a.source}`
          .toLowerCase()
          .includes(q.toLowerCase()),
      );
  }, [assets, kind, q]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-5xl max-h-[85vh] rounded-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Pick from library</h2>
          <button onClick={onClose} className="p-1 hover:bg-neutral-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search assets…"
              className="w-full pl-9 pr-3 py-2 border rounded text-sm"
              autoFocus
            />
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-neutral-500">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : shown.length === 0 ? (
            <div className="text-center py-16 text-neutral-500 text-sm">No assets found.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {shown.map((a) => (
                <button
                  key={a.url}
                  type="button"
                  onClick={() => {
                    onPick(a);
                    onClose();
                  }}
                  className="group relative aspect-square bg-neutral-100 overflow-hidden border hover:border-black transition"
                  title={a.name || a.url}
                >
                  {kind === "image" ? (
                    <img
                      src={cdn(a.url, 400)}
                      alt={a.alt ?? ""}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-neutral-500 p-2 text-center break-all">
                      {a.name || a.url}
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100 transition">
                    {a.source}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
