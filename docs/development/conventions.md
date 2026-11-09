# Convenciones

Reglas del repositorio que se comprueban en sus archivos de configuración, en su código y en su historial. Aplican a todo cambio.

## Idioma

- Código, nombres y comentarios en inglés, incluida la documentación en el código (TSDoc).
- Documentación para personas en español: los `README.md` y `docs/`.
- Nombres de archivos y carpetas en inglés.
- Los mensajes que ve una persona están en español: los errores de la API y los textos de la web. El catálogo configura Zod con `z.locales.es()` porque sus mensajes de validación llegan al editor.

## TypeScript

Cada workspace extiende `tsconfig.base.json`, que activa estas opciones:

| Opción | Valor |
|---|---|
| `strict` | `true` |
| `noUncheckedIndexedAccess` | `true` |
| `noImplicitOverride` | `true` |
| `noFallthroughCasesInSwitch` | `true` |
| `verbatimModuleSyntax` | `true` |
| `isolatedModules` | `true` |
| `allowImportingTsExtensions` | `true` |
| `module` y `moduleResolution` | `NodeNext` |
| `target` | `ES2023` |
| `noEmit` | `true` |

- Los workspaces son ESM (`"type": "module"`) e importan con la extensión `.ts`.
- `apps/web` cambia `module` a `ESNext` y `moduleResolution` a `Bundler`, y agrega los tipos del DOM.
- La app de CDK (`bin`, `lib` y `test`) usa `tsconfig.json` de la raíz, también con `strict`, e importa sin extensión.
- `npm run typecheck` revisa la raíz y cada workspace.

## ESLint

`eslint.config.mjs` aplica `@eslint/js` recomendado, `strictTypeChecked` y `stylisticTypeChecked` de typescript-eslint, y `flat/essential` de `eslint-plugin-vue`. Agrega tres reglas:

| Regla | Efecto |
|---|---|
| `@typescript-eslint/consistent-type-imports` | Los tipos se importan con `import type` |
| `@typescript-eslint/explicit-module-boundary-types` | Las funciones exportadas declaran sus tipos |
| `@typescript-eslint/naming-convention` | Las interfaces van en `PascalCase` y sin prefijo `I` |

```bash
npm run lint
```

## Pruebas por paquete

| Paquete | Framework |
|---|---|
| `@lumia/api`, `@lumia/agent`, `@lumia/packages`, `@lumia/sandbox` | Vitest |
| `@lumia/web` | Vitest con `happy-dom`, y Playwright para end-to-end |
| App de CDK | Jest con `@swc/jest` |

Las pruebas unitarias viven junto al código como `*.test.ts`. Las de integración usan el sufijo `.integration.test.ts` y las funcionales `.functional.test.ts`. Detalle en [testing.md](testing.md).

## Commits

Los mensajes de commit siguen este formato:

```text
tipo(ámbito): resumen
```

- `tipo` indica la clase de cambio. El historial usa `feat` y `fix`.
- `ámbito` nombra la parte del repositorio. El historial usa `agent`, `api`, `docs`, `foundational`, `mcp`, `sandbox` y `web`.
- `resumen` va en inglés y describe el cambio en una frase breve, por ejemplo `fix(agent): repair Lumi gateway auth, session storage and change consent`.

## Secretos

- `.gitignore` excluye `.env` y `.env.*`; solo se versiona `.env.example`. También excluye `scripts/credentials.sh`, `.sandbox/` y `apps/web/public/config.json`.
- La configuración local de los asistentes de IA no se versiona. Cada asistente agrega sus rutas al bloque de asistentes de IA de `.gitignore` al configurarse, según [docs/agents/setup.md](../agents/setup.md).
- `npm run sandbox:up` genera los secretos locales con `openssl` y no imprime sus valores.
- `BEDROCK_API_KEY` se define en el entorno del shell, nunca en `.env`.
- En AWS, los secretos de la base de datos viven en Secrets Manager. La carga manual de datos usa el secreto por su ARN, sin leer su valor.
- Lumi envuelve los secretos en `SecretValue`, que se imprime como `[redacted]`.
- AppSync registra solo errores y sin contenido detallado, para no escribir el token de la persona.

## Diagramas

Los diagramas viven en `docs/diagrams/` como SVG. Las páginas los incrustan como imágenes de Markdown con rutas relativas.

Siguiente: [Operación](../operations/README.md)
