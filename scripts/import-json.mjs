#!/usr/bin/env node
// One-off importer: loads JSON row dumps into Cloudflare D1.
//
//   node scripts/import-json.mjs <directory>
//
// Each file must be named <table>.json and contain an array of row objects.
// Values that are objects/arrays are JSON-encoded, booleans become 0/1.
// Used for the initial migration into D1; not part of the runtime.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { d1Query } from "./d1.mjs";

const BOOL_COLUMNS = new Set(["used_on_site", "visible", "published", "archived"]);

function encode(column, value) {
  if (value === null || value === undefined) return null;
  if (BOOL_COLUMNS.has(column)) return value ? 1 : 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const dir = process.argv[2];
if (!dir) {
  console.error("usage: node scripts/import-json.mjs <directory>");
  process.exit(1);
}

const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
for (const file of files) {
  const table = path.basename(file, ".json");
  const rows = JSON.parse(await readFile(path.join(dir, file), "utf8"));
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log(`${table}: nothing to import`);
    continue;
  }
  let imported = 0;
  for (const row of rows) {
    const columns = Object.keys(row);
    const params = columns.map((c) => encode(c, row[c]));
    const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${columns
      .map(() => "?")
      .join(", ")})`;
    await d1Query(sql, params);
    imported += 1;
  }
  console.log(`${table}: imported ${imported} row(s)`);
}
