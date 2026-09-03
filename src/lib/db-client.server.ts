// Server-side query builder over Cloudflare D1.
//
// Exposes the small chainable surface the media/gallery/contact backend code
// already uses (`.from(t).select().eq().order()...`), so those modules keep
// their shape while every query now runs against D1.
import { d1All, d1Run, newId, nowIso, type SqlValue } from "@/lib/d1.server";

type Row = Record<string, unknown>;

const JSON_COLUMNS: Record<string, string[]> = {
  site_settings: ["value"],
  asset_meta: ["tags"],
  media_assets: ["tags"],
  pages: ["body"],
};
const BOOL_COLUMNS: Record<string, string[]> = {
  media_assets: ["used_on_site"],
  menu_items: ["visible"],
  pages: ["published"],
  contact_messages: ["archived"],
};
const PRIMARY_KEYS: Record<string, string> = {
  site_settings: "key",
  asset_meta: "url",
  page_seo: "path",
};
const GENERATED_ID_TABLES = new Set([
  "media_assets",
  "galleries",
  "gallery_images",
  "menu_items",
  "pages",
  "page_views",
  "contact_messages",
]);
const IDENT = /^[a-z_][a-z0-9_]*$/;

function pk(table: string): string {
  return PRIMARY_KEYS[table] ?? "id";
}

