#!/usr/bin/env node
// Exports the whole D1 database as a .sql dump into backups/.
// Usage: node scripts/db-backup.mjs [outfile]
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./d1.mjs";

const { accountId, apiToken, databaseId } = config();
const API = "https://api.cloudflare.com/client/v4";

async function poll(body) {
  const res = await fetch(`${API}/accounts/${accountId}/d1/database/${databaseId}/export`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(JSON.stringify(json.errors));
  return json.result;
}

let result = await poll({ output_format: "polling", dump_options: { no_data: false } });
while (!result.result?.signed_url) {
  await new Promise((r) => setTimeout(r, 2000));
  result = await poll({ output_format: "polling", current_bookmark: result.at_bookmark });
}

const sql = await (await fetch(result.result.signed_url)).text();
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out =
  process.argv[2] ?? join(root, "backups", `d1-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, sql);
console.log(`Backup written to ${out} (${sql.length} bytes)`);
