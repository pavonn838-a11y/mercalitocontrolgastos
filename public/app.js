const state = {
  user: null,
  view: "dashboard",
  lookups: null,
  dashboard: null,
  rows: {},
  filters: {
    month: "2026-05",
    search: "",
    branchId: "",
    status: "",
  },
  preview: null,
};

const views = [
  ["dashboard", "Dashboard"],
  ["expenses", "Gastos"],
  ["import", "Importar Excel"],
  ["suppliers", "Proveedores"],
  ["payments", "Pagos"],
  ["checks", "Cheques/eCheq"],
  ["invoices", "Facturación"],
  ["banks", "Bancos"],
  ["budgets", "Presupuestos"],
  ["reports", "Reportes"],
  ["alerts", "Alertas"],
  ["audit", "Auditoría"],
];

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

function $(selector) {
  return document.querySelector(selector);
}

function fmtMoney(value) {
  return money.format(Math.round(Number(value || 0))).replace("ARS", "$");
}

function pct(value) {
  return new Intl.NumberFormat("es-AR", { style: "percent", maximumFractionDigits: 1 }).format(Number(value || 0));
}

async function api(path, options = {}) {
  const res = await fetch(`/api/${path}`, {
    headers: options.body instanceof FormData ? {} : { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...options,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Error de servidor");
  }
  const contentType = res.headers.get("content-type") || "";
  return contentType.includes("application/json") ? res.json() : res.text();
}

function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function renderLogin(error = "") {
  document.querySelector("#app").innerHTML = `
    <div class="login">
      <div class="login-card">
        <h1>Mercalito Control</h1>
        <p>Sistema interno de gastos, pagos, bancos y rentabilidad.</p>
        <form id="loginForm">
          <label>Email <input name="email" value="admin@mercalito.local" autocomplete="username" /></label>
          <label>Contraseña <input name="password" type="password" value="admin123" autocomplete="current-password" /></label>
          ${error ? `<div class="badge danger">${error}</div>` : ""}
          <button>Ingresar</button>
        </form>
      </div>
    </div>`;
  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const data = await api("login", { method: "POST", body: JSON.stringify(Object.fromEntries(form)) });
      state.user = data.user;
      await bootstrap();
    } catch (err) {
      renderLogin(err.message);
    }
  });
}

async function bootstrap() {
  state.lookups = await api("lookups");
  await loadDashboard();
  renderApp();
}

async function loadDashboard() {
  state.dashboard = await api(`dashboard?month=${encodeURIComponent(state.filters.month)}&branchId=${encodeURIComponent(state.filters.branchId)}`);
}

function renderApp() {
  document.querySelector("#app").innerHTML = `
    <div class="layout">
      <aside class="sidebar" id="sidebar">
        <div class="brand">Mercalito</div>
        <nav class="nav">
          ${views.map(([id, label]) => `<button data-view="${id}" class="${state.view === id ? "active" : ""}">${label}</button>`).join("")}
        </nav>
      </aside>
      <div class="main">
        <header class="topbar">
          <div class="actions">
            <button class="secondary mobile-menu" id="mobileMenu">Menú</button>
            <strong>${views.find((v) => v[0] === state.view)?.[1] || ""}</strong>
          </div>
          <div class="actions">
            <span class="muted">${state.user?.name || ""}</span>
            <button class="secondary" id="logout">Salir</button>
          </div>
        </header>
        <main class="content" id="content"></main>
      </div>
    </div>`;
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.view = button.dataset.view;
      $("#sidebar").classList.remove("open");
      await renderView();
      document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === state.view));
    });
  });
  $("#mobileMenu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  $("#logout").addEventListener("click", async () => {
    await api("logout", { method: "POST", body: "{}" });
    state.user = null;
    renderLogin();
  });
  renderView();
}

async function renderView() {
  if (state.view === "dashboard") return renderDashboard();
  if (state.view === "expenses") return renderExpenses();
  if (state.view === "import") return renderImport();
  if (state.view === "reports") return renderReports();
  if (state.view === "alerts") return renderAlerts();
  if (state.view === "audit") return renderAudit();
  return renderCrud(state.view);
}

