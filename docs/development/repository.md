# Recorrido del repositorio

Lumia Studio es un monorepo de npm con cuatro workspaces de aplicación y código compartido, más la app de AWS CDK en la raíz. Esta página describe cada carpeta y paquete: su propósito, sus puntos de entrada y cuándo tocarlo.

## Mapa

| Ruta | Paquete | Propósito |
|---|---|---|
| `apps/api` | `@lumia/api` | API GraphQL, permisos con Cedar, servicios, migraciones y Studio MCP |
| `apps/web` | `@lumia/web` | Editor en Vue 3 y Vite |
| `apps/agent` | `@lumia/agent` | Lumi, el agente de cocreación |
| `packages` | `@lumia/packages` | Catálogo de componentes y contrato de entorno de Lumi |
| `sandbox` | `@lumia/sandbox` | Entorno local y datos de ejemplo |
| `bin`, `lib` | — | App de AWS CDK con los siete stacks |
| `test` | — | Pruebas de la app de CDK |
| `scripts` | — | Despliegue completo |
| `docs` | — | Documentación y diagramas |

Los workspaces se declaran en `package.json` de la raíz. Un comando de un workspace se ejecuta con `-w`, por ejemplo `npm test -w @lumia/api`.

## `apps/api`

| Punto de entrada | Función |
|---|---|
| `src/graphql/schema.graphql` | Esquema GraphQL |
| `src/graphql/fields.ts` | Registro de campos `STUDIO_FIELDS`: acción de Cedar, handler y registro de cada campo |
| `src/handlers/<handler>/` | Comandos de cada familia de campos: `documents`, `media`, `narration`, `publish` y `tree` |
| `src/lambda/` | Lambdas de AppSync, exportación, migraciones y trigger de Cognito |
| `src/mcp/handlers/index.ts` | Lambdas de los cuatro targets del Studio MCP |
| `src/auth/permissions.ts` | Catálogo de acciones `PERMISSION_CATALOG` |
| `db/migrations/` | Migraciones SQL del esquema `studio` |

El resto de `src/` se divide en `auth` (acciones, identidad del token y claims de la persona), `authorization` (Cedar, políticas por rol y alcance de cada registro), `domain` (DTO y enumeraciones), `services` (lógica de negocio), `repositories` (acceso a datos), `infrastructure` (base de datos, almacenamiento y voz), `runtime` (`FieldPipeline`) y `shared` (configuración, errores y logs). `cedar/` guarda el esquema de Cedar generado y `scripts/` aplica las migraciones y genera ese esquema.

Se toca para agregar o cambiar un campo GraphQL, una regla de negocio, una tabla, una acción de Cedar o una herramienta de Lumi. Detalle en [architecture/api.md](../architecture/api.md) y [architecture/data.md](../architecture/data.md).

## `apps/web`

| Punto de entrada | Función |
|---|---|
| `src/main.ts` y `src/App.vue` | Arranque de la aplicación Vue |
| `src/router/index.ts` | Rutas y protección de sesión |
| `src/pages/` | `SignInPage.vue` y `WorkspacePage.vue` |
| `src/features/<feature>/` | Una carpeta por función del editor, por ejemplo `editor`, `timeline`, `tree` o `lumi` |
| `src/features/lumi/lumi-session.ts` | Conversaciones y turnos de Lumi |
| `src/features/lumi/frontend-tools.ts` | Herramientas de pantalla de Lumi |
| `vite.config.ts` | Servidor de desarrollo y proxy hacia los servicios locales |

`src/features/` tiene una carpeta por función: `comments`, `editor`, `lumi`, `media`, `palette`, `preview`, `properties`, `shell`, `slide-components`, `slides`, `timeline`, `tree` y `workspace`. `src/features/slide-components` tiene un componente Vue por componente del catálogo.

`src/api`, `src/auth` y `src/config` contienen el cliente GraphQL, los proveedores de sesión y la lectura de `config.json`. `src/composables` reúne el contexto de la app, los paneles, el tema y el bloqueo de edición, y `src/styles` los estilos globales.

