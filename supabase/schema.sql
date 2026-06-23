-- Mercalito Control - Supabase/Postgres schema
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists roles (
  id text primary key,
  name text not null unique
);

create table if not exists branches (
  id text primary key,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists expense_categories (
  id text primary key,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists expense_subcategories (
  id text primary key,
  category_id text references expense_categories(id),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id text primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  role_id text references roles(id),
  branch_id text references branches(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists suppliers (
  id text primary key,
  name text not null unique,
  cuit text,
  category text,
  contact text,
  phone text,
  email text,
  address text,
  payment_terms text,
  payment_days integer,
  bank_name text,
  cbu_alias text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists banks (
  id text primary key,
  name text not null,
  account text,
  alias_cbu text,
  opening_balance numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists expenses (
  id text primary key,
  date date not null,
  month text not null,
  supplier_id text references suppliers(id),
  supplier_name text,
  cuit text,
  category_id text references expense_categories(id),
  category_name text,
  subcategory_id text references expense_subcategories(id),
  branch_id text references branches(id),
  branch_name text,
  description text,
  invoice_number text,
  receipt_type text,
  net_amount numeric(14,2) not null default 0,
  iva numeric(14,2) not null default 0,
  other_taxes numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  status text not null default 'Pendiente',
  due_date date,
  payment_date date,
  payment_method text,
  bank_id text references banks(id),
  notes text,
  import_batch_id text,
  source_hash text,
  loaded_by text references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  id text primary key,
  date date not null,
  supplier_id text references suppliers(id),
  expense_id text references expenses(id),
  amount numeric(14,2) not null default 0,
  payment_method text,
  bank_id text references banks(id),
  check_id text,
  receipt text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists checks (
  id text primary key,
  type text not null,
  number text,
  bank_id text references banks(id),
  issue_date date,
  due_date date,
  supplier_id text references suppliers(id),
  beneficiary text,
  amount numeric(14,2) not null default 0,
  status text not null default 'Pendiente',
  expense_id text references expenses(id),
  notes text,
  loaded_by text references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table payments
  add constraint payments_check_id_fkey
  foreign key (check_id) references checks(id) deferrable initially deferred;

create table if not exists bank_movements (
  id text primary key,
  date date not null,
  bank_id text references banks(id),
  type text not null,
  description text,
  amount numeric(14,2) not null default 0,
  related_entity text,
  related_id text,
  receipt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists invoices (
  id text primary key,
  date date not null,
  month text not null,
  branch_id text references branches(id),
  branch_name text,
  total_amount numeric(14,2) not null default 0,
  cash numeric(14,2) not null default 0,
  debit numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  mercado_pago numeric(14,2) not null default 0,
  transfers numeric(14,2) not null default 0,
  other numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists budgets (
  id text primary key,
  month text not null,
  name text,
  branch_id text references branches(id),
  category_id text references expense_categories(id),
  supplier_id text references suppliers(id),
  amount numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists attachments (
  id text primary key,
  entity text not null,
  entity_id text not null,
  filename text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by text references users(id),
  created_at timestamptz not null default now()
);

create table if not exists import_batches (
  id text primary key,
  filename text not null,
  rows integer not null default 0,
  imported integer not null default 0,
  skipped integer not null default 0,
  user_id text references users(id),
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id text primary key,
  user_id text references users(id),
  entity text not null,
  entity_id text,
  action text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create table if not exists alerts (
  id text primary key,
  level text not null default 'warn',
  title text not null,
  detail text,
  date date,
  entity text,
  entity_id text,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_expenses_month on expenses(month);
create index if not exists idx_expenses_branch on expenses(branch_id);
create index if not exists idx_expenses_supplier on expenses(supplier_id);
create index if not exists idx_expenses_category on expenses(category_id);
create index if not exists idx_expenses_status on expenses(status);
create index if not exists idx_expenses_source_hash on expenses(source_hash);
create index if not exists idx_payments_expense on payments(expense_id);
create index if not exists idx_checks_due_date on checks(due_date);
create index if not exists idx_invoices_month on invoices(month);
create index if not exists idx_budgets_month on budgets(month);

-- Keep API access locked down by default.
alter table roles enable row level security;
alter table branches enable row level security;
alter table expense_categories enable row level security;
alter table expense_subcategories enable row level security;
alter table users enable row level security;
alter table suppliers enable row level security;
alter table banks enable row level security;
alter table expenses enable row level security;
alter table payments enable row level security;
alter table checks enable row level security;
alter table bank_movements enable row level security;
alter table invoices enable row level security;
alter table budgets enable row level security;
alter table attachments enable row level security;
alter table import_batches enable row level security;
alter table audit_logs enable row level security;
alter table alerts enable row level security;