function page(title, subtitle, actions = "") {
  $("#content").innerHTML = `
    <div class="page-title">
      <div><h1>${title}</h1><div class="muted">${subtitle || ""}</div></div>
      <div class="actions">${actions}</div>
    </div>
    <div id="pageBody"></div>`;
}

function filtersHtml(extra = "") {
  return `
    <div class="filters">
      <label>Mes <input id="filterMonth" type="month" value="${state.filters.month}" /></label>
      <label>Sucursal <select id="filterBranch">${option("", "Todas")}${state.lookups.branches.map((b) => option(b.id, b.name, state.filters.branchId)).join("")}</select></label>
      <label>Búsqueda <input id="filterSearch" value="${state.filters.search}" placeholder="Proveedor, factura..." /></label>
      ${extra}
    </div>`;
}

function bindFilters(onChange) {
  ["filterMonth", "filterBranch", "filterSearch", "filterStatus"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", async () => {
      state.filters.month = $("#filterMonth")?.value || state.filters.month;
      state.filters.branchId = $("#filterBranch")?.value || "";
      state.filters.search = $("#filterSearch")?.value || "";
      state.filters.status = $("#filterStatus")?.value || "";
      await onChange();
    });
  });
}

async function renderDashboard() {
  await loadDashboard();
  const d = state.dashboard;
  page("Dashboard principal", "Control mensual de Mercalito", `<button id="goImport">Importar Excel</button>`);
  $("#pageBody").innerHTML = `
    ${filtersHtml()}
    <div class="grid metrics">
      ${metric("Facturación", d.totals.revenue, "Ingresos del mes")}
      ${metric("Gastos", d.totals.expenses, `${d.counts.expenses} movimientos`)}
      ${metric("Resultado estimado", d.totals.result, pct(d.totals.revenue ? d.totals.result / d.totals.revenue : 0) + " sobre ventas")}
      ${metric("Pendiente de pago", d.totals.pending, `${d.counts.pending} gastos`)}
    </div>
    <div class="grid two" style="margin-top:14px">
      ${barPanel("Top 10 proveedores", d.topSuppliers)}
      ${barPanel("Gastos por categoría", d.byCategory.slice(0, 10))}
      ${barPanel("Gastos por sucursal", d.byBranch)}
      <section class="panel">
        <div class="panel-head"><h2>Alertas importantes</h2></div>
        <div class="panel-body">${alertsHtml(d.alerts)}</div>
      </section>
    </div>`;
  bindFilters(renderDashboard);
  $("#goImport").addEventListener("click", () => {
    state.view = "import";
    renderApp();
  });
}

function metric(label, value, hint) {
  return `<div class="metric"><div class="label">${label}</div><div class="value">${fmtMoney(value)}</div><div class="hint">${hint}</div></div>`;
}

function barPanel(title, rows) {
  const max = Math.max(...rows.map((r) => Math.abs(r.total)), 1);
  return `<section class="panel">
    <div class="panel-head"><h2>${title}</h2></div>
    <div class="panel-body">
      ${rows.length ? rows.map((r) => `<div class="bar-row"><strong>${escapeHtml(r.name)}</strong><div class="bar"><span style="width:${Math.min(100, Math.abs(r.total) / max * 100)}%"></span></div><div class="num">${fmtMoney(r.total)}</div></div>`).join("") : `<div class="muted">Sin datos</div>`}
    </div>
  </section>`;
}