Se toca para cambiar la interfaz del editor, el panel de Lumi, o una herramienta de pantalla. Detalle en [architecture/README.md](../architecture/README.md) y [architecture/lumi-tools.md](../architecture/lumi-tools.md).

## `apps/agent`

| Punto de entrada | Función |
|---|---|
| `src/entrypoints/local.ts` | Arranque local, con tokens del sandbox y directorios |
| `src/entrypoints/remote.ts` | Arranque en AgentCore Runtime |
| `src/lumi-runtime.ts` | Conecta las piezas desde la configuración y las sirve |
| `src/lumi.agent.ts` | `LumiAgentFactory`: un agente por persona y conversación |
| `src/prompts/`, `skills/`, `policies/confirmation.json` | Instrucciones, skills y reglas de consentimiento |
| `Dockerfile` y `scripts/build.ts` | Imagen arm64 y bundle de esbuild |

Las carpetas `src/server`, `src/interventions`, `src/mcp`, `src/identity`, `src/storage`, `src/memory` y `src/model` contienen el servidor AG-UI, el consentimiento, la conexión al Studio MCP, la identidad, las conversaciones, las preferencias y el modelo. `src/shared` tiene el logger JSON y `src/lumi-assets.ts` carga los prompts, las skills y la política. `test/` reúne las pruebas de integración y funcionales, con su soporte.

Se toca para cambiar el comportamiento de Lumi, sus instrucciones, sus skills o sus reglas de consentimiento. Detalle en [architecture/lumi.md](../architecture/lumi.md).

## `packages`

| Punto de entrada | Función |
|---|---|
| `src/catalog/index.ts` | Catálogo de componentes (`componentCatalog`) y motor de diseño de diapositivas (`slideLayoutEngine`) |
| `src/lumi-env/index.ts` | Contrato de entorno de Lumi: `parseLumiEnv` y los nombres de sus variables |

La API, la web y Lumi usan el mismo catálogo. Se toca para agregar o cambiar un componente del catálogo o una variable de Lumi.

## `sandbox`

| Punto de entrada | Función |
|---|---|
| `scripts/sandbox.sh` | Postgres en Docker y creación de `.env` |
| `scripts/dev.sh` | Servicios locales y `apps/web/public/config.json` |
| `src/main.ts` | API local: `SandboxServer` en lugar de AppSync, Cognito y S3 |
| `src/mcp-gateway/main.ts` | Emulador de AgentCore Gateway |
| `seed/seed.ts` y `seed/seed-data.ts` | Datos de ejemplo: roles, categorías, árbol y personas |
| `docker-compose.yaml` | Postgres del sandbox |

Se toca para cambiar el entorno local, el emulador del gateway o los datos de ejemplo. Detalle en [setup.md](setup.md).

## `bin`, `lib` y `test`

| Punto de entrada | Función |
|---|---|
| `bin/lumia-studio.ts` | Entrada de la app de CDK. Lee `.env` y la configuración del despliegue. |
| `lib/deploy-config.ts` | Valida las variables del despliegue |
| `lib/studio-app.ts` | Crea los siete stacks y activa cdk-nag |
| `lib/stacks/` | Un archivo por stack |
| `lib/constructs/` | `PrivateBucket`, `StudioFunction` y los gateways de Lumi |
| `test/` | Pruebas de Jest sobre las plantillas de los stacks |

`cdk.json` ejecuta `bin/lumia-studio.ts`. `cdk.context.json` se versiona.

Se toca para cambiar un recurso de AWS, un permiso o la configuración del despliegue. Detalle en [operations/deployment.md](../operations/deployment.md).

## `scripts` y `docs`

| Archivo | Función |
|---|---|
| `scripts/deploy-all.sh` | Despliega todos los stacks en tres pasadas |
| `docs/` | Documentación para personas |
| `docs/diagrams/` | Diagramas en SVG |

Siguiente: [Pruebas](testing.md)
