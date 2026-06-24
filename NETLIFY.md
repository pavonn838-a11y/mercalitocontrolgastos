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

## Qué ya está migrado

1. Las tablas están definidas en `supabase/schema.sql`.
2. Los datos iniciales se suben con `npm run supabase:seed`.
3. Las rutas `/api/...` ya están redirigidas a Netlify Functions por `netlify.toml`.
4. La Function principal está en `netlify/functions/api.mjs`.
5. El frontend sigue publicado desde `public`.

Tablas incluidas:
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
Pendiente para una versión posterior:

- adjuntos reales en Supabase Storage
- importador Excel directamente online en Netlify

## Variables necesarias

```text
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=postgresql://...
APP_SECRET=clave-larga-segura
DEFAULT_ADMIN_EMAIL=admin@mercalito.local
DEFAULT_ADMIN_PASSWORD=clave-segura
```

## Camino recomendado

Para publicar rápido y bien:

1. Crear Supabase.
2. Ejecutar `supabase/schema.sql`.
3. Cargar datos con `npm run supabase:seed`.
4. Subir el repo a GitHub.
5. Conectar GitHub con Netlify.
6. Configurar las variables de entorno.

## Configuración de Netlify

En la pantalla de deploy:

```text
Base directory: vacío
Build command: vacío
Publish directory: public
Functions directory: netlify/functions
```

El archivo `netlify.toml` ya define:

- publicación desde `public`
- funciones desde `netlify/functions`
- redirección `/api/*` hacia la Function

## Subir los datos iniciales a Supabase

Después de ejecutar `supabase/schema.sql`, crear `.env` y correr:

```bash
npm run supabase:seed
```

Eso sube a Supabase los datos actuales de `data/db.json`, incluyendo gastos de mayo, proveedores, sucursales, categorías y facturación.

## Limitaciones actuales

- El importador Excel online devuelve un aviso de pendiente.
- Para importar nuevos Excel por ahora conviene usar la app local y luego subir datos.
- Adjuntos/facturas todavía no se guardan en Supabase Storage.