async function renderExpenses() {
  page("Gastos", "Alta, edición, pagos y control de vencimientos", `<button id="newExpense">Crear gasto</button><button class="secondary" id="exportCsv">Exportar CSV</button>`);
  $("#pageBody").innerHTML = `${filtersHtml(`<label>Estado <select id="filterStatus">${option("", "Todos")}${["Pendiente", "Pagado", "Parcial", "Vencido"].map((s) => option(s, s, state.filters.status)).join("")}</select></label>`)}<section class="panel"><div class="table-wrap" id="expensesTable"></div></section>`;
  async function load() {
    const q = new URLSearchParams({ month: state.filters.month, branchId: state.filters.branchId, search: state.filters.search, status: state.filters.status, limit: "1000" });
    state.rows.expenses = await api(`expenses?${q}`);
    $("#expensesTable").innerHTML = table(
      ["Fecha", "Proveedor", "Categoría", "Sucursal", "Comprobante", "Total", "Estado", ""],
      state.rows.expenses,
      (e) => [e.date, e.supplierName, e.categoryName, e.branchName, e.invoiceNumber || e.receiptType, fmtMoney(e.totalAmount), badge(e.status), `<button class="secondary" data-edit="${e.id}">Editar</button>`],
    );
    document.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => expenseModal(state.rows.expenses.find((e) => e.id === btn.dataset.edit))));
  }
  bindFilters(load);
  $("#newExpense").addEventListener("click", () => expenseModal());
  $("#exportCsv").addEventListener("click", () => {
    window.location.href = `/api/export/expenses.csv?month=${state.filters.month}`;
  });
  await load();
}

function expenseModal(expense = {}) {
  formModal("Gasto", expense, [
    ["date", "Fecha", "date"],
    ["supplierId", "Proveedor", "select:suppliers"],
    ["categoryId", "Categoría", "select:categories"],
    ["branchId", "Sucursal", "select:branches"],
    ["receiptType", "Tipo comprobante", "text"],
    ["invoiceNumber", "Número", "text"],
    ["netAmount", "Monto neto", "number"],
    ["iva", "IVA", "number"],
    ["otherTaxes", "Otros impuestos", "number"],
    ["totalAmount", "Total", "number"],
    ["status", "Estado", "select-status"],
    ["dueDate", "Vencimiento", "date"],
    ["paymentDate", "Fecha pago", "date"],
    ["paymentMethod", "Medio pago", "select-payment"],
    ["description", "Descripción", "textarea"],
    ["notes", "Observaciones", "textarea"],
  ], async (body) => {
    body.month = String(body.date || "").slice(0, 7);
    await saveResource("expenses", expense.id, body);
    toast("Gasto guardado");
    await renderExpenses();
  });
}

async function renderImport() {
  page("Importar Excel", "Subí un .xls/.xlsx, revisá el preview y confirmá antes de guardar");
  $("#pageBody").innerHTML = `
    <section class="panel">
      <div class="panel-body">
        <form id="importForm" class="actions">
          <input type="file" name="file" accept=".xls,.xlsx" required />
          <button>Previsualizar</button>
        </form>
      </div>
    </section>
    <div id="previewArea"></div>`;
  $("#importForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.preview = await api("import/preview", { method: "POST", body: form });
    renderPreview();
  });
}

function renderPreview() {
  const p = state.preview;
  $("#previewArea").innerHTML = `<section class="panel" style="margin-top:14px">
    <div class="panel-head"><h2>Vista previa: ${escapeHtml(p.filename)}</h2><button id="confirmImport">Confirmar importación</button></div>
    <div class="panel-body">
      <div class="grid metrics">
        <div class="metric"><div class="label">Filas detectadas</div><div class="value">${number.format(p.totalRows)}</div></div>
        <div class="metric"><div class="label">Posibles duplicados</div><div class="value">${number.format(p.duplicates)}</div></div>
      </div>
    </div>
    <div class="table-wrap">${table(["Fecha", "Proveedor", "Categoría", "Sucursal", "Total", "Duplicado"], p.rows, (r) => [r.normalized.date, r.normalized.supplierName, r.normalized.categoryName, r.normalized.branchName, fmtMoney(r.normalized.totalAmount), r.duplicate ? badge("Sí", "warn") : ""])}</div>
  </section>`;
  $("#confirmImport").addEventListener("click", async () => {
    const result = await api("import/confirm", { method: "POST", body: JSON.stringify({ previewId: p.previewId }) });
    state.dashboard = result.dashboard;
    toast(`Importados: ${result.batch.imported}. Duplicados omitidos: ${result.batch.skipped}.`);
    state.view = "dashboard";
    renderApp();
  });
}

