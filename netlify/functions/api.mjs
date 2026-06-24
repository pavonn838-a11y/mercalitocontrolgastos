import crypto from "node:crypto";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appSecret = process.env.APP_SECRET || "change-this-secret";

const resources = {
  expenses: "expenses",
  suppliers: "suppliers",
  payments: "payments",
  banks: "banks",
  bankMovements: "bank_movements",
  checks: "checks",
  invoices: "invoices",
  budgets: "budgets",
  attachments: "attachments",
  alerts: "alerts",
  branches: "branches",
  categories: "expense_categories",
  users: "users",
  auditLogs: "audit_logs",
};

const keyToDb = {
  roleId: "role_id",
  branchId: "branch_id",
  categoryId: "category_id",
  supplierId: "supplier_id",
  subcategoryId: "subcategory_id",
  bankId: "bank_id",
  expenseId: "expense_id",
  checkId: "check_id",
  userId: "user_id",
  importBatchId: "import_batch_id",
  sourceHash: "source_hash",
  loadedBy: "loaded_by",
  createdAt: "created_at",
  updatedAt: "updated_at",
  passwordHash: "password_hash",
  supplierName: "supplier_name",
  branchName: "branch_name",
  categoryName: "category_name",
  invoiceNumber: "invoice_number",
  receiptType: "receipt_type",
  netAmount: "net_amount",
  totalAmount: "total_amount",
  otherTaxes: "other_taxes",
  dueDate: "due_date",
  paymentDate: "payment_date",
  paymentMethod: "payment_method",
  paymentTerms: "payment_terms",
  paymentDays: "payment_days",
  bankName: "bank_name",
  cbuAlias: "cbu_alias",
  aliasCbu: "alias_cbu",
  openingBalance: "opening_balance",
  currentBalance: "current_balance",
  issueDate: "issue_date",
  mercadoPago: "mercado_pago",
  storagePath: "storage_path",
  mimeType: "mime_type",
  sizeBytes: "size_bytes",
  uploadedBy: "uploaded_by",
  entityId: "entity_id",
  relatedEntity: "related_entity",
  relatedId: "related_id",
};

const dbToKey = Object.fromEntries(Object.entries(keyToDb).map(([k, v]) => [v, k]));
const paymentMethods = ["Efectivo", "Transferencia", "Cheque", "eCheq", "Débito automático", "Mercado Pago", "Tarjeta", "Otro"];
const expenseStatuses = ["Pendiente", "Pagado", "Parcial", "Vencido"];
const checkStatuses = ["Emitido", "Pendiente", "Pagado", "Rechazado", "Anulado", "En custodia", "Acordado"];

export async function handler(event) {
  try {
    if (!supabaseUrl || !serviceKey) {
      return json(500, { error: "Faltan variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY" });
    }
    const route = decodeURIComponent((event.path || "").replace(/^\/api\/?/, "").replace(/^\/\.netlify\/functions\/api\/?/, ""));
    const method = event.httpMethod || "GET";
    const query = event.queryStringParameters || {};
    const publicRoutes = ["login", "health"];
    const user = publicRoutes.includes(route) ? null : await requireUser(event);

    if (route === "health") return json(200, { ok: true });
    if (route === "login" && method === "POST") return login(event);
    if (route === "logout" && method === "POST") return logout();
    if (route === "me") return json(200, { user: stripUser(user) });
    if (route === "lookups") return json(200, await lookups());
    if (route === "dashboard") return json(200, await dashboard(query));
    if (route === "reports/monthly") return json(200, await monthlyReport(query));
    if (route === "export/expenses.csv") return exportExpenses(query);
    if (route === "import/preview" || route === "import/confirm") {
      return json(501, { error: "Importar Excel online queda pendiente. Cargá el Excel desde la app local o pedime activar importación en Netlify." });
    }

    const match = route.match(/^([a-zA-Z]+)(?:\/([^/]+))?$/);
    if (match && resources[match[1]]) return crud(method, match[1], match[2], query, event, user);

    return json(404, { error: "Ruta no encontrada" });
  } catch (error) {
    console.error(error);
    return json(error.statusCode || 500, { error: error.statusCode ? error.message : "Error interno" });
  }
}

