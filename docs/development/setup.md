# Entorno local

El sandbox levanta Lumia Studio en la máquina local, sin desplegar nada en AWS. Reemplaza Aurora, AppSync, Cognito, S3 y los gateways de AgentCore. Solo Lumi necesita acceso a AWS, porque usa un modelo de Amazon Bedrock.

## Requisitos

| Requisito | Motivo |
|---|---|
| Node.js 22.13 o posterior y npm | Workspaces del monorepo |
| Docker, con el demonio activo | Postgres del sandbox |
| `openssl` y `curl` | `openssl` genera los secretos de `.env`; `curl` comprueba los servicios |
| Acceso a Bedrock | Solo para Lumi: credenciales de AWS o `BEDROCK_API_KEY` |

`BEDROCK_API_KEY` se define en el entorno del shell y nunca en `.env`.

## Instalación

```bash
npm install
npm run sandbox:init
npm run dev:up
```

`npm run sandbox:init` levanta Postgres, aplica las migraciones y carga los datos de ejemplo. Después se abre <http://localhost:5173>.

El primer `npm run sandbox:up` crea `.env` desde `.env.example` y genera secretos aleatorios sin imprimirlos. `.env` no se versiona.

## Cuentas de prueba

El inicio de sesión del sandbox solo comprueba que el correo sea de una cuenta activa. La contraseña no se revisa.

| Correo | Rol | Acceso |
|---|---|---|
| `admin@studio.test` | Administración | Academia Lumia y Escuela de Ciencias |
| `creadora@studio.test` | Creación de contenido | Academia Lumia, todas sus subcategorías |
| `matematicas@studio.test` | Creación de contenido | Academia Lumia, solo Matemáticas |
| `lectora@studio.test` | Lectura | Academia Lumia, solo lectura |
| `sin-acceso@studio.test` | Sin rol | Sin acceso. La pantalla de inicio lo indica. |

La clase *Fundamentos › ¿Qué es la inteligencia artificial?* trae ocho diapositivas de ejemplo. Las demás clases empiezan vacías.

`npm run db:seed` carga roles, categorías, árbol y personas desde `sandbox/seed/seed-data.ts`. Cada registro se actualiza por su llave lógica, así que repetir el comando conserva el contenido creado.

## Servicios locales

`npm run dev:up` inicia cuatro servicios en segundo plano. Guarda el pid y el log de cada uno en `.sandbox/`.

| Servicio | Puerto por defecto | Comprobación | Comando interno | Función |
|---|---|---|---|---|
| `api` | 4000 | `/health` | `npx tsx watch sandbox/src/main.ts` | API GraphQL, login de desarrollo y almacenamiento firmado |
| `web` | 5173 | `/` | `npm run dev -w @lumia/web` | Servidor Vite del editor |
| `mcp` | 4100 | `/health` | `npx tsx watch sandbox/src/mcp-gateway/main.ts` | Emulador de AgentCore Gateway, con MCP en `/mcp` |
| `lumi` | 8080 | `/ping` | `npm run dev -w @lumia/agent` | Agente |

Postgres escucha por defecto en el puerto 5432 de `127.0.0.1`.

`lumi` arranca al final, así que el editor funciona aunque Lumi no inicie. Si `lumi` falla, `npm run dev:up` termina con error y deja los otros servicios en ejecución.

`dev.sh` escribe `apps/web/public/config.json` con `authMode` en `dev`. Vite reenvía estas rutas a los servicios locales, por lo que el navegador no necesita CORS:

| Ruta | Destino |
|---|---|
| `/graphql` | API del sandbox |
| `/dev/login` | Login de desarrollo |
| `/storage` | Almacenamiento firmado |
| `/lumi` | Lumi, sin el prefijo `/lumi` |

### Servidor local

| Ruta | Función |
|---|---|
| `GET /health` | Estado del servidor |
| `POST /dev/login` | Login de desarrollo con `{ "email": "..." }`. Responde 401 si la cuenta no existe y 403 si no tiene acceso. |
| `/graphql` | API GraphQL, con los mismos handlers que AppSync |
| `GET` y `PUT /storage/<key>` | Archivos con ruta firmada |

`McpGatewayEmulator` se comporta como AgentCore Gateway con targets Lambda: sirve MCP en `/mcp`, verifica el token del sandbox en lugar del de Cognito, lista las herramientas como `<target>___<tool>`, ejecuta el mismo handler que la Lambda con el token en `bedrockAgentCorePropagatedHeaders` y devuelve el JSON de la herramienta como texto del resultado MCP.

## Lumi local

`npm run dev:up` inicia Lumi con estos valores si `.env` no los define:

