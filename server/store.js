import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const dataDir = process.env.DATA_DIR || path.join(root, "data");
const dbPath = path.join(dataDir, "db.json");

export const ids = {
  new(prefix) {
    return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
  },
};

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  return hashPassword(password, salt).split(":")[1] === hash;
}

export function nowIso() {
  return new Date().toISOString();
}

function monthKey(date) {
  if (!date) return "";
  return String(date).slice(0, 7);
}

export const defaults = {
  roles: [
    { id: "role_admin", name: "Administrador" },
    { id: "role_office", name: "Oficina" },
    { id: "role_manager", name: "Encargado" },
    { id: "role_readonly", name: "Consulta" },
  ],
  branches: [
    "Olavarría",
    "Falucho",
    "Moreno",
    "Hipólito",
    "Santa Fe",
    "Edison",
    "Edison y Génova",
    "Oficina",
    "Depósito",
    "General / Casa central",
  ].map((name, index) => ({ id: `branch_${index + 1}`, name, active: true })),
  categories: [
    "Mercadería",
    "Verdulería",
    "Fiambres",
    "Bebidas",
    "Limpieza",
    "Alquileres",
    "Sueldos",
    "Cargas sociales",
    "Impuestos",
    "Servicios",
    "Luz",
    "Gas",
    "Internet",
    "Teléfono",
    "Mantenimiento",
    "Obras",
    "Equipamiento",
    "Heladeras",
    "Góndolas",
    "Cartelería",
    "Marketing",
    "Contador",
    "Banco",
    "Intereses",
    "Fletes",
    "Combustible",
    "Vehículos",
    "Seguridad",
    "Sistemas",
    "Otros",
  ].map((name, index) => ({ id: `cat_${index + 1}`, name, active: true })),
  paymentMethods: ["Efectivo", "Transferencia", "Cheque", "eCheq", "Débito automático", "Mercado Pago", "Tarjeta", "Otro"],
  expenseStatuses: ["Pendiente", "Pagado", "Parcial", "Vencido"],
  checkStatuses: ["Emitido", "Pendiente", "Pagado", "Rechazado", "Anulado", "En custodia", "Acordado"],
};

export function emptyDb() {
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || "admin@mercalito.local";
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";
  return {
    meta: { version: 1, createdAt: nowIso(), updatedAt: nowIso() },
    users: [
      {
        id: "user_admin",
        name: "Administrador",
        email: adminEmail,
        passwordHash: hashPassword(adminPassword),
        roleId: "role_admin",
        branchId: null,
        active: true,
        createdAt: nowIso(),
      },
    ],
    roles: defaults.roles,
    branches: defaults.branches,
    categories: defaults.categories,
    subcategories: [],
    suppliers: [],
    expenses: [],
    payments: [],
    banks: [],
    bankMovements: [],
    checks: [],
    invoices: [],
    budgets: [],
    attachments: [],
    importBatches: [],
    auditLogs: [],
    alerts: [],
  };
}

export async function loadDb() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    return JSON.parse(await fs.readFile(dbPath, "utf8"));
  } catch {
    const db = emptyDb();
    await saveDb(db);
    return db;
  }
}

export async function saveDb(db) {
  db.meta.updatedAt = nowIso();
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dbPath, JSON.stringify(db, null, 2), "utf8");
}

export function audit(db, userId, entity, entityId, action, before, after) {
  db.auditLogs.unshift({
    id: ids.new("audit"),
    userId,
    entity,
    entityId,
    action,
    before,
    after,
    createdAt: nowIso(),
  });
}

export function upsertSupplier(db, name, extras = {}) {
  const clean = String(name || "Sin proveedor").trim() || "Sin proveedor";
  let supplier = db.suppliers.find((s) => s.name.toLowerCase() === clean.toLowerCase());
  if (!supplier) {
    supplier = {
      id: ids.new("sup"),
      name: clean,
      cuit: extras.cuit || "",
      category: extras.category || "",
      contact: "",
      phone: "",
      email: "",
      address: "",
      paymentTerms: "",
      paymentDays: "",
      bankName: "",
      cbuAlias: "",
      notes: "",
      active: true,
      createdAt: nowIso(),
    };
    db.suppliers.push(supplier);
  }
  return supplier;
}

export function findBranchId(db, raw) {
  const value = String(raw || "").toLowerCase();
  const rules = [
    ["OLAVARRIA", "Olavarría"],
    ["FALUCHO", "Falucho"],
    ["MORENO", "Moreno"],
    ["HIPOLITO", "Hipólito"],
    ["SANTA", "Santa Fe"],
    ["EDISON", "Edison"],
    ["BELGRANO", "Depósito"],
    ["DEPOSITO", "Depósito"],
    ["GENOVA", "Edison y Génova"],
  ];
  const hit = rules.find(([needle]) => value.includes(needle.toLowerCase()));
  const name = hit ? hit[1] : "General / Casa central";
  return db.branches.find((b) => b.name === name)?.id || null;
}

export function findCategoryId(db, raw) {
  const value = String(raw || "").toLowerCase();
  const rules = [
    ["ALQUILER", "Alquileres"],
    ["IMPUEST", "Impuestos"],
    ["EDEA", "Luz"],
    ["LUZ", "Luz"],
    ["SERVICIO", "Servicios"],
    ["LIMPIEZA", "Limpieza"],
    ["BEBID", "Bebidas"],
    ["FIAMBR", "Fiambres"],
    ["FRIO", "Mercadería"],
    ["LACTEO", "Mercadería"],
    ["ALMACEN", "Mercadería"],
    ["MERCADO", "Verdulería"],
    ["PANIFIC", "Mercadería"],
    ["KIOS", "Mercadería"],
    ["SUELDO", "Sueldos"],
    ["BANCO", "Banco"],
    ["INTERES", "Intereses"],
  ];
  const hit = rules.find(([needle]) => value.includes(needle.toLowerCase()));
  const name = hit ? hit[1] : "Otros";
  return db.categories.find((c) => c.name === name)?.id || null;
}

