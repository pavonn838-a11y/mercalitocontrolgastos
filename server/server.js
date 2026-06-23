import http from "node:http";
import fs from "node:fs/promises";
import fss from "node:fs";
import path from "node:path";
import url from "node:url";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import {
  audit,
  computeDashboard,
  ids,
  loadDb,
  normalizeExpenseFromImport,
  nowIso,
  saveDb,
  verifyPassword,
} from "./store.js";

const root = process.cwd();
const publicDir = path.join(root, "public");
const dataDir = process.env.DATA_DIR || path.join(root, "data");
const uploadDir = path.join(dataDir, "uploads");
const importDir = path.join(dataDir, "imports");
const attachmentDir = path.join(dataDir, "attachments");
const port = Number(process.env.PORT || 3100);
const host = process.env.HOST || "127.0.0.1";
const sessions = new Map();

await fs.mkdir(uploadDir, { recursive: true });
await fs.mkdir(importDir, { recursive: true });
await fs.mkdir(attachmentDir, { recursive: true });

const server = http.createServer(async (req, res) => {
  try {
    const parsed = url.parse(req.url, true);
    if (parsed.pathname.startsWith("/api/")) {
      await routeApi(req, res, parsed);
      return;
    }
    await serveStatic(req, res, parsed.pathname);
  } catch (error) {
    console.error(error);
    json(res, error.statusCode || 500, { error: error.statusCode ? error.message : "Error interno", detail: error.message });
  }
});

server.listen(port, host, () => {
  console.log(`Mercalito Control listo: http://${host}:${port}`);
});

async function routeApi(req, res, parsed) {
  const method = req.method;
  const route = parsed.pathname.replace(/^\/api\//, "");
  const db = await loadDb();
  const publicRoutes = ["login", "health"];
  const user = publicRoutes.includes(route) ? null : requireUser(req, db);

  if (route === "health") return json(res, 200, { ok: true });
  if (route === "login" && method === "POST") return login(req, res, db);
  if (route === "logout" && method === "POST") return logout(req, res);
  if (route === "me") return json(res, 200, { user: stripUser(user), roles: db.roles });
  if (route === "dashboard") return json(res, 200, computeDashboard(db, parsed.query));
  if (route === "lookups") return json(res, 200, lookups(db));
  if (route === "import/preview" && method === "POST") return importPreview(req, res, db, user);
  if (route === "import/confirm" && method === "POST") return importConfirm(req, res, db, user);
  if (route === "reports/monthly") return monthlyReport(res, db, parsed.query);
  if (route === "export/expenses.csv") return exportExpenses(res, db, parsed.query);

  const crud = route.match(/^([a-zA-Z]+)(?:\/([^/]+))?$/);
  if (crud) {
    const [, resource, id] = crud;
    if (["expenses", "suppliers", "payments", "banks", "bankMovements", "checks", "invoices", "budgets", "attachments", "alerts", "branches", "categories", "users", "auditLogs"].includes(resource)) {
      return crudRoute(req, res, db, user, resource, id, parsed.query);
    }
  }
  json(res, 404, { error: "Ruta no encontrada" });
}

function requireUser(req, db) {
  const token = cookie(req, "mc_session");
  const session = token ? sessions.get(token) : null;
  const user = session ? db.users.find((u) => u.id === session.userId && u.active !== false) : null;
  if (!user) {
    const err = new Error("No autenticado");
    err.statusCode = 401;
    throw err;
  }
  return user;
}

async function login(req, res, db) {
  const body = await readJson(req);
  const user = db.users.find((u) => u.email === body.email && u.active !== false);
  if (!user || !verifyPassword(body.password || "", user.passwordHash)) {
    return json(res, 401, { error: "Email o contraseña incorrectos" });
  }
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, { userId: user.id, createdAt: nowIso() });
  res.setHeader("Set-Cookie", `mc_session=${token}; HttpOnly; SameSite=Lax; Path=/`);
  json(res, 200, { user: stripUser(user) });
}