function encode(table: string, column: string, value: unknown): SqlValue {
  if (value === null || value === undefined) return null;
  if (JSON_COLUMNS[table]?.includes(column)) return JSON.stringify(value);
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function decode(table: string, row: Row): Row {
  const out: Row = { ...row };
  for (const col of JSON_COLUMNS[table] ?? []) {
    if (typeof out[col] === "string") {
      try {
        out[col] = JSON.parse(out[col] as string);
      } catch {
        /* keep raw */
      }
    }
  }
  for (const col of BOOL_COLUMNS[table] ?? []) if (col in out) out[col] = Boolean(out[col]);
  return out;
}

type Condition = { sql: string; params: SqlValue[] };

class ServerQuery implements PromiseLike<{ data: any; error: { message: string } | null; count?: number }> {
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private columns = "*";
  private conditions: Condition[] = [];
  private orderBy: string[] = [];
  private limitCount?: number;
  private values: Row[] = [];
  private conflict?: string;
  private mode: "many" | "single" | "maybe" = "many";
  private wantCount = false;
  private embed?: { table: string; foreignKey: string; orderBy?: string };

  constructor(private table: string) {}

  select(columns = "*", options?: { count?: string; head?: boolean }) {
    const embedMatch = columns.match(/([a-z_][a-z0-9_]*)\s*\(([^)]*)\)/i);
    if (embedMatch) {
      this.embed = {
        table: embedMatch[1]!,
        foreignKey: `${this.table.replace(/ies$/, "y").replace(/s$/, "")}_id`,
        orderBy: "position",
      };
    }
    if (this.op === "select") this.columns = embedMatch ? "*" : columns || "*";
    if (options?.count) this.wantCount = true;
    return this;
  }

  eq(column: string, value: unknown) {
    if (value === null) this.conditions.push({ sql: `${column} IS NULL`, params: [] });
    else this.conditions.push({ sql: `${column} = ?`, params: [encode(this.table, column, value)] });
    return this;
  }

  in(column: string, values: unknown[]) {
    if (!values.length) {
      this.conditions.push({ sql: "0 = 1", params: [] });
      return this;
    }
    this.conditions.push({
      sql: `${column} IN (${values.map(() => "?").join(", ")})`,
      params: values.map((v) => encode(this.table, column, v)),
    });
    return this;
  }

  like(column: string, value: string) {
    this.conditions.push({ sql: `${column} LIKE ?`, params: [value] });
    return this;
  }

  gte(column: string, value: unknown) {
    this.conditions.push({ sql: `${column} >= ?`, params: [encode(this.table, column, value)] });
    return this;
  }

  /** PostgREST-style `or("a.eq.1,b.eq.2")`. */
  or(expression: string) {
    const parts: string[] = [];
    const params: SqlValue[] = [];
    for (const clause of expression.split(",")) {
      const [column, operator, ...rest] = clause.split(".");
      if (!column || !IDENT.test(column)) continue;
      const value = rest.join(".");
      if (operator === "is" && value === "null") {
        parts.push(`${column} IS NULL`);
        continue;
      }
      parts.push(`${column} = ?`);
      params.push(value);
    }
    if (parts.length) this.conditions.push({ sql: `(${parts.join(" OR ")})`, params });
    return this;
  }

  order(column: string, options?: { ascending?: boolean; referencedTable?: string }) {
    if (options?.referencedTable) {
      if (this.embed) this.embed.orderBy = column;
      return this;
    }
    this.orderBy.push(`${column} ${options?.ascending === false ? "DESC" : "ASC"}`);
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  insert(values: Row | Row[]) {
    this.op = "insert";
    this.values = Array.isArray(values) ? values : [values];
    return this;
  }

  upsert(values: Row | Row[], options?: { onConflict?: string }) {
    this.op = "upsert";
    this.values = Array.isArray(values) ? values : [values];
    this.conflict = options?.onConflict;
    return this;
  }

  update(values: Row) {
    this.op = "update";
    this.values = [values];
    return this;
  }

  delete() {
    this.op = "delete";
    return this;
  }

  single() {
    this.mode = "single";
    return this;
  }

  maybeSingle() {
    this.mode = "maybe";
    return this;
  }

  private where(params: SqlValue[]): string {
    if (!this.conditions.length) return "";
    for (const condition of this.conditions) params.push(...condition.params);
    return ` WHERE ${this.conditions.map((c) => c.sql).join(" AND ")}`;
  }

  private prepareRow(raw: Row): Row {
    const row = { ...raw };
    const key = pk(this.table);
    if (GENERATED_ID_TABLES.has(this.table) && !row[key]) row[key] = newId();
    if (!("updated_at" in row) && this.table !== "page_views" && this.table !== "contact_messages") {
      row.updated_at = nowIso();
    }
    return row;
  }

  private async run() {
    try {
      if (this.op === "select") {
        const params: SqlValue[] = [];
        let sql = `SELECT ${this.wantCount ? "COUNT(*) AS __count" : this.columns} FROM ${this.table}`;
        sql += this.where(params);
        if (!this.wantCount && this.orderBy.length) sql += ` ORDER BY ${this.orderBy.join(", ")}`;
        if (!this.wantCount && this.limitCount) sql += ` LIMIT ${this.limitCount}`;
        const rows = await d1All<Row>(sql, params);
        if (this.wantCount) {
          return { data: null, error: null, count: Number(rows[0]?.__count ?? 0) };
        }
        const decoded = rows.map((row) => decode(this.table, row));
        if (this.embed && decoded.length) {
          const key = pk(this.table);
          const ids = decoded.map((row) => row[key] as SqlValue).filter((v) => v != null);
          const children = ids.length
            ? (
                await d1All<Row>(
                  `SELECT * FROM ${this.embed.table} WHERE ${this.embed.foreignKey} IN (${ids
                    .map(() => "?")
                    .join(", ")})${this.embed.orderBy ? ` ORDER BY ${this.embed.orderBy} ASC` : ""}`,
                  ids,
                )
              ).map((row) => decode(this.embed!.table, row))
            : [];
          for (const row of decoded) {
            row[this.embed.table] = children.filter((c) => c[this.embed!.foreignKey] === row[key]);
          }
        }
        if (this.mode === "many") return { data: decoded, error: null, count: decoded.length };
        if (decoded.length) return { data: decoded[0], error: null };
        if (this.mode === "maybe") return { data: null, error: null };
        return { data: null, error: { message: "No rows found", code: "PGRST116" } };
      }

      if (this.op === "delete") {
        const params: SqlValue[] = [];
        if (!this.conditions.length) {
          return { data: null, error: { message: "Refusing to delete without a filter" } };
        }
        const sql = `DELETE FROM ${this.table}${this.where(params)}`;
        const { changes } = await d1Run(sql, params);
        return { data: null, error: null, count: changes };
      }

      if (this.op === "update") {
        const row = { ...(this.values[0] ?? {}) };
        if (!("updated_at" in row) && this.table !== "page_views" && this.table !== "contact_messages") {
          row.updated_at = nowIso();
        }
        const cols = Object.keys(row).filter((c) => IDENT.test(c));
        if (!cols.length) return { data: null, error: null };
        const params: SqlValue[] = cols.map((c) => encode(this.table, c, row[c]));
        if (!this.conditions.length) {
          return { data: null, error: { message: "Refusing to update without a filter" } };
        }
        const sql = `UPDATE ${this.table} SET ${cols.map((c) => `${c} = ?`).join(", ")}${this.where(params)}`;
        const { changes } = await d1Run(sql, params);
        return { data: null, error: null, count: changes };
      }

      const conflict = this.conflict ?? pk(this.table);
      const written: Row[] = [];
      for (const raw of this.values) {
        const row = this.prepareRow(raw);
        const cols = Object.keys(row).filter((c) => IDENT.test(c));
        const params = cols.map((c) => encode(this.table, c, row[c]));
        const updates = cols.filter((c) => c !== conflict).map((c) => `${c} = excluded.${c}`);
        const sql =
          `INSERT INTO ${this.table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})` +
          (this.op === "upsert" && updates.length
            ? ` ON CONFLICT(${conflict}) DO UPDATE SET ${updates.join(", ")}`
            : "");
        await d1Run(sql, params);
        written.push(decode(this.table, row));
      }
      if (this.mode === "many") return { data: written, error: null };
      return { data: written[0] ?? null, error: null };
    } catch (error) {
      return {
        data: this.mode === "many" ? [] : null,
        error: { message: error instanceof Error ? error.message : "Database request failed" },
      };
    }
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(onfulfilled as never, onrejected as never);
  }
}

export type ServerDb = { from: (table: string) => ServerQuery };

/** Query builder over the production Cloudflare D1 database. */
export function serverDb(): ServerDb {
  return { from: (table: string) => new ServerQuery(table) };
}