async function renderCrud(resource) {
  const config = crudConfig(resource);
  page(config.title, config.subtitle, `<button id="newItem">Crear</button>`);
  $("#pageBody").innerHTML = `<section class="panel"><div class="table-wrap" id="crudTable"></div></section>`;
  async function load() {
    state.rows[resource] = await api(`${config.endpoint}?limit=1000`);
    $("#crudTable").innerHTML = table(config.headers, state.rows[resource], config.row);
    document.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => formModal(config.title, state.rows[resource].find((r) => r.id === btn.dataset.edit), config.fields, async (body) => {
        await saveResource(config.endpoint, btn.dataset.edit, body);
        toast("Guardado");
        await renderCrud(resource);
      }));
    });
  }
  $("#newItem").addEventListener("click", () => formModal(config.title, {}, config.fields, async (body) => {
    await saveResource(config.endpoint, null, body);
    toast("Creado");
    await renderCrud(resource);
  }));
  await load();
}

function crudConfig(resource) {
  const configs = {
    suppliers: {
      endpoint: "suppliers", title: "Proveedores", subtitle: "Datos comerciales, deuda y condiciones",
      headers: ["Nombre", "Rubro", "Teléfono", "Email", "Estado", ""],
      row: (r) => [r.name, r.category || r.rubro || "", r.phone || "", r.email || "", r.active === false ? "Inactivo" : "Activo", `<button class="secondary" data-edit="${r.id}">Editar</button>`],
      fields: [["name", "Nombre", "text"], ["cuit", "CUIT", "text"], ["category", "Rubro", "text"], ["contact", "Contacto", "text"], ["phone", "Teléfono", "text"], ["email", "Email", "text"], ["address", "Dirección", "text"], ["paymentTerms", "Condición de pago", "text"], ["paymentDays", "Días de plazo", "number"], ["bankName", "Banco habitual", "text"], ["cbuAlias", "CBU/Alias", "text"], ["notes", "Observaciones", "textarea"]],
    },
    payments: {
      endpoint: "payments", title: "Pagos", subtitle: "Pagos totales, parciales y asociados a cheques",
      headers: ["Fecha", "Proveedor", "Gasto", "Monto", "Medio", "Banco", ""],
      row: (r) => [r.date, supplierName(r.supplierId), r.expenseId || "", fmtMoney(r.amount), r.paymentMethod || "", bankName(r.bankId), `<button class="secondary" data-edit="${r.id}">Editar</button>`],
      fields: [["date", "Fecha", "date"], ["supplierId", "Proveedor", "select:suppliers"], ["expenseId", "Gasto relacionado", "text"], ["amount", "Monto pagado", "number"], ["paymentMethod", "Medio de pago", "select-payment"], ["bankId", "Banco", "select:banks"], ["checkId", "Cheque/eCheq", "text"], ["notes", "Observaciones", "textarea"]],
    },
    checks: {
      endpoint: "checks", title: "Cheques y eCheq", subtitle: "Vencimientos, estados, bancos y beneficiarios",
      headers: ["Tipo", "Número", "Banco", "Vencimiento", "Beneficiario", "Monto", "Estado", ""],
      row: (r) => [r.type, r.number, bankName(r.bankId), r.dueDate, r.beneficiary, fmtMoney(r.amount), badge(r.status), `<button class="secondary" data-edit="${r.id}">Editar</button>`],
      fields: [["type", "Tipo", "select-check-type"], ["number", "Número", "text"], ["bankId", "Banco", "select:banks"], ["issueDate", "Emisión", "date"], ["dueDate", "Vencimiento", "date"], ["supplierId", "Proveedor", "select:suppliers"], ["beneficiary", "Beneficiario", "text"], ["amount", "Monto", "number"], ["status", "Estado", "select-check-status"], ["expenseId", "Gasto relacionado", "text"], ["notes", "Observaciones", "textarea"]],
    },
    invoices: {
      endpoint: "invoices", title: "Facturación", subtitle: "Ingresos por día, mes, sucursal y medio de cobro",
      headers: ["Fecha", "Sucursal", "Total", "Efectivo", "Tarjeta", "Mercado Pago", ""],
      row: (r) => [r.date, branchName(r.branchId), fmtMoney(r.totalAmount), fmtMoney(r.cash), fmtMoney(Number(r.debit || 0) + Number(r.credit || 0)), fmtMoney(r.mercadoPago), `<button class="secondary" data-edit="${r.id}">Editar</button>`],
      fields: [["date", "Fecha", "date"], ["branchId", "Sucursal", "select:branches"], ["totalAmount", "Facturación total", "number"], ["cash", "Efectivo", "number"], ["debit", "Tarjeta débito", "number"], ["credit", "Tarjeta crédito", "number"], ["mercadoPago", "Mercado Pago", "number"], ["transfers", "Transferencias", "number"], ["other", "Otros medios", "number"], ["notes", "Observaciones", "textarea"]],
    },
    banks: {
      endpoint: "banks", title: "Bancos", subtitle: "Cuentas, saldos y movimientos",
      headers: ["Banco", "Cuenta", "Alias/CBU", "Saldo actual", ""],
      row: (r) => [r.name, r.account || "", r.aliasCbu || "", fmtMoney(r.currentBalance), `<button class="secondary" data-edit="${r.id}">Editar</button>`],
      fields: [["name", "Banco", "text"], ["account", "Cuenta", "text"], ["aliasCbu", "Alias/CBU", "text"], ["openingBalance", "Saldo inicial", "number"], ["currentBalance", "Saldo actual", "number"], ["notes", "Observaciones", "textarea"]],
    },
    budgets: {
      endpoint: "budgets", title: "Presupuestos", subtitle: "Control mensual por categoría, sucursal o proveedor",
      headers: ["Mes", "Nombre", "Sucursal", "Categoría", "Proveedor", "Presupuesto", ""],
      row: (r) => [r.month, r.name || "", branchName(r.branchId), categoryName(r.categoryId), supplierName(r.supplierId), fmtMoney(r.amount), `<button class="secondary" data-edit="${r.id}">Editar</button>`],
      fields: [["month", "Mes", "month"], ["name", "Nombre", "text"], ["branchId", "Sucursal", "select:branches"], ["categoryId", "Categoría", "select:categories"], ["supplierId", "Proveedor", "select:suppliers"], ["amount", "Presupuesto", "number"], ["notes", "Observaciones", "textarea"]],
    },
  };
  return configs[resource] || configs.suppliers;
}