async function logout(req, res) {
  const token = cookie(req, "mc_session");
  if (token) sessions.delete(token);
  res.setHeader("Set-Cookie", "mc_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  json(res, 200, { ok: true });
}

async function crudRoute(req, res, db, user, resource, id, query) {
  const collection = db[resource];
  if (!Array.isArray(collection)) return json(res, 404, { error: "Recurso inválido" });
  if (req.method === "GET") {
    if (id) return json(res, 200, collection.find((item) => item.id === id) || null);
    return json(res, 200, filterCollection(collection, resource, query));
  }
  if (req.method === "POST") {
    const body = await readJson(req);
    const item = normalizeResource(db, resource, { ...body, id: body.id || ids.new(prefix(resource)), createdAt: nowIso(), updatedAt: nowIso() }, user.id);
    collection.unshift(item);
    if (resource === "payments" && item.expenseId) updateExpensePaymentState(db, item.expenseId);
    audit(db, user.id, resource, item.id, "create", null, item);
    await saveDb(db);
    return json(res, 201, item);
  }
  if (req.method === "PUT" && id) {
    const index = collection.findIndex((item) => item.id === id);
    if (index < 0) return json(res, 404, { error: "No encontrado" });
    const before = collection[index];
    const body = await readJson(req);
    const after = normalizeResource(db, resource, { ...before, ...body, id, updatedAt: nowIso() }, user.id);
    collection[index] = after;
    if (resource === "payments" && after.expenseId) updateExpensePaymentState(db, after.expenseId);
    audit(db, user.id, resource, id, "update", before, after);
    await saveDb(db);
    return json(res, 200, after);
  }
  if (req.method === "DELETE" && id) {
    if (!isAdmin(db, user)) return json(res, 403, { error: "Solo administrador puede borrar" });
    const index = collection.findIndex((item) => item.id === id);
    if (index < 0) return json(res, 404, { error: "No encontrado" });
    const [removed] = collection.splice(index, 1);
    audit(db, user.id, resource, id, "delete", removed, null);
    await saveDb(db);
    return json(res, 200, { ok: true });
  }
  json(res, 405, { error: "Método no permitido" });
}

function normalizeResource(db, resource, item, userId) {
  if (resource === "expenses") {
    item.totalAmount = Number(item.totalAmount || 0);
    item.netAmount = Number(item.netAmount || item.totalAmount || 0);
    item.iva = Number(item.iva || 0);
    item.otherTaxes = Number(item.otherTaxes || 0);
    item.month = item.month || String(item.date || "").slice(0, 7);
    const supplier = db.suppliers.find((s) => s.id === item.supplierId);
    item.supplierName = supplier?.name || item.supplierName || "";
    const branch = db.branches.find((b) => b.id === item.branchId);
    item.branchName = branch?.name || item.branchName || "";
    const category = db.categories.find((c) => c.id === item.categoryId);
    item.categoryName = item.categoryName || category?.name || "";
    item.loadedBy = item.loadedBy || userId;
  }
  if (resource === "payments") {
    item.amount = Number(item.amount || 0);
    if (item.expenseId) updateExpensePaymentState(db, item.expenseId);
  }
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
  }
  if (resource === "budgets") item.amount = Number(item.amount || 0);
  return item;
}

function updateExpensePaymentState(db, expenseId) {
  const expense = db.expenses.find((e) => e.id === expenseId);
  if (!expense) return;
  const paid = db.payments.filter((p) => p.expenseId === expenseId).reduce((acc, p) => acc + Number(p.amount || 0), 0);
  if (paid <= 0) return;
  if (paid >= Number(expense.totalAmount || 0)) expense.status = "Pagado";
  else expense.status = "Parcial";
  expense.paymentDate = db.payments.filter((p) => p.expenseId === expenseId).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]?.date || expense.paymentDate;
}

async function importPreview(req, res, db, user) {
  const upload = await readMultipartFile(req);
  const uploadPath = path.join(uploadDir, `${ids.new("upload")}_${safeName(upload.filename)}`);
  await fs.writeFile(uploadPath, upload.buffer);
  const rows = await parseExcel(uploadPath);
  const previewId = ids.new("preview");
  const mapped = rows.filter((row) => row && Object.keys(row).length).map((row) => ({
    ...row,
    _sourceHash: crypto.createHash("sha1").update(JSON.stringify(row)).digest("hex"),
  }));
  const existingHashes = new Set(db.expenses.map((e) => e.sourceHash).filter(Boolean));
  const previewRows = mapped.map((row) => {
    const normalized = normalizeExpenseFromImport(db, row, user.id, previewId);
    return { raw: row, normalized, duplicate: existingHashes.has(normalized.sourceHash) };
  });
  await fs.writeFile(path.join(importDir, `${previewId}.json`), JSON.stringify({ uploadPath, filename: upload.filename, rows: mapped }, null, 2));
  json(res, 200, {
    previewId,
    filename: upload.filename,
    totalRows: previewRows.length,
    duplicates: previewRows.filter((r) => r.duplicate).length,
    rows: previewRows.slice(0, 100),
  });
}

async function importConfirm(req, res, db, user) {
  const body = await readJson(req);
  const previewPath = path.join(importDir, `${body.previewId}.json`);
  const preview = JSON.parse(await fs.readFile(previewPath, "utf8"));
  const batchId = ids.new("batch");
  const existingHashes = new Set(db.expenses.map((e) => e.sourceHash).filter(Boolean));
  let imported = 0;
  let skipped = 0;
  for (const row of preview.rows) {
    const expense = normalizeExpenseFromImport(db, row, user.id, batchId);
    if (existingHashes.has(expense.sourceHash)) {
      skipped += 1;
      continue;
    }
    db.expenses.push(expense);
    existingHashes.add(expense.sourceHash);
    imported += 1;
  }
  const batch = {
    id: batchId,
    filename: preview.filename,
    rows: preview.rows.length,
    imported,
    skipped,
    userId: user.id,
    createdAt: nowIso(),
  };
  db.importBatches.unshift(batch);
  audit(db, user.id, "importBatches", batchId, "import", null, batch);
  await saveDb(db);
  json(res, 200, { batch, dashboard: computeDashboard(db, {}) });
}

