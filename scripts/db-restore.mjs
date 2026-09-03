#!/usr/bin/env node
// Restores a D1 .sql dump created by scripts/db-backup.mjs.
// Usage: node scripts/db-restore.mjs backups/d1-....sql
import { readFileSync } from "node:fs";
import { d1Query, splitStatements } from "./d1.mjs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/db-restore.mjs <dump.sql>");
  process.exit(1);
}

const statements = splitStatements(readFileSync(file, "utf8")).filter(
  (s) => !/^PRAGMA\b/i.test(s) && !/^BEGIN\b/i.test(s) && !/^COMMIT\b/i.test(s),
);

let i = 0;
for (const statement of statements) {
  await d1Query(statement);
  if (++i % 100 === 0) console.log(`${i}/${statements.length}`);
}
console.log(`Restored ${statements.length} statement(s) from ${file}`);