export function normalizeExpenseFromImport(db, row, userId, batchId) {
  const supplier = upsertSupplier(db, row["Razon Social"] || row.provider || "Sin proveedor", {
    category: row["Centro Costos"] || "",
  });
  const total = Number(row.Total || row.total || 0);
  const date = row.Fecha || row.date || new Date().toISOString().slice(0, 10);
  const categoryRaw = row["Centro Costos"] || row.category || "";
  const branchRaw = row.Sucursal || row.branch || "";
  const isCredit = total < 0;
  return {
    id: ids.new("exp"),
    date,
    month: monthKey(date),
    supplierId: supplier.id,
    supplierName: supplier.name,
    cuit: "",
    categoryId: findCategoryId(db, categoryRaw),
    categoryName: categoryRaw || "Sin categoría",
    subcategoryId: null,
    branchId: findBranchId(db, branchRaw),
    branchName: branchRaw || "General",
    description: row.description || row["Razon Social"] || "",
    invoiceNumber: row.Numero || "",
    receiptType: row.Comprobante || "Otro",
    netAmount: total,
    iva: 0,
    otherTaxes: 0,
    totalAmount: total,
    status: isCredit ? "Pagado" : "Pendiente",
    dueDate: row["Fecha Contable"] || "",
    paymentDate: "",
    paymentMethod: "",
    bankId: null,
    notes: "",
    importBatchId: batchId,
    sourceHash: sourceHash(row),
    loadedBy: userId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function sourceHash(row) {
  const raw = [
    row.Sucursal,
    String(row["Centro Costos"] || "").trim().toUpperCase() === "SIN CATEGORIA" ? "" : row["Centro Costos"],
    row["Razon Social"],
    row.Comprobante,
    row.Fecha,
    row.Numero,
    row.Total,
  ].map((value) => String(value ?? "").trim().replace(/\s+/g, " ")).join("|");
  return crypto.createHash("sha1").update(raw).digest("hex");
}

export function computeDashboard(db, query = {}) {
  const month = query.month || latestMonth(db) || new Date().toISOString().slice(0, 7);
  const branchId = query.branchId || "";
  const category = query.category || "";
  const supplierId = query.supplierId || "";
  const expenses = db.expenses.filter((e) => {
    if (month && e.month !== month) return false;
    if (branchId && e.branchId !== branchId) return false;
    if (category && e.categoryName !== category && e.categoryId !== category) return false;
    if (supplierId && e.supplierId !== supplierId) return false;
    return true;
  });
  const invoices = db.invoices.filter((i) => i.month === month && (!branchId || i.branchId === branchId));
  const payments = db.payments.filter((p) => monthKey(p.date) === month);
  const checks = db.checks.filter((c) => c.dueDate && c.dueDate.slice(0, 7) === month);
  const totalExpenses = sum(expenses, "totalAmount");
  const totalRevenue = sum(invoices, "totalAmount");
  const paidExpenseIds = new Set(payments.map((p) => p.expenseId).filter(Boolean));
  const paidExpenses = expenses.filter((e) => Number(e.totalAmount || 0) > 0 && (e.status === "Pagado" || paidExpenseIds.has(e.id)));
  const pendingExpenses = expenses.filter((e) => Number(e.totalAmount || 0) > 0 && e.status !== "Pagado" && !paidExpenseIds.has(e.id));
  const overdue = pendingExpenses.filter((e) => e.dueDate && e.dueDate < new Date().toISOString().slice(0, 10));
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
    alerts: buildAlerts(db, month),
  };
}

export function latestMonth(db) {
  return [...new Set(db.expenses.map((e) => e.month).filter(Boolean))].sort().pop();
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

export function buildAlerts(db, month) {
  const today = new Date().toISOString().slice(0, 10);
  const inSeven = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const alerts = [];
  for (const e of db.expenses) {
    if (e.status !== "Pagado" && e.dueDate && e.dueDate < today) {
      alerts.push({ level: "danger", title: "Gasto vencido", detail: `${e.supplierName} - ${money(e.totalAmount)}`, date: e.dueDate });
    } else if (e.status !== "Pagado" && e.dueDate && e.dueDate <= inSeven) {
      alerts.push({ level: "warn", title: "Pago próximo", detail: `${e.supplierName} - ${money(e.totalAmount)}`, date: e.dueDate });
    }
  }
  for (const c of db.checks) {
    if (c.status !== "Pagado" && c.dueDate && c.dueDate <= inSeven) {
      alerts.push({ level: c.dueDate < today ? "danger" : "warn", title: "Cheque/eCheq próximo", detail: `${c.beneficiary} - ${money(c.amount)}`, date: c.dueDate });
    }
  }
  for (const b of db.budgets.filter((b) => b.month === month)) {
    const spent = db.expenses
      .filter((e) => e.month === month && (!b.branchId || e.branchId === b.branchId) && (!b.categoryId || e.categoryId === b.categoryId) && (!b.supplierId || e.supplierId === b.supplierId))
      .reduce((acc, e) => acc + Number(e.totalAmount || 0), 0);
    if (Number(b.amount || 0) > 0 && spent > Number(b.amount)) {
      alerts.push({ level: "warn", title: "Presupuesto superado", detail: `${b.name || "Presupuesto"}: ${money(spent)} / ${money(b.amount)}`, date: month });
    }
  }
  return alerts.slice(0, 50);
}

function money(value) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value || 0));
}
