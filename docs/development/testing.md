# Pruebas

El repositorio tiene pruebas unitarias, de integración, funcionales de Lumi, end-to-end de la web y pruebas de la app de CDK. Las unitarias no necesitan servicios; las demás necesitan el sandbox. Esta página indica dónde vive cada tipo, cómo se ejecuta y qué necesita.

## Tipos de prueba

| Tipo | Ubicación | Framework | Necesita |
|---|---|---|---|
| Unitarias | `src/**/*.test.ts` de cada workspace, junto al código; también `sandbox/seed/**/*.test.ts` | Vitest; la web usa `happy-dom` | Nada adicional |
| CDK | `test/*.test.ts` en la raíz | Jest con `@swc/jest` | Nada adicional |
| Integración | `test/integration/**/*.integration.test.ts` en `apps/api`, `apps/agent` y `sandbox` | Vitest, un archivo a la vez | `npm run sandbox:init` |
| Funcionales de Lumi | `apps/agent/test/functional/**/*.functional.test.ts` | Vitest | `npm run sandbox:init` y acceso a Bedrock |
| End-to-end | `apps/web/e2e` | Playwright | `npm run sandbox:init` y `npm run dev:up` |

Las pruebas de CDK revisan las plantillas sin empaquetar las funciones; `npm run synth` construye las funciones y la web.

Las pruebas unitarias de Lumi son herméticas: no usan red, AWS ni servicios del sandbox. Las de integración de Lumi levantan la API del sandbox y el emulador del gateway en el mismo proceso, usan un modelo guionizado y no llaman a Bedrock.

## Comandos

| Comando | Alcance | Necesita |
|---|---|---|
| `npm test` | Pruebas unitarias de cada workspace y de CDK | Nada adicional |
| `npm run test:integration` | API, sandbox y Lumi contra Postgres | `npm run sandbox:init` |
| `npm test -w @lumia/agent` | Pruebas unitarias de Lumi | Nada adicional |
| `npm run test:integration -w @lumia/agent` | Lumi contra un Studio local, con modelo guionizado | `npm run sandbox:init` |
| `npm run test:functional -w @lumia/agent` | Lumi con su modelo real en Bedrock, como lo usa la web | `npm run sandbox:init` y acceso a Bedrock |
| `npm run test:e2e` | Playwright contra la web | `npm run sandbox:init` y `npm run dev:up` |

Cada workspace acepta `npm test -w <paquete>`. `@lumia/api` y `@lumia/sandbox` aceptan también `npm run test:integration -w <paquete>`.

`npm run test:functional -w @lumia/agent` consume tokens del modelo y queda fuera de `npm run verify`.

## Verificación

| Comando | Función |
|---|---|
| `npm run typecheck` | Type check de la raíz y de cada workspace |
| `npm run lint` | ESLint |
| `npm run synth` | Síntesis de CDK con cdk-nag |
| `npm run verify` | Type check, lint, pruebas unitarias y síntesis |

## Playwright

- `apps/web/playwright.config.ts` busca las pruebas en `apps/web/e2e`. Esa carpeta no existe en el repositorio.
- La URL base usa `LUMIA_WEB_PORT`, o el puerto 5173.
- `PLAYWRIGHT_CHANNEL=chrome` usa Google Chrome instalado en lugar del navegador que descarga `playwright install`.

Siguiente: [Convenciones](conventions.md)