async function renderReports() {
  const report = await api(`reports/monthly?month=${state.filters.month}`);
  page("Reportes", "Exportación y lectura ejecutiva", `<button id="downloadCsv">Descargar gastos CSV</button>`);
  $("#pageBody").innerHTML = `${filtersHtml()}<div class="grid two">
    ${barPanel("Ranking proveedores", report.topSuppliers)}
    ${barPanel("Rentabilidad por sucursal", report.byBranch.map((b) => ({ ...b, total: -b.total })))}
  </div>
  <section class="panel" style="margin-top:14px"><div class="panel-head"><h2>Resumen mensual</h2></div><div class="panel-body">
    <p><strong>Gastos:</strong> ${fmtMoney(report.totals.expenses)}</p>
    <p><strong>Facturación:</strong> ${fmtMoney(report.totals.revenue)}</p>
    <p><strong>Resultado estimado:</strong> ${fmtMoney(report.totals.result)}</p>
    <p><strong>Pagos registrados:</strong> ${fmtMoney(report.totals.payments)}</p>
  </div></section>`;
  bindFilters(renderReports);
  $("#downloadCsv").addEventListener("click", () => window.location.href = `/api/export/expenses.csv?month=${state.filters.month}`);
}

async function renderAlerts() {
  await loadDashboard();
  page("Alertas", "Vencimientos, presupuestos y desvíos");
  $("#pageBody").innerHTML = `<section class="panel"><div class="panel-body">${alertsHtml(state.dashboard.alerts)}</div></section>`;
}

async function renderAudit() {
  const rows = await api("alerts?limit=1").catch(() => []);
  const dbAudit = await api("auditLogs?limit=500").catch(() => []);
  page("Auditoría", "Historial de cambios importantes");
  $("#pageBody").innerHTML = `<section class="panel"><div class="table-wrap">${table(["Fecha", "Usuario", "Entidad", "Acción", "ID"], dbAudit, (r) => [r.createdAt, r.userId, r.entity, r.action, r.entityId])}</div></section>`;
}

