-- Allow exact duplicate expense rows from source files.
-- source_hash is useful for import detection, but it cannot be unique because
-- the original Excel can contain repeated vouchers.

alter table expenses drop constraint if exists expenses_source_hash_key;
create index if not exists idx_expenses_source_hash on expenses(source_hash);
