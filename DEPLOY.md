# Publicar Mercalito Control

La app ya está preparada para correr en servidor. Para usarla desde cualquier Wi-Fi necesitás publicarla en un hosting o VPS.

## Antes de publicar

Cambiar estas variables:

```text
DEFAULT_ADMIN_EMAIL=tu-email
DEFAULT_ADMIN_PASSWORD=una-clave-larga-y-segura
APP_SECRET=un-texto-largo-aleatorio
```

No publiques la app con `admin123`.

## Opción Recomendada: VPS con Docker

En un servidor Ubuntu:

```bash
git clone TU_REPO mercalito-control-app
cd mercalito-control-app
docker compose up -d --build
```

Abrir:

```text
http://IP-DEL-SERVIDOR:3100
```

Después conviene agregar:

- dominio propio
- HTTPS con Caddy o Nginx
- backup diario de la carpeta `data`
- firewall permitiendo solo puertos 80/443

## Opción Render

El archivo `render.yaml` deja lista una publicación tipo Blueprint.

Pasos:

1. Subir este proyecto a GitHub.
2. Entrar a Render.
3. Crear un Blueprint desde ese repo.
4. Configurar `DEFAULT_ADMIN_PASSWORD`.
5. Confirmar que el disco persistente quede montado en `/app/data`.

Importante: sin disco persistente, se pueden perder los datos al reiniciar.

## Opción Netlify

Netlify requiere una migración distinta porque no corre esta app como servidor Node persistente con `data/db.json`.

Ver `NETLIFY.md`.

## Opción Railway / Fly.io

Usar el `Dockerfile`.

Variables necesarias:

```text
HOST=0.0.0.0
PORT=3100
DATA_DIR=/app/data
DEFAULT_ADMIN_EMAIL=tu-email
DEFAULT_ADMIN_PASSWORD=clave-segura
APP_SECRET=secreto-largo
```

Configurar volumen persistente en `/app/data`.

## Backup

La información vive en:

```text
data/db.json
data/attachments
data/uploads
```

Backup simple:

```bash
tar -czf backup-mercalito-$(date +%F).tar.gz data
```
