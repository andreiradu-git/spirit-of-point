// Generic CMS data endpoint backed by Cloudflare D1.
//
// The browser never talks to a database directly: `src/lib/cms-client.ts` builds
// a small, explicit query descriptor and posts it here, where it is validated
// against a table allow-list, authorised, and compiled to parameterised SQL.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { currentAdmin } from "@/lib/auth.server";
import { d1All, d1Run, newId, nowIso, type SqlValue } from "@/lib/d1.server";

type Access = "public" | "admin";
type TableRule = {
  read: Access;
  write: Access;
  /** Columns stored as JSON text in SQLite but exposed as parsed values. */
  json?: string[];
  /** Columns stored as 0/1 in SQLite but exposed as booleans. */
  bool?: string[];
  /** Column used to resolve upsert conflicts by default. */
  pk: string;
  /** Whether the primary key is generated when missing. */
  generateId?: boolean;
  /** Columns maintained by the API. */
  timestamps?: string[];
};

const TABLES: Record<string, TableRule> = {
  site_settings: { read: "public", write: "admin", json: ["value"], pk: "key", timestamps: ["updated_at"] },
  asset_meta: { read: "public", write: "admin", json: ["tags"], pk: "url", timestamps: ["updated_at"] },
  media_assets: {
    read: "public",
    write: "admin",
    json: ["tags"],
    bool: ["used_on_site"],
    pk: "id",
    generateId: true,
    timestamps: ["updated_at"],
  },
  galleries: { read: "public", write: "admin", pk: "id", generateId: true, timestamps: ["updated_at"] },
  gallery_images: { read: "public", write: "admin", pk: "id", generateId: true, timestamps: ["updated_at"] },
  menu_items: { read: "public", write: "admin", bool: ["visible"], pk: "id", generateId: true, timestamps: ["updated_at"] },
  pages: { read: "public", write: "admin", json: ["body"], bool: ["published"], pk: "id", generateId: true, timestamps: ["updated_at"] },
  page_seo: { read: "public", write: "admin", pk: "path", timestamps: ["updated_at"] },
  page_views: { read: "admin", write: "public", pk: "id", generateId: true },
  contact_messages: { read: "admin", write: "admin", bool: ["archived"], pk: "id", generateId: true },
};

const IDENT = /^[a-z_][a-z0-9_]*$/;

const filterSchema = z.object({
  column: z.string().regex(IDENT),
  op: z.enum(["eq", "neq", "like", "gt", "gte", "lt", "lte", "in", "is"]),
  value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.union([z.string(), z.number()]))]),
});

const descriptorSchema = z.object({
  table: z.string(),
  op: z.enum(["select", "insert", "update", "upsert", "delete"]),
  columns: z.array(z.string().regex(IDENT)).optional(),
  embed: z.object({ table: z.string(), foreignKey: z.string().regex(IDENT), orderBy: z.string().regex(IDENT).optional() }).optional(),
  filters: z.array(filterSchema).default([]),
  order: z.array(z.object({ column: z.string().regex(IDENT), ascending: z.boolean().default(true) })).default([]),
  limit: z.number().int().positive().max(2000).optional(),
  values: z.union([z.record(z.string(), z.unknown()), z.array(z.record(z.string(), z.unknown()))]).optional(),
  onConflict: z.string().regex(IDENT).optional(),
  returning: z.boolean().default(false),
});

export type DbDescriptor = z.infer<typeof descriptorSchema>;

function rule(table: string): TableRule {
  const found = TABLES[table];
  if (!found) throw new Error(`Unknown table: ${table}`);
  return found;
}

