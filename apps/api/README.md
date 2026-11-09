# API de Lumia Studio

## Propósito

`@lumia/api` contiene la API GraphQL de Lumia Studio, sus permisos con Cedar, sus servicios, las migraciones y el Studio MCP que usa Lumi. En AWS corre en AppSync y Lambda. En local, el sandbox ejecuta los mismos handlers. El detalle está en [docs/architecture/api.md](../../docs/architecture/api.md) y [docs/architecture/data.md](../../docs/architecture/data.md).

## Ejecución

Requiere el sandbox, con Docker.

```bash
npm run sandbox:init
npm run dev:up
```

La API local responde en `http://localhost:4000/graphql`. El despliegue está en [docs/operations/deployment.md](../../docs/operations/deployment.md).

## Pruebas

```bash
npm test -w @lumia/api
npm run test:integration -w @lumia/api
```

Las pruebas de integración corren contra el Postgres del sandbox y necesitan `npm run sandbox:init`. Detalle en [docs/development/testing.md](../../docs/development/testing.md).

## Estructura

```text
apps/api/
├── cedar/                     esquema de Cedar generado
├── db/migrations/             migraciones SQL del esquema studio
├── scripts/                   aplicar migraciones y generar el esquema de Cedar
├── src/
│   ├── graphql/               esquema, registro de campos y código de los resolvers
│   ├── handlers/              comandos por familia de campos
│   ├── lambda/                puntos de entrada de Lambda
│   ├── mcp/                   Studio MCP y sus herramientas
│   ├── runtime/               FieldPipeline y dependencias compartidas
│   └── services/              lógica de negocio
└── test/                      pruebas de integración y su soporte
```

El recorrido completo de las carpetas está en [docs/development/repository.md](../../docs/development/repository.md). Las variables de entorno están en [docs/architecture/api.md](../../docs/architecture/api.md).

## Scripts disponibles

| Comando | Función |
|---|---|
| `npm run typecheck -w @lumia/api` | Type check del paquete |
| `npm test -w @lumia/api` | Pruebas unitarias |
| `npm run test:integration -w @lumia/api` | Pruebas contra el Postgres del sandbox. Necesita `npm run sandbox:init`. |
| `npm run migrate -w @lumia/api` | Aplica las migraciones. `npm run db:migrate` lo ejecuta desde la raíz. |
| `npm run cedar:schema -w @lumia/api` | Regenera `cedar/schema.cedarschema.json` desde `PERMISSION_CATALOG` |
