# Web de Lumia Studio

## Propósito

`@lumia/web` es el editor de Lumia Studio, en Vue 3 y Vite. Incluye el árbol de clases, el lienzo de diapositivas, las propiedades, la línea de tiempo, los comentarios, los medios, la vista previa y el panel de Lumi. Las rutas y la configuración están en [docs/architecture/README.md](../../docs/architecture/README.md).

## Ejecución

Requiere el sandbox, con Docker.

```bash
npm run sandbox:init
npm run dev:up
```

La web abre en <http://localhost:5173>. `sandbox/scripts/dev.sh` escribe `public/config.json` al iniciar el servicio `web`, y Vite reenvía `/graphql`, `/dev/login`, `/storage` y `/lumi` a los servicios locales. Detalle en [docs/development/setup.md](../../docs/development/setup.md).

## Pruebas

```bash
npm test -w @lumia/web
npm run test:e2e -w @lumia/web
```

Las pruebas unitarias usan Vitest con `happy-dom`. Las de Playwright buscan en `apps/web/e2e`, carpeta que no existe en el repositorio. Detalle en [docs/development/testing.md](../../docs/development/testing.md).

## Estructura

```text
apps/web/src/
├── api/                  cliente GraphQL y llamadas a la API
├── auth/                 proveedores de sesión
├── config/               lectura de config.json
├── features/             una carpeta por función del editor, incluida lumi/
├── pages/                páginas del router
└── router/               rutas y protección de sesión
```

El recorrido completo de las carpetas está en [docs/development/repository.md](../../docs/development/repository.md).

## Scripts disponibles

| Comando | Función |
|---|---|
| `npm run dev -w @lumia/web` | Inicia Vite |
| `npm run build -w @lumia/web` | Type check y build de producción |
| `npm run typecheck -w @lumia/web` | Type check con `vue-tsc` |
| `npm test -w @lumia/web` | Pruebas unitarias con Vitest |
| `npm run test:e2e -w @lumia/web` | Pruebas de Playwright |