function encode(table: string, column: string, value: unknown): SqlValue {
  const r = rule(table);
  if (value === null || value === undefined) return null;
  if (r.json?.includes(column)) return JSON.stringify(value);
  if (r.bool?.includes(column)) return value ? 1 : 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function decodeRow(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const r = rule(table);
  const out: Record<string, unknown> = { ...row };
  for (const col of r.json ?? []) {
    if (typeof out[col] === "string") {
      try {
        out[col] = JSON.parse(out[col] as string);
      } catch {
        /* leave raw */
      }
    }
  }
  for (const col of r.bool ?? []) if (col in out) out[col] = Boolean(out[col]);
  return out;
}

function whereClause(table: string, filters: DbDescriptor["filters"], params: SqlValue[]): string {
  if (!filters.length) return "";
  const parts = filters.map((f) => {
    if (f.op === "in") {
      const list = Array.isArray(f.value) ? f.value : [f.value as string];
      if (!list.length) return "0 = 1";
      params.push(...list.map((v) => encode(table, f.column, v)));
      return `${f.column} IN (${list.map(() => "?").join(", ")})`;
    }
    if (f.op === "is" || f.value === null) {
      return f.value === null ? `${f.column} IS NULL` : `${f.column} IS NOT NULL`;
    }
    const sqlOp = { eq: "=", neq: "!=", like: "LIKE", gt: ">", gte: ">=", lt: "<", lte: "<=" }[f.op];
    params.push(encode(table, f.column, f.value));
    return `${f.column} ${sqlOp} ?`;
  });
  return ` WHERE ${parts.join(" AND ")}`;
}

async function authorize(table: string, need: Access) {
  if (need === "public") return;
  const admin = await currentAdmin();
  if (!admin) throw new Error("Unauthorized: administrator session required");
}

function withDefaults(table: string, values: Record<string, unknown>): Record<string, unknown> {
  const r = rule(table);
  const row = { ...values };
  if (r.generateId && !row[r.pk]) row[r.pk] = newId();
  for (const ts of r.timestamps ?? []) row[ts] = row[ts] ?? nowIso();
  return row;
}

async function runSelect(d: DbDescriptor) {
  const r = rule(d.table);
  const params: SqlValue[] = [];
  const cols = d.columns?.length ? d.columns.join(", ") : "*";
  let sql = `SELECT ${cols} FROM ${d.table}`;
  sql += whereClause(d.table, d.filters, params);
  if (d.order.length) {
    sql += ` ORDER BY ${d.order.map((o) => `${o.column} ${o.ascending ? "ASC" : "DESC"}`).join(", ")}`;
  }
  if (d.limit) sql += ` LIMIT ${d.limit}`;
  const rows = (await d1All<Record<string, unknown>>(sql, params)).map((row) => decodeRow(d.table, row));

  if (d.embed && rows.length) {
    const child = d.embed.table;
    rule(child);
    const ids = rows.map((row) => row[r.pk] as SqlValue).filter((v) => v !== null && v !== undefined);
    if (ids.length) {
      const childRows = (
        await d1All<Record<string, unknown>>(
          `SELECT * FROM ${child} WHERE ${d.embed.foreignKey} IN (${ids.map(() => "?").join(", ")})${
            d.embed.orderBy ? ` ORDER BY ${d.embed.orderBy} ASC` : ""
          }`,
          ids,
        )
      ).map((row) => decodeRow(child, row));
      for (const row of rows) {
        row[child] = childRows.filter((c) => c[d.embed!.foreignKey] === row[r.pk]);
      }
    } else {
      for (const row of rows) row[child] = [];
    }
  }
  return rows;
}

async function runWrite(d: DbDescriptor) {
  const r = rule(d.table);
  const list = Array.isArray(d.values) ? d.values : d.values ? [d.values] : [];

  if (d.op === "delete") {
    const params: SqlValue[] = [];
    const sql = `DELETE FROM ${d.table}${whereClause(d.table, d.filters, params)}`;
    if (!d.filters.length) throw new Error("Refusing to delete without a filter");
    await d1Run(sql, params);
    return [];
  }

  if (d.op === "update") {
    if (!d.filters.length) throw new Error("Refusing to update without a filter");
    const values = withDefaults(d.table, { ...(list[0] ?? {}) });
    delete values[r.pk];
    const cols = Object.keys(values).filter((c) => IDENT.test(c));
    if (!cols.length) return [];
    const params: SqlValue[] = cols.map((c) => encode(d.table, c, values[c]));
    const sql = `UPDATE ${d.table} SET ${cols.map((c) => `${c} = ?`).join(", ")}${whereClause(d.table, d.filters, params)}`;
    await d1Run(sql, params);
    return [];
  }

  const conflict = d.onConflict ?? r.pk;
  const inserted: Record<string, unknown>[] = [];
  for (const raw of list) {
    const values = withDefaults(d.table, raw);
    const cols = Object.keys(values).filter((c) => IDENT.test(c));
    const params = cols.map((c) => encode(d.table, c, values[c]));
    const updates = cols.filter((c) => c !== conflict).map((c) => `${c} = excluded.${c}`);
    const sql =
      `INSERT INTO ${d.table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})` +
      (d.op === "upsert" && updates.length ? ` ON CONFLICT(${conflict}) DO UPDATE SET ${updates.join(", ")}` : "");
    await d1Run(sql, params);
    inserted.push(values);
  }
  return inserted.map((row) => decodeRow(d.table, row));
}

/**
 * Single data endpoint used by the browser CMS client.
 *
 * Failures are returned as data (`error`) instead of thrown: a throw here is
 * turned into a 500 HTML response by the request middleware, which the client
 * cannot parse and which blanks the page behind an error boundary.
 */
export const dbExec = createServerFn({ method: "POST" })
  .inputValidator((input) => descriptorSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const r = rule(data.table);
      const rows =
        data.op === "select"
          ? (await authorize(data.table, r.read), await runSelect(data))
          : (await authorize(data.table, r.write), await runWrite(data));
      return { rows: rows as unknown as Array<Record<string, any>>, error: null as string | null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Database request failed";
      console.error(`[dbExec] ${data.op} ${data.table}: ${message}`);
      return { rows: [] as Array<Record<string, any>>, error: message };
    }
  });
