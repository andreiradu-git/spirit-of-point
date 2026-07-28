@@
 export function makeR2Key(kind: AssetKind, filename: string): string {
   const folder = kind === "image" ? "originals" : kind === "video" ? "videos" : "files";
-  const rawExt = (filename.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
+  const safeFilename = filename ?? "";
+  const rawExt = (safeFilename.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
   const ext = rawExt || (kind === "image" ? "jpg" : kind === "video" ? "mp4" : "bin");
   const uuid = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
   return `${folder}/${uuid}.${ext}`;
 }
@@
 export function optimizedKeyFor(originalKey: string): string {
-  const base = originalKey.split("/").pop() || originalKey;
+  const safeKey = originalKey ?? "";
+  const base = safeKey.split("/").pop() || originalKey;
   const dot = base.lastIndexOf(".");
   const stem = dot > 0 ? base.slice(0, dot) : base;
   return `optimized/${stem}.webp`;
 }
*** End Patch