async function login(event) {
  const body = parseJson(event.body);
  const users = await supa("users", { email: `eq.${body.email}`, limit: "1" });
  const user = fromDb(users[0]);
  if (!user || !verifyPassword(body.password || "", user.passwordHash)) return json(401, { error: "Email o contraseña incorrectos" });
  const token = signSession({ userId: user.id, exp: Date.now() + 1000 * 60 * 60 * 12 });
  return json(200, { user: stripUser(user) }, {
    "Set-Cookie": cookieHeader("mc_session", token, 60 * 60 * 12),
  });
}

function logout() {
  return json(200, { ok: true }, { "Set-Cookie": cookieHeader("mc_session", "", 0) });
}

async function requireUser(event) {
  const token = readCookie(event.headers.cookie || "", "mc_session");
  const session = token ? verifySession(token) : null;
  if (!session) throw statusError(401, "No autenticado");
  const rows = await supa("users", { id: `eq.${session.userId}`, limit: "1" });
  const user = fromDb(rows[0]);
  if (!user || user.active === false) throw statusError(401, "No autenticado");
  return user;
}

async function crud(method, resource, id, query, event, user) {
  const table = resources[resource];
  if (method === "GET") {
    if (id) {
      const rows = await supa(table, { id: `eq.${id}`, limit: "1" });
      return json(200, fromDb(rows[0]) || null);
    }
    const rows = await listResource(resource, query);
    return json(200, rows);
  }
  if (method === "POST") {
    const payload = await normalizePayload(resource, parseJson(event.body), user);
    const created = await supaInsert(table, [toDb(payload)]);
    await audit(user.id, resource, payload.id, "create", null, payload);
    return json(201, fromDb(created[0]) || payload);
  }
  if (method === "PUT" && id) {
    const before = fromDb((await supa(table, { id: `eq.${id}`, limit: "1" }))[0]);
    const payload = await normalizePayload(resource, { ...before, ...parseJson(event.body), id }, user);
    const updated = await supaPatch(table, id, toDb(payload));
    await audit(user.id, resource, id, "update", before, payload);
    return json(200, fromDb(updated[0]) || payload);
  }
  if (method === "DELETE" && id) {
    const before = fromDb((await supa(table, { id: `eq.${id}`, limit: "1" }))[0]);
    await supaDelete(table, id);
    await audit(user.id, resource, id, "delete", before, null);
    return json(200, { ok: true });
  }
  return json(405, { error: "Método no permitido" });
}

async function listResource(resource, query) {
  const table = resources[resource];
  const params = {};
  if (query.month) params.month = `eq.${query.month}`;
  if (query.branchId) params.branch_id = `eq.${query.branchId}`;
  if (query.supplierId) params.supplier_id = `eq.${query.supplierId}`;
  if (query.status) params.status = `eq.${query.status}`;
  const rows = (await selectAll(table, params)).map(fromDb);
  const search = String(query.search || "").toLowerCase();
  const filtered = search ? rows.filter((row) => JSON.stringify(row).toLowerCase().includes(search)) : rows;
  return filtered.slice(0, Number(query.limit || 1000));
}

async function lookups() {
  const [branches, categories, suppliers, banks, roles] = await Promise.all([
    selectAll("branches"),
    selectAll("expense_categories"),
    selectAll("suppliers"),
    selectAll("banks"),
    selectAll("roles"),
  ]);
  return {
    branches: branches.map(fromDb),
    categories: categories.map(fromDb),
    suppliers: suppliers.map(fromDb),
    banks: banks.map(fromDb),
    roles: roles.map(fromDb),
    paymentMethods,
    expenseStatuses,
    checkStatuses,
  };
}

