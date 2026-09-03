#!/usr/bin/env node
// Applies every db/migrations/*.sql file that has not been applied yet.
// Usage: CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... CLOUDFLARE_D1_DATABASE_ID=... node scripts/db-migrate.mjs
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { d1Query, splitStatements } from "./d1.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "db", "migrations");

await d1Query(
  "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))",
);
const applied = new Set(
  (await d1Query("SELECT name FROM schema_migrations"))[0]?.results?.map((r) => r.name) ?? [],
);

const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
let count = 0;
for (const file of files) {
  if (applied.has(file)) continue;
  const sql = readFileSync(join(dir, file), "utf8");
  for (const statement of splitStatements(sql)) {
    await d1Query(statement);
  }
  await d1Query("INSERT OR REPLACE INTO schema_migrations (name) VALUES (?)", [file]);
  console.log(`applied ${file}`);
  count++;
}
console.log(count ? `${count} migration(s) applied.` : "Database already up to date.");
