import fs from "node:fs/promises";
import { loadEnv } from "./load_env.js";

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}

const db = JSON.parse(await fs.readFile("data/db.json", "utf8"));

const tableMap = [
  ["roles", db.roles],
  ["branches", db.branches],
  ["expense_categories", db.categories],
  ["expense_subcategories", db.subcategories],
  ["users", db.users],
  ["suppliers", db.suppliers],
  ["banks", db.banks],
  ["import_batches", db.importBatches],
  ["expenses", db.expenses],
  ["invoices", db.invoices],
  ["checks", db.checks],
  ["payments", db.payments],
  ["bank_movements", db.bankMovements],
  ["budgets", db.budgets],
  ["attachments", db.attachments],
  ["alerts", db.alerts],
  ["audit_logs", db.auditLogs],
];

const keyMap = {
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

function convertRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined) continue;
    const dbKey = keyMap[key] || key;
    if (dbKey === "passwordHash") out.password_hash = value;
    else out[dbKey] = value === "" ? null : value;
  }
  return out;
}

async function request(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
        ...options,
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
          ...(options.headers || {}),
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${options.method || "GET"} ${path} -> ${res.status}: ${text}`);
      }
      return;
    } catch (error) {
      lastError = error;
      if (attempt === 4) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw lastError;
}

async function clearTable(table) {
  await request(`${table}?id=not.is.null`, { method: "DELETE" });
}

async function insertRows(table, rows) {
  if (!rows.length) return;
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize).map(convertRow);
    await request(table, { method: "POST", body: JSON.stringify(chunk) });
    console.log(`${table}: ${Math.min(i + chunk.length, rows.length)}/${rows.length}`);
  }
}

console.log("Limpiando tablas...");
for (const [table] of [...tableMap].reverse()) {
  await clearTable(table).catch((error) => {
    if (!String(error.message).includes("does not exist")) throw error;
  });
}

console.log("Subiendo datos...");
for (const [table, rows] of tableMap) {
  await insertRows(table, rows || []);
}

console.log("Migración a Supabase terminada.");