async function parseExcel(filePath) {
  const python = process.env.PYTHON || "python3";
  const script = path.join(root, "scripts", "parse_excel.py");
  return new Promise((resolve, reject) => {
    const child = spawn(python, [script, filePath], {
      env: { ...process.env, PYTHONPATH: path.join(root, "vendor") },
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(err || `Excel parser salió con código ${code}`));
      else resolve(JSON.parse(out));
    });
  });
}

function filterCollection(collection, resource, query) {
  let rows = [...collection];
  if (query.month) rows = rows.filter((r) => r.month === query.month || String(r.date || "").slice(0, 7) === query.month);
  if (query.branchId) rows = rows.filter((r) => r.branchId === query.branchId);
  if (query.supplierId) rows = rows.filter((r) => r.supplierId === query.supplierId);
  if (query.status) rows = rows.filter((r) => r.status === query.status);
  if (query.search) {
    const s = String(query.search).toLowerCase();
    rows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(s));
  }
  return rows.slice(0, Number(query.limit || 1000));
}

function monthlyReport(res, db, query) {
  const dashboard = computeDashboard(db, query);
  json(res, 200, {
    ...dashboard,
    budgets: db.budgets.filter((b) => !query.month || b.month === query.month),
    imports: db.importBatches.slice(0, 20),
  });
}

function exportExpenses(res, db, query) {
  const rows = filterCollection(db.expenses, "expenses", query);
  const headers = ["date", "month", "supplierName", "categoryName", "branchName", "receiptType", "invoiceNumber", "totalAmount", "status", "dueDate", "paymentDate", "paymentMethod", "notes"];
  const csv = [headers.join(","), ...rows.map((row) => headers.map((h) => csvCell(row[h])).join(","))].join("\n");
  res.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": "attachment; filename=gastos_mercalito.csv",
  });
  res.end(csv);
}

function lookups(db) {
  return {
    branches: db.branches,
    categories: db.categories,
    suppliers: db.suppliers,
    banks: db.banks,
    roles: db.roles,
    paymentMethods: ["Efectivo", "Transferencia", "Cheque", "eCheq", "Débito automático", "Mercado Pago", "Tarjeta", "Otro"],
    expenseStatuses: ["Pendiente", "Pagado", "Parcial", "Vencido"],
    checkStatuses: ["Emitido", "Pendiente", "Pagado", "Rechazado", "Anulado", "En custodia", "Acordado"],
  };
}

async function serveStatic(req, res, pathname) {
  const file = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, file));
  if (!filePath.startsWith(publicDir)) return text(res, 403, "Forbidden");
  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) return text(res, 404, "Not found");
    res.writeHead(200, { "Content-Type": mime(filePath) });
    fss.createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    fss.createReadStream(path.join(publicDir, "index.html")).pipe(res);
  }
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function readMultipartFile(req) {
  const contentType = req.headers["content-type"] || "";
  const boundary = contentType.match(/boundary=(.+)$/)?.[1];
  if (!boundary) throw new Error("Falta boundary multipart");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = splitBuffer(buffer, boundaryBuffer);
  for (const part of parts) {
    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd < 0) continue;
    const header = part.slice(0, headerEnd).toString("utf8");
    if (!header.includes("filename=")) continue;
    const filename = header.match(/filename="([^"]+)"/)?.[1] || "upload.xlsx";
    let body = part.slice(headerEnd + 4);
    if (body.slice(-2).toString() === "\r\n") body = body.slice(0, -2);
    return { filename, buffer: body };
  }
  throw new Error("No se encontró archivo");
}

function splitBuffer(buffer, separator) {
  const parts = [];
  let start = 0;
  let index;
  while ((index = buffer.indexOf(separator, start)) !== -1) {
    if (index > start) parts.push(buffer.slice(start, index));
    start = index + separator.length;
  }
  if (start < buffer.length) parts.push(buffer.slice(start));
  return parts;
}

function cookie(req, name) {
  const cookies = req.headers.cookie || "";
  return cookies.split(";").map((x) => x.trim()).find((x) => x.startsWith(`${name}=`))?.split("=")[1];
}

function stripUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function isAdmin(db, user) {
  const role = db.roles.find((r) => r.id === user.roleId);
  return role?.name === "Administrador";
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

function safeName(name) {
  return String(name || "archivo").replace(/[^a-zA-Z0-9_.-]+/g, "_");
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function mime(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function text(res, status, data) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(data);
}
