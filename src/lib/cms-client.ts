// Browser-side CMS data client.
//
// A tiny PostgREST-shaped query builder that serialises to a descriptor and
// posts it to the `dbExec` server function, which runs it against Cloudflare D1.
// Keeping this shape means CMS hooks read the same way they always have while
// the runtime depends only on Cloudflare.
import { dbExec, type DbDescriptor } from "@/lib/db-api.functions";
import { getSessionUser, signIn, signOut, signUpFirstAdmin } from "@/lib/auth.functions";

export type DbResult<T> = { data: T; error: { message: string; code?: string } | null };

type Filter = DbDescriptor["filters"][number];

class QueryBuilder<T = any> implements PromiseLike<DbResult<T>> {
  private descriptor: {
    table: string;
    op: DbDescriptor["op"];
    columns?: string[];
    embed?: { table: string; foreignKey: string; orderBy?: string };
    filters: Filter[];
    order: Array<{ column: string; ascending: boolean }>;
    limit?: number;
    values?: Record<string, unknown> | Record<string, unknown>[];
    onConflict?: string;
  };
  private mode: "many" | "single" | "maybeSingle" = "many";

  constructor(table: string) {
    this.descriptor = { table, op: "select", filters: [], order: [] };
  }

  /** Accepts "a, b" and one level of "*, child(*)" embedding. */
  select(columns = "*") {
    const embedMatch = columns.match(/([a-z_][a-z0-9_]*)\s*\(([^)]*)\)/i);
    const plain = columns.replace(/([a-z_][a-z0-9_]*)\s*\(([^)]*)\)/gi, "").replace(/,\s*,/g, ",");
    const cols = plain
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c && c !== "*");
    if (cols.length) this.descriptor.columns = cols;
    if (embedMatch) {
      const childTable = embedMatch[1]!;
      this.descriptor.embed = {
        table: childTable,
        foreignKey: `${this.descriptor.table.replace(/s$/, "")}_id`,
        orderBy: "position",
      };
    }
    return this;
  }

  eq(column: string, value: unknown) {
    this.descriptor.filters.push({ column, op: "eq", value: value as never });
    return this;
  }
  neq(column: string, value: unknown) {
    this.descriptor.filters.push({ column, op: "neq", value: value as never });
    return this;
  }
  like(column: string, value: string) {
    this.descriptor.filters.push({ column, op: "like", value: value.replace(/%/g, "%") });
    return this;
  }
  gte(column: string, value: unknown) {
    this.descriptor.filters.push({ column, op: "gte", value: value as never });
    return this;
  }
  lte(column: string, value: unknown) {
    this.descriptor.filters.push({ column, op: "lte", value: value as never });
    return this;
  }
  in(column: string, values: Array<string | number>) {
    this.descriptor.filters.push({ column, op: "in", value: values });
    return this;
  }

  order(column: string, options?: { ascending?: boolean; referencedTable?: string }) {
    if (options?.referencedTable) {
      if (this.descriptor.embed) this.descriptor.embed.orderBy = column;
      return this;
    }
    this.descriptor.order.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  limit(count: number) {
    this.descriptor.limit = count;
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.descriptor.op = "insert";
    this.descriptor.values = values;
    return this;
  }

  upsert(values: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }) {
    this.descriptor.op = "upsert";
    this.descriptor.values = values;
    if (options?.onConflict) this.descriptor.onConflict = options.onConflict;
    return this;
  }

  update(values: Record<string, unknown>) {
    this.descriptor.op = "update";
    this.descriptor.values = values;
    return this;
  }

  delete() {
    this.descriptor.op = "delete";
    return this;
  }

  single() {
    this.mode = "single";
    return this;
  }

  maybeSingle() {
    this.mode = "maybeSingle";
    return this;
  }

  private async run(): Promise<DbResult<any>> {
    try {
      const { rows } = (await dbExec({ data: { ...this.descriptor, returning: true } as never })) as {
        rows: any[];
      };
      if (this.mode === "many") return { data: rows, error: null };
      if (rows.length) return { data: rows[0], error: null };
      if (this.mode === "maybeSingle") return { data: null, error: null };
      return { data: null, error: { message: "No rows found", code: "PGRST116" } };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Database request failed";
      return { data: this.mode === "many" ? [] : null, error: { message } };
    }
  }

  then<TResult1 = DbResult<T>, TResult2 = never>(
    onfulfilled?: ((value: DbResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(onfulfilled as never, onrejected as never);
  }
}

export type AuthUser = { id: string; email: string; role: string };

type AuthListener = (event: string, session: { user: AuthUser } | null) => void;
const listeners = new Set<AuthListener>();

function emit(user: AuthUser | null) {
  for (const listener of listeners) listener(user ? "SIGNED_IN" : "SIGNED_OUT", user ? { user } : null);
}

export const db = {
  from(table: string) {
    return new QueryBuilder(table);
  },
  auth: {
    async getUser(): Promise<{ data: { user: AuthUser | null }; error: null }> {
      try {
        const user = await getSessionUser();
        return { data: { user: user ?? null }, error: null };
      } catch {
        return { data: { user: null }, error: null };
      }
    },
    async signInWithPassword(credentials: { email: string; password: string }) {
      try {
        const user = await signIn({ data: credentials });
        emit(user ?? null);
        return { data: { user }, error: null };
      } catch (error) {
        return { data: { user: null }, error: { message: errorText(error) } };
      }
    },
    async signUp(credentials: { email: string; password: string }) {
      try {
        const user = await signUpFirstAdmin({ data: { email: credentials.email, password: credentials.password } });
        emit(user ?? null);
        return { data: { user }, error: null };
      } catch (error) {
        return { data: { user: null }, error: { message: errorText(error) } };
      }
    },
    async signOut() {
      try {
        await signOut();
      } finally {
        emit(null);
      }
      return { error: null };
    },
    onAuthStateChange(callback: AuthListener) {
      listeners.add(callback);
      return {
        data: {
          subscription: {
            unsubscribe() {
              listeners.delete(callback);
            },
          },
        },
      };
    },
  },
};

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message.replace(/^Error:\s*/, "");
  return "Request failed";
}
