# Modelo de Base de Datos Propuesto

La primera versión funcional guarda los datos en `data/db.json` para correr local sin instalar una base. El modelo ya está separado para migrar a PostgreSQL + Prisma.

Tablas/colecciones:

- `Users`: usuarios, rol, sucursal, password hasheado, estado.
- `Roles`: Administrador, Oficina, Encargado, Consulta.
- `Branches`: sucursales/locales.
- `Suppliers`: proveedores.
- `ExpenseCategories`: categorías principales.
- `ExpenseSubcategories`: subcategorías.
- `Expenses`: gastos y comprobantes.
- `Payments`: pagos totales y parciales.
- `Banks`: bancos/cuentas.
- `BankMovements`: ingresos/egresos bancarios.
- `Checks`: cheques físicos y eCheq.
- `Invoices`: facturación/ingresos por sucursal.
- `Budgets`: presupuestos mensuales.
- `Attachments`: archivos adjuntos.
- `ImportBatches`: historial de importaciones.
- `AuditLogs`: historial de cambios.
- `Alerts`: alertas manuales o generadas.

Relaciones principales:

- `Expenses.supplierId -> Suppliers.id`
- `Expenses.branchId -> Branches.id`
- `Expenses.categoryId -> ExpenseCategories.id`
- `Payments.expenseId -> Expenses.id`
- `Payments.bankId -> Banks.id`
- `Checks.expenseId -> Expenses.id`
- `BankMovements.bankId -> Banks.id`
- `Invoices.branchId -> Branches.id`
- `Budgets.branchId/categoryId/supplierId`
- `Attachments.entity/entityId`
- `AuditLogs.entity/entityId`
