import { loadEnv } from "./load_env.js";

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}

const tables = [
  "roles",
  "branches",
  "expense_categories",
  "expense_subcategories",
  "users",
  "suppliers",
  "banks",
  "import_batches",
  "expenses",
  "invoices",
  "checks",
  "payments",
  "bank_movements",
  "budgets",
  "attachments",
  "alerts",
  "audit_logs",
];

for (const table of tables) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id`, {
    method: "HEAD",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "count=exact",
    },
  });
  if (!res.ok) {
    console.log(`${table}: error ${res.status}`);
    continue;
  }
  console.log(`${table}: ${res.headers.get("content-range") || "sin conteo"}`);
}