function alertsHtml(alerts) {
  if (!alerts?.length) return `<div class="muted">Sin alertas por ahora.</div>`;
  return alerts.map((a) => `<div class="alert ${a.level}"><strong>${escapeHtml(a.title)}</strong><div>${escapeHtml(a.detail)}</div><div class="muted">${escapeHtml(a.date || "")}</div></div>`).join("");
}

function formModal(title, item, fields, onSave) {
  const id = `form_${Date.now()}`;
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `<div class="modal">
    <div class="panel-head"><h2>${title}</h2><button class="secondary" data-close>Cerrar</button></div>
    <form id="${id}" class="panel-body">
      <div class="form-grid">${fields.map((field) => fieldHtml(field, item)).join("")}</div>
      <div class="actions" style="margin-top:14px"><button>Guardar</button><button type="button" class="secondary" data-close>Cancelar</button></div>
    </form>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", () => modal.remove()));
  modal.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    await onSave(body);
    modal.remove();
  });
}

function fieldHtml([name, label, type], item) {
  const value = item?.[name] ?? "";
  if (type === "textarea") return `<label class="wide">${label}<textarea name="${name}">${escapeHtml(value)}</textarea></label>`;
  if (type.startsWith("select:")) {
    const source = type.split(":")[1];
    return `<label>${label}<select name="${name}">${option("", "Sin seleccionar", value)}${state.lookups[source].map((x) => option(x.id, x.name, value)).join("")}</select></label>`;
  }
  if (type === "select-status") return `<label>${label}<select name="${name}">${["Pendiente", "Pagado", "Parcial", "Vencido"].map((x) => option(x, x, value)).join("")}</select></label>`;
  if (type === "select-payment") return `<label>${label}<select name="${name}">${option("", "Sin seleccionar", value)}${state.lookups.paymentMethods.map((x) => option(x, x, value)).join("")}</select></label>`;
  if (type === "select-check-status") return `<label>${label}<select name="${name}">${state.lookups.checkStatuses.map((x) => option(x, x, value)).join("")}</select></label>`;
  if (type === "select-check-type") return `<label>${label}<select name="${name}">${["Cheque físico", "eCheq"].map((x) => option(x, x, value)).join("")}</select></label>`;
  return `<label>${label}<input name="${name}" type="${type}" value="${escapeHtml(value)}" /></label>`;
}

async function saveResource(resource, id, body) {
  const path = id ? `${resource}/${id}` : resource;
  const method = id ? "PUT" : "POST";
  return api(path, { method, body: JSON.stringify(body) });
}

function table(headers, rows, rowFn) {
  return `<table><thead><tr>${headers.map((h) => `<th class="${h === "Total" || h === "Monto" || h === "Presupuesto" ? "num" : ""}">${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${rowFn(row).map((cell, i) => `<td class="${typeof cell === "string" && cell.startsWith("$") ? "num" : ""}">${cell ?? ""}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function badge(text, tone = "") {
  const t = String(text || "");
  const klass = tone || (t === "Pagado" || t === "Activo" ? "good" : t === "Vencido" || t === "Rechazado" ? "danger" : "warn");
  return `<span class="badge ${klass}">${escapeHtml(t)}</span>`;
}

function option(value, label, selected = "") {
  return `<option value="${escapeHtml(value)}" ${String(value) === String(selected || "") ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}

function branchName(id) { return state.lookups.branches.find((x) => x.id === id)?.name || ""; }
function categoryName(id) { return state.lookups.categories.find((x) => x.id === id)?.name || ""; }
function supplierName(id) { return state.lookups.suppliers.find((x) => x.id === id)?.name || ""; }
function bankName(id) { return state.lookups.banks.find((x) => x.id === id)?.name || ""; }

async function start() {
  try {
    const me = await api("me");
    state.user = me.user;
    await bootstrap();
  } catch {
    renderLogin();
  }
}

start();
