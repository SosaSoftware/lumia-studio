# Sandbox de Lumia Studio

## Propósito

`@lumia/sandbox` es el entorno local de Lumia Studio: Postgres en Docker, un servidor local en lugar de AppSync, Cognito y S3, un emulador de AgentCore Gateway y datos de ejemplo. La guía completa está en [docs/development/setup.md](../docs/development/setup.md).

## Ejecución

Requiere Docker con el demonio activo, `openssl` y `curl`.

```bash
npm install
npm run sandbox:init
npm run dev:up
```

`npm run sandbox:init` ejecuta `sandbox:up`, `db:migrate` y `db:seed`. `npm run dev:up` inicia `api` (`:4000`), `web` (`:5173`), `mcp` (`:4100`) y `lumi` (`:8080`), y guarda el pid y el log de cada uno en `.sandbox/`. Las cuentas de prueba están en [docs/development/setup.md](../docs/development/setup.md).

## Pruebas

```bash
npm test -w @lumia/sandbox
npm run test:integration -w @lumia/sandbox
```

Las pruebas de integración corren contra el Postgres del sandbox. Detalle en [docs/development/testing.md](../docs/development/testing.md).

## Estructura

```text
sandbox/
├── docker-compose.yaml        Postgres del sandbox
├── scripts/
│   ├── sandbox.sh             administra Postgres y .env
│   └── dev.sh                 administra los servicios locales
├── seed/                      datos de ejemplo y contenido de muestra
├── src/
│   ├── auth/                  login y tokens de desarrollo
│   ├── graphql/               AppSync local
│   ├── mcp-gateway/           emulador del gateway y Studio local para pruebas
│   ├── storage/               rutas firmadas
│   ├── main.ts                punto de entrada de la API local
│   └── sandbox-server.ts      servidor local
└── test/                      pruebas de integración
```

## Scripts disponibles

| Comando | Función |
|---|---|
| `npm run sandbox:up`, `sandbox:down`, `sandbox:reset`, `sandbox:status` | Inicia, detiene, vacía o consulta Postgres |
| `npm run db:seed` | Carga los datos de ejemplo |
| `npm run dev:up`, `dev:down`, `dev:status` | Inicia, detiene o consulta los servicios |
| `npm run dev:logs <service>` | Sigue el log de `api`, `web`, `mcp` o `lumi` |
| `npm run start -w @lumia/sandbox` | Ejecuta solo la API local |
| `npm run seed -w @lumia/sandbox` | Carga los datos de ejemplo desde el workspace |
| `npm run typecheck -w @lumia/sandbox` | Type check del paquete |
| `npm test -w @lumia/sandbox` | Pruebas unitarias |
| `npm run test:integration -w @lumia/sandbox` | Pruebas contra el Postgres del sandbox |