| Variable | Valor local |
|---|---|
| `LUMI_MCP_URL` | `http://localhost:4100/mcp` |
| `LUMI_SESSION_DIR` | `.sandbox/lumi/sessions` |
| `LUMI_MEMORY_DIR` | `.sandbox/lumi/memory` |

Para ejecutar solo Lumi, con recarga al cambiar el código:

```bash
npm run dev -w @lumia/agent
```

Esa forma lee `.env` pero no aplica los valores de la tabla: `.env` debe definirlos.

## Diferencias con AWS

| Pieza | AWS | Sandbox |
|---|---|---|
| Base de datos | Aurora con Data API | Postgres 16 en Docker |
| Inicio de sesión | Cognito | `POST /dev/login` con un JWT HS256 |
| API | AppSync y Lambdas | `SandboxServer` con el mismo `FieldPipeline` |
| Archivos | S3 con URLs firmadas | `.sandbox/storage` con rutas firmadas `/storage/*` |
| Narración | Amazon Polly | `LUMIA_SPEECH_PROVIDER` en `none` por defecto |
| Gateway MCP | `lumia-studio-tools` | `McpGatewayEmulator` |
| Gateway de entrada | `lumia-lumi-entry` | Proxy `/lumi` de Vite |
| Conversaciones | Bucket `Sessions` | `.sandbox/lumi/sessions` |
| Exportación `.lumia` | Lambda `Export` | No existe: el sandbox no exporta clases |

## Scripts del sandbox

| Comando | Función |
|---|---|
| `npm run sandbox:up` | Crea `.env` si falta y levanta Postgres |
| `npm run sandbox:down` | Detiene Postgres |
| `npm run sandbox:reset` | Borra la base del sandbox y levanta una vacía |
| `npm run sandbox:status` | Muestra el estado de Postgres |
| `npm run sandbox:init` | Ejecuta `sandbox:up`, `db:migrate` y `db:seed` |
| `npm run db:migrate` | Aplica las migraciones |
| `npm run db:seed` | Carga los datos de ejemplo. Se puede repetir: conserva el contenido creado. |
| `npm run dev:up` | Inicia los servicios locales |
| `npm run dev:down` | Detiene los servicios locales |
| `npm run dev:status` | Muestra el estado de cada servicio |
| `npm run dev:logs <service>` | Sigue el log de `api`, `web`, `mcp` o `lumi` |

Después de `npm run sandbox:reset`, se ejecutan `npm run db:migrate` y `npm run db:seed` para recuperar los datos de ejemplo.

## Variables de entorno

`npm run sandbox:up` completa en `.env` las variables vacías de esta tabla, sin imprimir sus valores, salvo `LUMIA_MCP_PORT` y `LUMI_PORT`, que son opcionales. Las demás variables de Lumi están en [architecture/lumi-reference.md](../architecture/lumi-reference.md).

| Variable | Propósito |
|---|---|
| `LUMIA_SANDBOX_DB_PASSWORD` | Contraseña de `lumia_admin`. Se genera al azar. |
| `LUMIA_SANDBOX_DB_PORT` | Puerto local de Postgres |
| `LUMIA_DB_DRIVER` | Controlador de base de datos: `pg` |
| `LUMIA_DB_NAME` | Nombre de la base de datos |
| `LUMIA_PG_HOST`, `LUMIA_PG_PORT` | Conexión de la API a Postgres |
| `LUMIA_DB_STUDIO_APP_PASSWORD` | Contraseña de `studio_app`. Se genera al azar. |
| `LUMIA_DEV_JWT_SECRET` | Secreto de los tokens de desarrollo. Se genera al azar. |
| `LUMIA_STORAGE_SIGNING_SECRET` | Secreto de las rutas firmadas. Se genera al azar. |
| `LUMIA_API_PORT` | Puerto de la API, también para el proxy de Vite |
| `LUMIA_API_BASE_URL` | URL base de las rutas firmadas |
| `LUMIA_STORAGE_DRIVER` | Almacenamiento: `filesystem` |
| `LUMIA_STORAGE_ROOT` | Carpeta de archivos |
| `LUMIA_SPEECH_PROVIDER` | Proveedor de voz: `none` |
| `LUMIA_WEB_PORT` | Puerto de Vite y URL base de Playwright |
| `LUMIA_MCP_PORT` | Puerto del emulador del gateway |
| `LUMI_PORT` | Puerto de Lumi, también para el proxy de Vite |
| `AWS_REGION` | Región de Bedrock para Lumi |

Siguiente: [Recorrido del repositorio](repository.md)
