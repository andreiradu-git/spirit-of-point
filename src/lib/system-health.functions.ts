import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import { createD1Client } from "@/integrations/d1.client";
import { putR2Object, listR2ObjectsDirect, deleteR2ObjectDirect, optimizedKeyFor } from "@/lib/r2.server";

function b64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") return Buffer.from(b64, "base64");
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const runSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async () => {
    const results: Record<string, unknown> = {};

    // 1) D1 binding
    let d1;
    try {
      d1 = createD1Client();
      results.d1 = { ok: true };
    } catch (e) {
      results.d1 = { ok: false, error: String(e) };
      return results;
    }

    // 2) Verify schema (tables exist)
    const tables = [
      "media_assets",
      "galleries",
      "gallery_images",
      "asset_meta",
      "user_roles",
      "contact_messages",
    ];
    const tableStatus: Record<string, { exists: boolean; error?: string }> = {};
    for (const t of tables) {
      try {
        const { data, error } = await d1.from(t).select("id").limit(1).maybeSingle();
        if (error) {
          tableStatus[t] = { exists: false, error: String(error) };
        } else {
          // If query succeeded, table exists (may return null)
          tableStatus[t] = { exists: true };
        }
      } catch (err: any) {
        tableStatus[t] = { exists: false, error: String(err) };
      }
    }
    results.tables = tableStatus;

    // 3) Test image upload/delete (use small 1x1 PNG)
    const tinyPngB64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
    const bytes = b64ToBytes(tinyPngB64);
    const suffix = Date.now().toString();
    const keyA = `healthcheck/${suffix}-A.png`;
    const keyB = `healthcheck/${suffix}-B.png`;

    const r2Results: Record<string, unknown> = {};
    try {
      const urlA = await putR2Object(keyA, bytes, "image/png", "A.png");
      const urlB = await putR2Object(keyB, bytes, "image/png", "B.png");
      r2Results.upload = { ok: true, urlA, urlB };

      // List objects and ensure both exist
      const objects = await listR2ObjectsDirect();
      const hasA = objects.some((o) => o.key === keyA);
      const hasB = objects.some((o) => o.key === keyB);
      r2Results.listAfterUpload = { hasA, hasB, totalObjects: objects.length };

      // Delete A but not B
      await deleteR2ObjectDirect(keyA);
      const objectsAfterDeleteA = await listR2ObjectsDirect();
      const hasAAfter = objectsAfterDeleteA.some((o) => o.key === keyA);
      const hasBAfter = objectsAfterDeleteA.some((o) => o.key === keyB);
      r2Results.afterDeleteA = { hasAAfter, hasBAfter };

      // Cleanup B
      await deleteR2ObjectDirect(keyB);
      const objectsAfterCleanup = await listR2ObjectsDirect();
      const hasBAfterCleanup = objectsAfterCleanup.some((o) => o.key === keyB);
      r2Results.cleanup = { hasBAfterCleanup };
    } catch (err: any) {
      r2Results.error = String(err);
    }
    results.r2 = r2Results;

    // 4) Test gallery listing (select few rows)
    try {
      const { data: galleries, error } = await d1.from("galleries").select("slug,title").limit(10);
      if (error) results.galleries = { ok: false, error: String(error) };
      else results.galleries = { ok: true, count: (galleries ?? []).length, sample: (galleries ?? []).slice(0, 5) };
    } catch (err: any) {
      results.galleries = { ok: false, error: String(err) };
    }

    // 5) Test contact form write
    try {
      const id = `hc-contact-${suffix}`;
      const now = new Date().toISOString();
      const { data: inserted, error: insertErr } = await d1
        .from("contact_messages")
        .insert({ id, name: "HC Test", email: "hc@example.com", message: "healthcheck", created_at: now });
      if (insertErr) {
        results.contact = { ok: false, error: String(insertErr) };
      } else {
        // cleanup
        await d1.from("contact_messages").delete().eq("id", id);
        results.contact = { ok: true };
      }
    } catch (err: any) {
      results.contact = { ok: false, error: String(err) };
    }

    // 6) Check optimization object existence (best-effort)
    try {
      const sampleKey = `healthcheck/${suffix}-A.png`;
      const optKey = optimizedKeyFor(sampleKey);
      // Check if optimized exists (likely not immediately)
      const allObjects = await listR2ObjectsDirect();
      const hasOptimized = allObjects.some((o) => o.key === optKey);
      results.optimization = { expectedOptimizedKey: optKey, exists: hasOptimized };
    } catch (err: any) {
      results.optimization = { ok: false, error: String(err) };
    }

    return results;
  });
