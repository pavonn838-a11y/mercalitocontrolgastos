import fs from "node:fs/promises";
import path from "node:path";
import {
  audit,
  emptyDb,
  normalizeExpenseFromImport,
  nowIso,
  saveDb,
} from "../server/store.js";

const root = process.cwd();
const db = emptyDb();
const rawPath = path.join(root, "..", "work", "gastos_mayo", "raw_records.json");
const batchId = "batch_gastos_mayo_2026";

let rows = [];
try {
  rows = JSON.parse(await fs.readFile(rawPath, "utf8"));
} catch {
  rows = [];
}

for (const row of rows) {
  const expense = normalizeExpenseFromImport(db, row, "user_admin", batchId);
  db.expenses.push(expense);
}

db.importBatches.push({
  id: batchId,
  filename: "GASTOS MAYO 2026.xls",
  rows: rows.length,
  imported: rows.length,
  skipped: 0,
  userId: "user_admin",
  createdAt: nowIso(),
});

const olavarria = db.branches.find((b) => b.name === "General / Casa central")?.id || db.branches[0]?.id;
db.invoices.push({
  id: "inv_mayo_2026_total",
  date: "2026-05-31",
  month: "2026-05",
  branchId: olavarria,
  branchName: "General / Casa central",
  totalAmount: 828577474,
  cash: 0,
  debit: 0,
  credit: 0,
  mercadoPago: 0,
  transfers: 0,
  other: 0,
  notes: "Facturación total de mayo informada manualmente.",
  createdAt: nowIso(),
  updatedAt: nowIso(),
});

db.banks.push(
  { id: "bank_1", name: "Banco principal", account: "", aliasCbu: "", openingBalance: 0, currentBalance: 0, notes: "", createdAt: nowIso(), updatedAt: nowIso() },
  { id: "bank_2", name: "Mercado Pago", account: "", aliasCbu: "", openingBalance: 0, currentBalance: 0, notes: "", createdAt: nowIso(), updatedAt: nowIso() },
);

audit(db, "user_admin", "seed", "initial", "create", null, {
  expenses: db.expenses.length,
  invoices: db.invoices.length,
});

await saveDb(db);
console.log(`Seed listo: ${db.expenses.length} gastos, ${db.suppliers.length} proveedores.`);
