-- Mercalito Control - reset schema
-- Use only if the project is new or you are sure you can delete these tables.

drop table if exists audit_logs cascade;
drop table if exists alerts cascade;
drop table if exists import_batches cascade;
drop table if exists attachments cascade;
drop table if exists budgets cascade;
drop table if exists invoices cascade;
drop table if exists bank_movements cascade;
drop table if exists payments cascade;
drop table if exists checks cascade;
drop table if exists expenses cascade;
drop table if exists banks cascade;
drop table if exists suppliers cascade;
drop table if exists users cascade;
drop table if exists expense_subcategories cascade;
drop table if exists expense_categories cascade;
drop table if exists branches cascade;
drop table if exists roles cascade;
