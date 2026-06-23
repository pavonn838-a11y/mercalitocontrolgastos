# Publicar Mercalito Control en Netlify

Netlify sirve muy bien para el frontend, pero esta app no debería guardar datos financieros en archivos locales dentro de Netlify.

## Por qué

La versión actual usa:

- servidor Node local
- archivo `data/db.json`
- uploads/importaciones en carpeta local
- importador Excel con Python

En Netlify:

- no hay un servidor Node corriendo todo el tiempo
- las funciones son temporales
- el filesystem no es una base persistente confiable
- los uploads deben ir a un storage externo

## Forma correcta con Netlify

Arquitectura recomendada:

- Frontend: Netlify
- API: Netlify Functions
- Base de datos: Supabase Postgres o Neon Postgres
- Archivos adjuntos: Supabase Storage, S3 o Cloudflare R2
- Login: auth propia o Supabase Auth

## Qué habría que migrar

1. Reemplazar `data/db.json` por PostgreSQL.
2. Crear tablas:
   - users
   - roles
   - branches
   - suppliers
   - categories
   - expenses
   - payments
   - banks
   - bank_movements
   - checks
   - invoices
   - budgets
   - attachments
   - import_batches
   - audit_logs
   - alerts
3. Convertir rutas `/api/...` a Netlify Functions.
4. Mover archivos adjuntos a storage externo.
5. Rehacer el importador Excel para funcionar dentro de Functions.

## Variables necesarias

```text
DATABASE_URL=postgres://...
APP_SECRET=clave-larga-segura
DEFAULT_ADMIN_EMAIL=admin@mercalito.local
DEFAULT_ADMIN_PASSWORD=clave-segura
STORAGE_BUCKET=...
```

## Camino recomendado

Para publicar rápido y bien:

1. Crear Supabase.
2. Crear proyecto en Netlify.
3. Migrar la app a Postgres + Functions.
4. Subir el repo a GitHub.
5. Conectar GitHub con Netlify.

## Subir los datos iniciales a Supabase

Después de ejecutar `supabase/schema.sql`, crear `.env` y correr:

```bash
npm run supabase:seed
```

Eso sube a Supabase los datos actuales de `data/db.json`, incluyendo gastos de mayo, proveedores, sucursales, categorías y facturación.

## Alternativa más simple

Si querés subir la app actual sin migración, conviene más:

- Render
- Railway
- Fly.io
- VPS con Docker

Porque ahí sí puede correr el servidor Node y guardar datos en un volumen persistente.