async function dashboard(query = {}) {
  const month = query.month || "2026-05";
  const params = { month: `eq.${month}` };
  if (query.branchId) params.branch_id = `eq.${query.branchId}`;
  const [expensesRaw, invoicesRaw, paymentsRaw, checksRaw, budgetsRaw] = await Promise.all([
    selectAll("expenses", params),
    selectAll("invoices", params),
    selectAll("payments"),
    selectAll("checks"),
    selectAll("budgets", { month: `eq.${month}` }),
  ]);
  const expenses = expensesRaw.map(fromDb);
  const invoices = invoicesRaw.map(fromDb);
  const payments = paymentsRaw.map(fromDb).filter((p) => String(p.date || "").slice(0, 7) === month);
  const checks = checksRaw.map(fromDb).filter((c) => String(c.dueDate || "").slice(0, 7) === month);
  const paidExpenseIds = new Set(payments.map((p) => p.expenseId).filter(Boolean));
  const positive = expenses.filter((e) => Number(e.totalAmount || 0) > 0);
  const paidExpenses = positive.filter((e) => e.status === "Pagado" || paidExpenseIds.has(e.id));
  const pendingExpenses = positive.filter((e) => e.status !== "Pagado" && !paidExpenseIds.has(e.id));
  const today = new Date().toISOString().slice(0, 10);
  const overdue = pendingExpenses.filter((e) => e.dueDate && e.dueDate < today);
  const totalExpenses = sum(expenses, "totalAmount");
  const totalRevenue = sum(invoices, "totalAmount");
  return {
    month,
    totals: {
      expenses: totalExpenses,
      revenue: totalRevenue,
      result: totalRevenue - totalExpenses,
      paid: sum(paidExpenses, "totalAmount"),
      pending: sum(pendingExpenses, "totalAmount"),
      overdue: sum(overdue, "totalAmount"),
      payments: sum(payments, "amount"),
      checks: sum(checks, "amount"),
    },
    counts: {
      expenses: expenses.length,
      pending: pendingExpenses.length,
      overdue: overdue.length,
      checks: checks.length,
    },
    topSuppliers: group(expenses, "supplierName").slice(0, 10),
    byCategory: group(expenses, "categoryName"),
    byBranch: group(expenses, "branchName"),
    alerts: buildAlerts(expenses, checks, budgetsRaw.map(fromDb), month),
  };
}

async function monthlyReport(query) {
  const data = await dashboard(query);
  return { ...data, budgets: (await selectAll("budgets", query.month ? { month: `eq.${query.month}` } : {})).map(fromDb) };
}

async function exportExpenses(query) {
  const rows = await listResource("expenses", query);
  const headers = ["date", "month", "supplierName", "categoryName", "branchName", "receiptType", "invoiceNumber", "totalAmount", "status", "dueDate", "paymentDate", "paymentMethod", "notes"];
  const csv = [headers.join(","), ...rows.map((row) => headers.map((h) => csvCell(row[h])).join(","))].join("\n");
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=gastos_mercalito.csv",
    },
    body: csv,
  };
}

async function normalizePayload(resource, payload, user) {
  const item = { ...payload, id: payload.id || newId(prefix(resource)), updatedAt: new Date().toISOString() };
  if (!payload.createdAt) item.createdAt = new Date().toISOString();
  if (resource === "expenses") {
    item.totalAmount = Number(item.totalAmount || 0);
    item.netAmount = Number(item.netAmount || item.totalAmount || 0);
    item.iva = Number(item.iva || 0);
    item.otherTaxes = Number(item.otherTaxes || 0);
    item.month = item.month || String(item.date || "").slice(0, 7);
    if (item.supplierId) item.supplierName = fromDb((await supa("suppliers", { id: `eq.${item.supplierId}`, limit: "1" }))[0])?.name || item.supplierName || "";
    if (item.branchId) item.branchName = fromDb((await supa("branches", { id: `eq.${item.branchId}`, limit: "1" }))[0])?.name || item.branchName || "";
    if (item.categoryId) item.categoryName = fromDb((await supa("expense_categories", { id: `eq.${item.categoryId}`, limit: "1" }))[0])?.name || item.categoryName || "";
    item.loadedBy = item.loadedBy || user.id;
  }
  if (resource === "payments") item.amount = Number(item.amount || 0);
  if (resource === "checks") item.amount = Number(item.amount || 0);
  if (resource === "invoices") {
    item.totalAmount = Number(item.totalAmount || 0);
    item.cash = Number(item.cash || 0);
    item.debit = Number(item.debit || 0);
    item.credit = Number(item.credit || 0);
    item.mercadoPago = Number(item.mercadoPago || 0);
    item.transfers = Number(item.transfers || 0);
    item.other = Number(item.other || 0);
    item.month = item.month || String(item.date || "").slice(0, 7);
    if (item.branchId) item.branchName = fromDb((await supa("branches", { id: `eq.${item.branchId}`, limit: "1" }))[0])?.name || item.branchName || "";
  }
  if (resource === "budgets") item.amount = Number(item.amount || 0);
  return item;
}

