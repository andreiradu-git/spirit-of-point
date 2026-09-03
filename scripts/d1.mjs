// Small helper used by the db-* scripts to talk to Cloudflare D1 over the HTTP API.
// Requires: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_D1_DATABASE_ID
const API = "https://api.cloudflare.com/client/v4";

export function config() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  if (!accountId || !apiToken || !databaseId) {
    throw new Error(
      "Missing CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN or CLOUDFLARE_D1_DATABASE_ID",
    );
  }
  return { accountId, apiToken, databaseId };
}

export async function d1Query(sql, params = []) {
  const { accountId, apiToken, databaseId } = config();
  const res = await fetch(`${API}/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(JSON.stringify(json.errors));
  return json.result ?? [];
}

// Split a .sql file into individual statements (handles quotes, comments, BEGIN..END blocks).
export function splitStatements(sql) {
  const out = [];
  let current = "";
  let quote = null;
  let lineComment = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (lineComment) {
      if (ch === "\n") lineComment = false;
      current += ch;
      continue;
    }
    if (!quote && ch === "-" && next === "-") {
      lineComment = true;
      current += ch;
      continue;
    }
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === ";") {
      if (current.trim()) out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}
