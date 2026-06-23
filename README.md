# Mercalito Control

App interna local para controlar gastos, facturación, pagos, bancos, cheques/eCheq, proveedores, presupuestos, reportes y rentabilidad estimada.

Esta primera versión está pensada para funcionar ya, sin instalar una base de datos pesada. Usa:

- Frontend responsive en HTML/CSS/JS.
- Backend local en Node.js.
- Base local en `data/db.json`.
- Importador de Excel `.xls` / `.xlsx` por Python.
- Seed inicial con `GASTOS MAYO 2026.xls` ya cargado.

## Cómo correr

Desde esta carpeta:

```bash
npm run seed
npm run dev
```

Abrir:

```text
http://127.0.0.1:3100
```

Usuario inicial:

```text
Email: admin@mercalito.local
Contraseña: admin123
```

## Abrir desde otras computadoras de la red

Por defecto la app se abre solo en la misma Mac. Para verla desde otras computadoras conectadas al mismo Wi-Fi/red:

1. Buscar la IP local de la Mac que corre la app:

```bash
ipconfig getifaddr en0
```

2. Iniciar la app escuchando en la red local:

```bash
HOST=0.0.0.0 npm run dev
```

3. Desde otra computadora abrir:

```text
http://IP-DE-LA-MAC:3100
```

Ejemplo:

```text
http://192.168.1.25:3100
```

Importante: esto la deja visible para otros equipos de la misma red. Cambiar la contraseña inicial antes de usarla en una red compartida.

## Qué ya funciona

- Login local con contraseña hasheada.
- Dashboard mensual con facturación, gastos, resultado, pendientes, alertas y rankings.
- Gastos: alta, edición, filtros y exportación CSV.
- Importador Excel: subir archivo, preview, detección de duplicados y confirmación.
- Proveedores: CRUD básico.
- Pagos: CRUD básico y actualización del estado del gasto relacionado.
- Cheques/eCheq: CRUD básico, vencimientos y estados.
- Facturación: carga por sucursal y medios de cobro.
- Bancos: cuentas y saldos.
- Presupuestos: carga mensual por sucursal/categoría/proveedor.
- Reportes: resumen mensual y exportación CSV.
- Auditoría: historial de altas, ediciones, importaciones y borrados.
- Alertas: gastos vencidos, pagos próximos, cheques próximos y presupuestos superados.

## Datos cargados

El seed inicial carga:

- 2.985 gastos reales de mayo 2026.
- 167 proveedores detectados.
- Facturación total de mayo: `$828.577.474`.
- Sucursales iniciales de Mercalito.
- Categorías principales.
- Roles de usuario.
- Bancos base.

## Importador

El importador acepta archivos como `GASTOS MAYO 2026.xls`.

Flujo:

1. Ir a `Importar Excel`.
2. Elegir archivo.
3. Ver preview.
4. Revisar duplicados.
5. Confirmar importación.

El sistema evita duplicados usando una huella basada en sucursal, categoría, proveedor, comprobante, fecha, número y total.

## Modelo de datos

Ver `docs/database-model.md`.

La app guarda por ahora en JSON para correr simple. El modelo está preparado para migrar a:

- PostgreSQL
- Prisma
- Next.js
- autenticación con sesiones persistentes
- almacenamiento real de adjuntos

## Próximas mejoras recomendadas

1. Migrar `data/db.json` a SQLite o PostgreSQL.
2. Agregar adjuntos reales por gasto/pago/cheque.
3. Agregar permisos por rol en cada acción.
4. Agregar conciliación bancaria.
5. Agregar OCR de facturas.
6. Agregar alertas por WhatsApp/email.
7. Agregar reparto de compras centralizadas de Olavarría hacia sucursales reales.

## Nota financiera

El dashboard de mayo parte de la planilla de gastos y de la facturación informada. Para rentabilidad real por local, falta cargar ventas por sucursal y definir reglas de reparto para compras centralizadas.
