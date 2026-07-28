// D1 adapter with automatic schema ensure on first use

type D1Binding = {
  prepare: (sql: string) => {
    all: (params?: unknown[]) => Promise<{ results: any[] }>; // SELECT -> .all
    run: (params?: unknown[]) => Promise<any>; // DDL/INSERT/UPDATE -> .run
  };
};

const DEFAULT_D1_BINDING_NAME = "POINT_D1";

function resolveD1Binding(name = DEFAULT_D1_BINDING_NAME): D1Binding | undefined {
  try {
    const w = (globalThis as any).__POINTSTUDIO_WORKER_ENV__ as Record<string, unknown> | undefined;
    if (w && w[name]) return w[name] as D1Binding;
  } catch (e) {}
  try {
    const n = (globalThis as any).__env__ as Record<string, unknown> | undefined;
    if (n && n[name]) return n[name] as D1Binding;
  } catch (e) {}
  try {
    const g = (globalThis as any)[name];
    if (g) return g as D1Binding;
  } catch (e) {}
  return undefined;
}

let _schemaEnsuredFor: Record<string, boolean> = {};

async function ensureSchema(binding: D1Binding) {
  // Run the migrations/001_create_schema.sql statements
  const sql = `
CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  storage_provider TEXT,
  bucket TEXT,
  object_key TEXT,
  filename TEXT,
  url TEXT UNIQUE,
  kind TEXT,
  content_type TEXT,
  size INTEGER,
  optimized_object_key TEXT,
  optimized_url TEXT,
  alt TEXT,
  used_on_site INTEGER DEFAULT 0,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS galleries (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE,
  title TEXT,
  tagline TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS gallery_images (
  id TEXT PRIMARY KEY,
  gallery_id TEXT,
  media_asset_id TEXT,
  src TEXT,
  alt TEXT,
  title TEXT,
  position INTEGER,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (gallery_id) REFERENCES galleries(id),
  FOREIGN KEY (media_asset_id) REFERENCES media_assets(id)
);

CREATE TABLE IF NOT EXISTS asset_meta (
  url TEXT PRIMARY KEY,
  label TEXT,
  alt TEXT,
  caption TEXT,
  description TEXT,
  tags TEXT
);

CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  role TEXT
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  subject TEXT,
  message TEXT,
  created_at TEXT
);
`;
  try {
    // Split by semicolon and run each non-empty statement
    const stmts = sql.split(/;\n/).map(s => s.trim()).filter(Boolean);
    for (const stmt of stmts) {
      try {
        await binding.prepare(stmt).run();
      } catch (e) {
        // If a statement fails, log and continue
        try { console.warn('[d1.ensureSchema] statement failed', e); } catch (e) {}
      }
    }
  } catch (e) {
    try { console.error('[d1.ensureSchema] failed', e); } catch (e) {}
  }
}

function normalizeCols(cols: string | null | undefined): string {
  if (!cols) return "*";
  if (typeof cols !== "string") return "*";
  return cols;
}

class QueryBuilder {
  table: string;
  whereParts: string[] = [];
  params: unknown[] = [];
  limitCount?: number;
  orderClause?: string;
  d1: D1Binding;

  constructor(table: string, d1: D1Binding) {
    this.table = table;
    this.d1 = d1;
  }

  eq(col: string, val: unknown) {
    this.whereParts.push(`${col} = ?`);
    this.params.push(val);
    return this;
  }

  in(col: string, vals: unknown[]) {
    const placeholders = vals.map(() => "?").join(",");
    this.whereParts.push(`${col} IN (${placeholders})`);
    this.params.push(...vals);
    return this;
  }

  or(raw: string) {
    const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
    const ors: string[] = [];
    for (const part of parts) {
      const [left, right] = part.split(".eq.");
      if (left && right !== undefined) {
        ors.push(`${left} = ?`);
        this.params.push(right);
      } else {
        ors.push(part);
      }
    }
    if (ors.length) this.whereParts.push(`(${ors.join(" OR ")})`);
    return this;
  }

