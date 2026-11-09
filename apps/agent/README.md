# Lumi

## Propósito

`@lumia/agent` es Lumi, el agente de cocreación de Lumia Studio. Usa el SDK de Strands para TypeScript y su harness (`createHarness`), y sirve AG-UI sobre SSE de la misma forma en local y en Amazon Bedrock AgentCore Runtime. El comportamiento del agente está en [docs/architecture/lumi.md](../../docs/architecture/lumi.md).

## Ejecución

Requiere el sandbox (`npm run sandbox:init`) y acceso a Claude Sonnet 4.6 en Amazon Bedrock (`us.anthropic.claude-sonnet-4-6`) en `AWS_REGION`, con credenciales de AWS o `BEDROCK_API_KEY`. La llave se define en el entorno del shell y nunca en `.env`.

```bash
npm run dev:up
```

El comando inicia Lumi junto con la API, la web y el emulador del gateway. La web llega a Lumi en `/lumi/invocations` por el proxy de Vite. Si `.env` no define `LUMI_MCP_URL`, `LUMI_SESSION_DIR` ni `LUMI_MEMORY_DIR`, `sandbox/scripts/dev.sh` aporta los valores locales.

Para ejecutar solo Lumi, con recarga al cambiar el código:

```bash
npm run dev -w @lumia/agent
```

La imagen se construye desde la raíz del repositorio, con Docker y Buildx:

```bash
docker buildx build --platform linux/arm64 -f apps/agent/Dockerfile -t lumi .
```

## Pruebas

```bash
npm test -w @lumia/agent
npm run test:integration -w @lumia/agent
npm run test:functional -w @lumia/agent
```

Las pruebas unitarias son herméticas y forman parte de `npm run verify`. Las de integración usan un modelo guionizado contra un Studio local. Las funcionales usan el modelo real en Bedrock y consumen tokens. Detalle en [docs/development/testing.md](../../docs/development/testing.md).

## Estructura

```text
apps/agent/
├── Dockerfile                 imagen arm64 para AgentCore Runtime
├── policies/confirmation.json reglas de consentimiento
├── scripts/build.ts           bundle de esbuild del punto de entrada de AgentCore
├── skills/                    skills de cocreación, un SKILL.md por carpeta
├── src/
│   ├── entrypoints/           local.ts (sandbox) y remote.ts (AgentCore)
│   ├── interventions/         ConfirmationGate, llamadas de pantalla pendientes y cierre de turnos
│   ├── server/                servidor AG-UI, guardia de entrada y registro de conversaciones
│   ├── prompts/               instrucciones y extracción de preferencias
│   ├── lumi.agent.ts          Lumi, construido con createHarness para cada conversación
│   └── lumi-runtime.ts        conecta todo desde la configuración y lo sirve
└── test/                      pruebas de integración y funcionales, con su soporte
```

El recorrido completo de las carpetas está en [docs/development/repository.md](../../docs/development/repository.md). El contrato HTTP, los límites y las variables de entorno están en [docs/architecture/lumi-reference.md](../../docs/architecture/lumi-reference.md).

## Scripts disponibles

| Comando | Función |
|---|---|
| `npm run dev -w @lumia/agent` | Ejecuta Lumi en local con recarga |
| `npm run start:local -w @lumia/agent` | Ejecuta Lumi en local sin recarga |
| `npm run build -w @lumia/agent` | Empaqueta `dist/remote.mjs` con esbuild |
| `npm run start -w @lumia/agent` | Ejecuta `dist/remote.mjs` |
| `npm run typecheck -w @lumia/agent` | Type check del paquete |
| `npm test -w @lumia/agent` | Pruebas unitarias herméticas |
| `npm run test:integration -w @lumia/agent` | Lumi contra un Studio local sobre el Postgres del sandbox, con un modelo guionizado |
| `npm run test:functional -w @lumia/agent` | Lumi con su modelo real en Bedrock. Queda fuera de `npm run verify`. |
