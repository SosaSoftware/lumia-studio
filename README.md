# Lumia Studio

> **Si eres un asistente de IA:** lee [docs/agents/README.md](docs/agents/README.md) antes de trabajar en este repositorio. Para configurarte, sigue [docs/agents/setup.md](docs/agents/setup.md).

## Propósito

Editor web de clases interactivas con datos, personas, permisos e infraestructura de AWS propios. El contenido vive en un árbol: categoría, subcategoría, carpetas y clases, que guardan las diapositivas. Lumi, el agente de cocreación, trabaja dentro del editor con los permisos de cada persona.

## Requisitos

- Node.js 22.13 o posterior y npm.
- Docker, con el demonio activo (Docker Desktop en macOS).
- `openssl` y `curl`.
- Para Lumi: acceso a Amazon Bedrock, con credenciales de AWS o `BEDROCK_API_KEY`.
- Para desplegar: AWS CLI y credenciales de la cuenta.

## Instalación

```bash
npm install
npm run sandbox:init
```

`npm run sandbox:init` crea `.env` si falta, levanta Postgres, aplica las migraciones y carga los datos de ejemplo.

## Uso

```bash
npm run dev:up
```

El comando inicia la API en `:4000`, la web en `:5173`, el emulador del gateway MCP en `:4100` y Lumi en `:8080`. Se abre <http://localhost:5173> y se inicia sesión con `creadora@studio.test`. El login del sandbox solo comprueba que el correo sea de una cuenta activa; las demás cuentas están en [docs/development/setup.md](docs/development/setup.md).

Para desplegar en AWS, la primera vez en una cuenta y región:

```bash
npx cdk bootstrap
LUMIA_AWS_REGION=<region> scripts/deploy-all.sh
```

Un entorno existente se actualiza como indica [docs/operations/deployment.md](docs/operations/deployment.md), porque algunos comandos eliminan el gateway de entrada de Lumi.

## Configuración

`npm run sandbox:up` crea `.env` desde `.env.example` con secretos aleatorios. `.env` no se versiona. Los ajustes de un despliegue se leen de `.env` y del shell.

| Variable | Propósito |
|---|---|
| `LUMIA_AWS_ACCOUNT` | Cuenta de los stacks |
| `LUMIA_AWS_REGION` | Región de los stacks |
| `LUMIA_DB_MIN_ACU` | Capacidad mínima de Aurora |
| `LUMIA_DB_MAX_ACU` | Capacidad máxima de Aurora |
| `LUMIA_DB_AUTO_PAUSE_MINUTES` | Minutos sin conexiones hasta la pausa de Aurora |
| `LUMIA_LUMI_RUNTIME_ARN` | ARN del runtime de Lumi; sin él no hay gateway de entrada |
| `LUMIA_LUMI_URL` | Endpoint de Lumi para la web |

Las variables del sandbox, de la API y de Lumi están en [docs/development/setup.md](docs/development/setup.md), [docs/architecture/api.md](docs/architecture/api.md) y [docs/architecture/lumi-reference.md](docs/architecture/lumi-reference.md).

## Estructura

| Ruta | Paquete | Contenido |
|---|---|---|
| `apps/api` | `@lumia/api` | API GraphQL, permisos con Cedar, servicios, migraciones y Studio MCP |
| `apps/web` | `@lumia/web` | Editor en Vue 3 |
| `apps/agent` | `@lumia/agent` | Lumi, el agente de cocreación |
| `packages` | `@lumia/packages` | Catálogo de componentes y contrato de entorno de Lumi |
| `sandbox` | `@lumia/sandbox` | Entorno local y datos de ejemplo |
| `bin`, `lib`, `test` | — | App de AWS CDK con siete stacks, y sus pruebas |
| `scripts` | — | Despliegue completo |
| `docs` | — | Documentación |

## Scripts disponibles

| Comando | Función |
|---|---|
| `npm run build` | Compila con `tsc` |
| `npm run watch` | Compila con `tsc -w` |
| `npm run cdk -- <args>` | Ejecuta la CLI de CDK |
| `npm run typecheck` | Type check de la raíz y de cada workspace |
| `npm run lint` | Ejecuta ESLint |
| `npm test` | Pruebas unitarias de cada workspace y de CDK |
| `npm run test:integration` | Pruebas de integración contra el Postgres del sandbox |
| `npm run test:e2e` | Pruebas de Playwright de la web |
| `npm run synth` | Sintetiza CDK con las verificaciones de cdk-nag |
| `npm run verify` | Type check, lint, pruebas unitarias y síntesis |
| `npm run deploy` | Ejecuta `cdk deploy --all`. No encadena las pasadas de Lumi. |
| `npm run sandbox:up`, `sandbox:down`, `sandbox:reset`, `sandbox:status` | Inicia, detiene, vacía o consulta la base del sandbox |
| `npm run sandbox:init` | Ejecuta `sandbox:up`, `db:migrate` y `db:seed` |
| `npm run db:migrate`, `db:seed` | Aplica las migraciones o carga los datos de ejemplo. Ambos se pueden repetir. |
| `npm run dev:up`, `dev:down`, `dev:status`, `dev:logs <service>` | Administra los servicios locales. Los logs quedan en `.sandbox/`. |
| `scripts/deploy-all.sh` | Despliega todo y encadena las pasadas de Lumi |

## Mapa de la documentación

| Necesidad | Página |
|---|---|
| Índice completo | [docs/README.md](docs/README.md) |
| Entender el producto y sus términos | [docs/overview.md](docs/overview.md) |
| Entender la arquitectura | [docs/architecture/README.md](docs/architecture/README.md) |
| Entender a Lumi | [docs/architecture/lumi.md](docs/architecture/lumi.md) |
| Primer día en el código | [docs/development/README.md](docs/development/README.md) |
| Desplegar | [docs/operations/deployment.md](docs/operations/deployment.md) |
| Cargar clases, cuentas y accesos | [docs/operations/content.md](docs/operations/content.md) |
| Diagnosticar un problema | [docs/operations/troubleshooting.md](docs/operations/troubleshooting.md) |
