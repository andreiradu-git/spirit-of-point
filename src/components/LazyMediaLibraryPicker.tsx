import { lazy, Suspense } from "react";
import type { SiteAsset } from "@/lib/assets.functions";

/**
 * Admin-only media picker, loaded on demand.
 *
 * The picker (and its asset-listing server function) used to sit in the public
 * bundle graph because every editable gallery imported it statically. Visitors
 * downloaded ~50 KB of admin JavaScript they can never use. Behaviour is
 * unchanged: the real picker still renders nothing while closed.
 */
const Picker = lazy(() =>
  import("./MediaLibraryPicker").then((m) => ({ default: m.MediaLibraryPicker })),
);

type Props = {
  open: boolean;
  kind?: "image" | "video";
  onClose: () => void;
  onPick: (asset: SiteAsset) => void;
};

export function MediaLibraryPicker(props: Props) {
  if (!props.open) return null;
  return (
    <Suspense fallback={null}>
      <Picker {...props} />
    </Suspense>
  );
}
