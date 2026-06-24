# Supabase Setup

1. Open Supabase.
2. Go to `SQL Editor`.
3. If a previous attempt failed, paste and run `reset_schema.sql` first.
4. Paste and run `schema.sql`.
4. Create `.env` in the project root with:

```env
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.TU-PROYECTO.supabase.co:5432/postgres
APP_SECRET=...
DEFAULT_ADMIN_EMAIL=...
DEFAULT_ADMIN_PASSWORD=...
```

Important: replace `YOUR_PASSWORD` with the database password from Supabase.