  order(col: string, opts?: { ascending?: boolean; referencedTable?: string }) {
    const dir = opts?.ascending === false ? "DESC" : "ASC";
    this.orderClause = `${col} ${dir}`;
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  async _selectRaw(cols: string, headCount?: boolean) {
    const where = this.whereParts.length ? `WHERE ${this.whereParts.join(" AND ")}` : "";
    if (headCount) {
      const sql = `SELECT COUNT(*) as count FROM ${this.table} ${where}`;
      const res = await this.d1.prepare(sql).all(this.params as any[]);
      const cnt = (res?.results?.[0]?.count ?? 0) as number;
      return { count: cnt };
    }
    const order = this.orderClause ? `ORDER BY ${this.orderClause}` : "";
    const limit = this.limitCount ? `LIMIT ${this.limitCount}` : "";
    const sql = `SELECT ${cols} FROM ${this.table} ${where} ${order} ${limit}`.trim();
    const res = await this.d1.prepare(sql).all(this.params as any[]);
    return { data: res?.results ?? [] };
  }

  async select(cols?: string, opts?: { count?: "exact"; head?: boolean }) {
    const c = normalizeCols(cols as any);
    if (opts?.head && opts?.count === "exact") {
      const out = await this._selectRaw(c, true);
      return { count: out.count } as any;
    }
    const out = await this._selectRaw(c, false);
    return { data: out.data } as any;
  }

  async maybeSingle() {
    const prevLimit = this.limitCount;
    this.limitCount = 1;
    const out = await this._selectRaw("*", false);
    this.limitCount = prevLimit;
    return { data: (out.data && out.data.length ? out.data[0] : null), error: null } as any;
  }

  async single() {
    const prevLimit = this.limitCount;
    this.limitCount = 1;
    const out = await this._selectRaw("*", false);
    this.limitCount = prevLimit;
    if (!out.data || !out.data.length) return { data: null, error: new Error("Not found") };
    return { data: out.data[0], error: null } as any;
  }

  async insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
    const rows = Array.isArray(payload) ? payload : [payload];
    const inserted: any[] = [];
    for (const row of rows) {
      const cols = Object.keys(row).join(",");
      const placeholders = Object.keys(row).map(() => "?").join(",");
      const sql = `INSERT INTO ${this.table} (${cols}) VALUES (${placeholders}) RETURNING *`;
      const vals = Object.values(row).map((v) => (v === undefined ? null : v));
      const res = await this.d1.prepare(sql).all(vals as any[]);
      if (res?.results?.length) inserted.push(res.results[0]);
    }
    return { data: inserted, error: null } as any;
  }

  async upsert(payload: Record<string, unknown> | Record<string, unknown>[], opts?: { onConflict?: string }) {
    const rows = Array.isArray(payload) ? payload : [payload];
    const upserted: any[] = [];
    const conflict = opts?.onConflict;
    for (const row of rows) {
      const cols = Object.keys(row);
      const placeholders = cols.map(() => "?").join(",");
      const vals = cols.map((k) => (row[k] === undefined ? null : row[k]));
      if (conflict) {
        const setClause = cols.map((c) => `${c}=excluded.${c}`).join(",");
        const sql = `INSERT INTO ${this.table} (${cols.join(",")}) VALUES (${placeholders}) ON CONFLICT(${conflict}) DO UPDATE SET ${setClause} RETURNING *`;
        const res = await this.d1.prepare(sql).all(vals as any[]);
        if (res?.results?.length) upserted.push(res.results[0]);
      } else {
        const sql = `INSERT INTO ${this.table} (${cols.join(",")}) VALUES (${placeholders}) RETURNING *`;
        const res = await this.d1.prepare(sql).all(vals as any[]);
        if (res?.results?.length) upserted.push(res.results[0]);
      }
    }
    return { data: upserted, error: null } as any;
  }

  async update(payload: Record<string, unknown>) {
    if (!this.whereParts.length) throw new Error("Unsafe update without where clause");
    const setCols = Object.keys(payload).map((k) => `${k} = ?`).join(",");
    const vals = Object.values(payload).map((v) => (v === undefined ? null : v));
    const sql = `UPDATE ${this.table} SET ${setCols} WHERE ${this.whereParts.join(" AND ")} RETURNING *`;
    const res = await this.d1.prepare(sql).all([...vals, ...this.params] as any[]);
    return { data: res?.results ?? [], error: null } as any;
  }

  async delete() {
    if (!this.whereParts.length) throw new Error("Unsafe delete without where clause");
    const sql = `DELETE FROM ${this.table} WHERE ${this.whereParts.join(" AND ")} RETURNING *`;
    const res = await this.d1.prepare(sql).all(this.params as any[]);
    return { data: res?.results ?? [], error: null } as any;
  }
}

export function createD1Client(bindingName = DEFAULT_D1_BINDING_NAME) {
  const binding = resolveD1Binding(bindingName);
  if (!binding) throw new Error(`D1 binding '${bindingName}' not found in runtime`);

  // Ensure schema once in background
  (async () => {
    try {
      if (!_schemaEnsuredFor[bindingName]) {
        await ensureSchema(binding);
        _schemaEnsuredFor[bindingName] = true;
        try { console.log('[d1] schema ensured for', bindingName); } catch (e) {}
      }
    } catch (e) {
      try { console.error('[d1] schema ensure failed', e); } catch (e) {}
    }
  })();

  return {
    from(table: string) {
      return new QueryBuilder(table, binding) as any;
    },
    async rpc(name: string, params: Record<string, unknown>) {
      if (name === "has_role") {
        const userId = params._user_id as string;
        const role = params._role as string;
        const sql = `SELECT 1 FROM user_roles WHERE user_id = ? AND role = ? LIMIT 1`;
        const res = await binding.prepare(sql).all([userId, role]);
        const exists = (res?.results?.length ?? 0) > 0;
        return { data: exists, error: null } as any;
      }
      return { data: null, error: new Error("RPC not implemented") } as any;
    },
    auth: {
      async getClaims(_token: string) {
        return { data: { claims: null }, error: null } as any;
      },
    },
  } as const;
}