async function audit(userId, entity, entityId, action, before, after) {
  await supaInsert("audit_logs", [toDb({
    id: newId("audit"),
    userId,
    entity,
    entityId,
    action,
    before,
    after,
    createdAt: new Date().toISOString(),
  })]).catch(() => {});
}

async function supa(table, filters = {}, options = {}) {
  const params = new URLSearchParams({ select: "*", ...filters });
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${params}`, {
    headers: supaHeaders(options.headers),
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function selectAll(table, filters = {}) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const rows = await supa(table, filters, { headers: { Range: `${from}-${from + 999}` } });
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

async function supaInsert(table, rows) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: supaHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function supaPatch(table, id, row) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: supaHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function supaDelete(table, id) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: supaHeaders(),
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
}

function supaHeaders(extra = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function fromDb(row) {
  if (!row) return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) out[dbToKey[key] || key] = value;
  return out;
}

function toDb(row) {
  const out = {};
  for (const [key, value] of Object.entries(row || {})) {
    if (value === undefined) continue;
    out[keyToDb[key] || key] = value === "" ? null : value;
  }
  return out;
}

function signSession(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", appSecret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verifySession(token) {
  const [data, sig] = String(token).split(".");
  if (!data || !sig) return null;
  const expected = crypto.createHmac("sha256", appSecret).update(data).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const computed = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return computed === hash;
}

function buildAlerts(expenses, checks, budgets, month) {
  const today = new Date().toISOString().slice(0, 10);
  const inSeven = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const alerts = [];
  for (const e of expenses) {
    if (Number(e.totalAmount || 0) <= 0 || e.status === "Pagado") continue;
    if (e.dueDate && e.dueDate < today) alerts.push({ level: "danger", title: "Gasto vencido", detail: `${e.supplierName} - ${money(e.totalAmount)}`, date: e.dueDate });
    else if (e.dueDate && e.dueDate <= inSeven) alerts.push({ level: "warn", title: "Pago próximo", detail: `${e.supplierName} - ${money(e.totalAmount)}`, date: e.dueDate });
  }
  for (const c of checks) {
    if (c.status !== "Pagado" && c.dueDate && c.dueDate <= inSeven) alerts.push({ level: c.dueDate < today ? "danger" : "warn", title: "Cheque/eCheq próximo", detail: `${c.beneficiary || ""} - ${money(c.amount)}`, date: c.dueDate });
  }
  return alerts.slice(0, 50);
}

function sum(rows, key) {
  return rows.reduce((acc, row) => acc + Number(row[key] || 0), 0);
}

function group(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const name = row[key] || "Sin dato";
    const item = map.get(name) || { name, total: 0, count: 0 };
    item.total += Number(row.totalAmount || 0);
    item.count += 1;
    map.set(name, item);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

function stripUser(user) {
  if (!user) return null;
  const { passwordHash, password_hash, ...safe } = user;
  return safe;
}

function parseJson(body) {
  return body ? JSON.parse(body) : {};
}

function json(statusCode, data, headers = {}) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
    body: JSON.stringify(data),
  };
}

function cookieHeader(name, value, maxAge) {
  return `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function readCookie(cookie, name) {
  return cookie.split(";").map((x) => x.trim()).find((x) => x.startsWith(`${name}=`))?.split("=")[1] || "";
}

function statusError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function prefix(resource) {
  return {
    expenses: "exp",
    suppliers: "sup",
    payments: "pay",
    banks: "bank",
    bankMovements: "mov",
    checks: "chk",
    invoices: "inv",
    budgets: "bud",
    attachments: "att",
    alerts: "al",
    branches: "branch",
    categories: "cat",
    users: "user",
  }[resource] || "id";
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function money(value) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value || 0));
}
