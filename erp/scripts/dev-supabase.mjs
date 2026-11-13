#!/usr/bin/env node
// Local stand-in for Supabase (Auth + PostgREST subset) on top of a plain PostgreSQL
// database that has the migrations applied. Development / screenshots only — never production.
//
//   PGHOST=localhost PGUSER=postgres PGDATABASE=erp_dev node scripts/dev-supabase.mjs
//   then build/run the app with NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
//   and NEXT_PUBLIC_SUPABASE_ANON_KEY=<printed anon key>
import http from "node:http";
import crypto from "node:crypto";
import pg from "pg";

const PORT = Number(process.env.PORT || 54321);
const SECRET = process.env.JWT_SECRET || "dev-secret-not-for-production";
const pool = new pg.Pool();

const b64u = (b) => Buffer.from(b).toString("base64url");
function sign(payload) {
  const h = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const p = b64u(JSON.stringify(payload));
  const s = crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${s}`;
}
function verify(token) {
  const [h, p, s] = String(token || "").split(".");
  if (!s) return null;
  const exp = crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url");
  if (exp !== s) return null;
  const claims = JSON.parse(Buffer.from(p, "base64url").toString());
  if (claims.exp && claims.exp < Date.now() / 1000) return null;
  return claims;
}
export const ANON_KEY = sign({ role: "anon", iss: "dev" });

const refreshTokens = new Map();
function session(user) {
  const now = Math.floor(Date.now() / 1000);
  const access_token = sign({ sub: user.id, role: "authenticated", email: user.email, exp: now + 3600, aud: "authenticated" });
  const refresh_token = crypto.randomBytes(24).toString("hex");
  refreshTokens.set(refresh_token, user.id);
  return { access_token, refresh_token, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, user: userJson(user) };
}
const userJson = (u) => ({ id: u.id, aud: "authenticated", role: "authenticated", email: u.email, user_metadata: u.raw_user_meta_data || {},
  app_metadata: { provider: "email" }, created_at: u.created_at, email_confirmed_at: u.created_at });

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const s = Buffer.concat(chunks).toString();
  return s ? JSON.parse(s) : {};
}
function send(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(body === undefined ? "" : JSON.stringify(body));
}
const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(s)) throw Object.assign(new Error(`bad identifier ${s}`), { status: 400 });
  return `"${s}"`;
};

// Run a statement as the requesting role, inside a transaction.
async function asRole(claims, fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    const role = claims?.role === "authenticated" ? "authenticated" : "anon";
    await c.query(`set local role ${role}`);
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims || { role: "anon" })]);
    const r = await fn(c);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

const OPS = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "like", ilike: "ilike" };
function parseFilter(col, expr, params) {
  let not = false;
  if (expr.startsWith("not.")) { not = true; expr = expr.slice(4); }
  const dot = expr.indexOf(".");
  const op = expr.slice(0, dot), val = expr.slice(dot + 1);
  let sql;
  if (op === "is") sql = `${ident(col)} is ${val === "null" ? "null" : val === "true" ? "true" : "false"}`;
  else if (op === "in") {
    const items = val.replace(/^\(|\)$/g, "").split(",").map((v) => v.replace(/^"|"$/g, ""));
    params.push(items);
    sql = `${ident(col)}::text = any($${params.length})`;
  } else if (OPS[op]) {
    params.push(op.endsWith("like") ? val.replace(/\*/g, "%") : val);
    sql = `${ident(col)}::text ${OPS[op]} $${params.length}`;
    if (["gt", "gte", "lt", "lte", "eq", "neq"].includes(op)) sql = `${ident(col)} ${OPS[op]} $${params.length}`;
  } else throw Object.assign(new Error(`unsupported operator ${op}`), { status: 400 });
  return not ? `not (${sql})` : sql;
}
function parseOr(expr, params) {
  // or=(a.eq.1,b.ilike.*x*)
  const inner = expr.replace(/^\(|\)$/g, "");
  const parts = [];
  let depth = 0, cur = "";
  for (const ch of inner) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; } else cur += ch;
  }
  if (cur) parts.push(cur);
  return "(" + parts.map((p) => { const i = p.indexOf("."); return parseFilter(p.slice(0, i), p.slice(i + 1), params); }).join(" or ") + ")";
}
function buildWhere(sp, params) {
  const conds = [];
  for (const [k, v] of sp.entries()) {
    if (["select", "order", "limit", "offset", "columns", "on_conflict"].includes(k)) continue;
    if (k === "or") conds.push(parseOr(v, params));
    else conds.push(parseFilter(k, v, params));
  }
  return conds.length ? " where " + conds.join(" and ") : "";
}
function selectList(s) {
  if (!s || s === "*") return "*";
  return s.split(",").map((c) => c.trim()).filter(Boolean).map((c) => {
    const [name, alias] = c.includes(":") ? c.split(":").reverse() : [c, null];
    return alias ? `${ident(name)} as ${ident(alias)}` : ident(name);
  }).join(", ");
}

async function rest(req, res, claims, path, sp) {
  const params = [];
  if (path.startsWith("rpc/")) {
    const fn = path.slice(4);
    const args = req.method === "GET" ? Object.fromEntries(sp.entries()) : await readBody(req);
    const meta = await pool.query(
      `select p.proretset, t.typname, coalesce(p.proargnames, '{}') as names, p.proargtypes::regtype[]::text[] as types
         from pg_proc p join pg_type t on t.oid = p.prorettype join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = $1`, [fn]);
    if (!meta.rows.length) return send(res, 404, { message: `function ${fn} not found`, code: "PGRST202" });
    const m = meta.rows[0];
    const named = Object.entries(args).map(([k, v]) => {
      const idx = m.names.indexOf(k);
      const type = idx >= 0 ? m.types[idx] : "text";
      params.push(v !== null && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v)
        : Array.isArray(v) && type === "jsonb" ? JSON.stringify(v) : v);
      return `${ident(k)} => $${params.length}::${type}`;
    }).join(", ");
    const call = `public.${ident(fn)}(${named})`;
    const sql = m.proretset
      ? `select coalesce(jsonb_agg(t), '[]'::jsonb) as r from ${call} t`
      : m.typname === "void" ? `select ${call}, null::jsonb as r` : `select to_jsonb(${call}) as r`;
    const r = await asRole(claims, (c) => c.query(sql, params));
    return send(res, 200, r.rows[0].r);
  }
  const table = ident(path);
  if (req.method === "GET" || req.method === "HEAD") {
    const where = buildWhere(sp, params);
    let sql = `select ${selectList(sp.get("select"))} from public.${table}${where}`;
    if (sp.get("order")) sql += " order by " + sp.get("order").split(",").map((o) => {
      const [col, dir, nulls] = o.split(".");
      return `${ident(col)} ${dir === "desc" ? "desc" : "asc"}${nulls === "nullslast" ? " nulls last" : nulls === "nullsfirst" ? " nulls first" : ""}`;
    }).join(", ");
    const range = req.headers["range"];
    let limit = sp.get("limit"), offset = sp.get("offset");
    if (range && /^\d+-\d+$/.test(range)) { const [a, b] = range.split("-").map(Number); offset = a; limit = b - a + 1; }
    const countSql = `select count(*)::int as n from public.${table}${where}`;
    if (limit) sql += ` limit ${Number(limit)}`;
    if (offset) sql += ` offset ${Number(offset)}`;
    const wantCount = /count=exact/.test(req.headers["prefer"] || "");
    const { rows, n } = await asRole(claims, async (c) => {
      const r = await c.query(sql, params);
      const n = wantCount ? (await c.query(countSql, params)).rows[0].n : undefined;
      return { rows: r.rows, n };
    });
    const start = Number(offset || 0);
    const headers = { "content-range": `${start}-${start + rows.length - 1}/${n ?? "*"}` };
    if ((req.headers["accept"] || "").includes("vnd.pgrst.object")) {
      if (rows.length !== 1) return send(res, 406, { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116", details: `${rows.length} rows` });
      return send(res, 200, rows[0], headers);
    }
    return send(res, 200, req.method === "HEAD" ? undefined : rows, headers);
  }
  if (req.method === "POST" || req.method === "PATCH") {
    const body = await readBody(req);
    const rowsIn = Array.isArray(body) ? body : [body];
    let sql;
    if (req.method === "POST") {
      const cols = Object.keys(rowsIn[0]);
      const values = rowsIn.map((r) => "(" + cols.map((c) => { params.push(r[c] !== null && typeof r[c] === "object" ? JSON.stringify(r[c]) : r[c]); return `$${params.length}`; }).join(", ") + ")").join(", ");
      sql = `insert into public.${table} (${cols.map(ident).join(", ")}) values ${values} returning *`;
    } else {
      const sets = Object.entries(body).map(([k, v]) => { params.push(v !== null && typeof v === "object" ? JSON.stringify(v) : v); return `${ident(k)} = $${params.length}`; });
      sql = `update public.${table} set ${sets.join(", ")}${buildWhere(sp, params)} returning *`;
    }
    const r = await asRole(claims, (c) => c.query(sql, params));
    if ((req.headers["accept"] || "").includes("vnd.pgrst.object")) return send(res, 200, r.rows[0] ?? null);
    return /return=representation/.test(req.headers["prefer"] || "") ? send(res, 201, r.rows) : send(res, 204);
  }
  send(res, 405, { message: "method not allowed" });
}

async function auth(req, res, claims, path, sp) {
  if (path === "signup" && req.method === "POST") {
    const { email, password, data } = await readBody(req);
    const ex = await pool.query("select 1 from auth.users where lower(email) = lower($1)", [email]);
    if (ex.rows.length) return send(res, 422, { code: 422, error_code: "user_already_exists", msg: "User already registered" });
    const r = await pool.query(
      "insert into auth.users(email, encrypted_password, raw_user_meta_data) values (lower($1), crypt($2, gen_salt('bf')), coalesce($3,'{}')::jsonb) returning *",
      [email, password, data ? JSON.stringify(data) : null]);
    return send(res, 200, session(r.rows[0]));
  }
  if (path === "token" && req.method === "POST") {
    const body = await readBody(req);
    if (sp.get("grant_type") === "password") {
      const r = await pool.query("select * from auth.users where lower(email) = lower($1) and encrypted_password = crypt($2, encrypted_password)",
        [body.email, body.password]);
      if (!r.rows.length) return send(res, 400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
      return send(res, 200, session(r.rows[0]));
    }
    if (sp.get("grant_type") === "refresh_token") {
      const id = refreshTokens.get(body.refresh_token);
      if (!id) return send(res, 400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
      const r = await pool.query("select * from auth.users where id = $1", [id]);
      return send(res, 200, session(r.rows[0]));
    }
  }
  if (path === "user" && req.method === "GET") {
    if (!claims?.sub) return send(res, 401, { code: 401, msg: "invalid JWT" });
    const r = await pool.query("select * from auth.users where id = $1", [claims.sub]);
    return send(res, 200, userJson(r.rows[0]));
  }
  if (path === "logout") return send(res, 204);
  send(res, 404, { msg: "not found" });
}

http.createServer(async (req, res) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS,HEAD");
  res.setHeader("access-control-expose-headers", "content-range");
  if (req.method === "OPTIONS") return send(res, 204);
  const url = new URL(req.url, "http://x");
  const token = (req.headers["authorization"] || "").replace(/^Bearer /i, "");
  const claims = verify(token);
  try {
    if (url.pathname.startsWith("/rest/v1/")) return await rest(req, res, claims, url.pathname.slice(9), url.searchParams);
    if (url.pathname.startsWith("/auth/v1/")) return await auth(req, res, claims, url.pathname.slice(9), url.searchParams);
    send(res, 404, { message: "not found" });
  } catch (e) {
    send(res, e.status || 400, { message: e.message, code: e.code, details: e.detail ?? null, hint: e.hint ?? null });
  }
}).listen(PORT, () => {
  console.log(`dev-supabase listening on http://localhost:${PORT}`);
  console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}`);
});
