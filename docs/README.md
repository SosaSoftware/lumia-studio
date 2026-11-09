# Documentación de Lumia Studio

Índice de la documentación de Lumia Studio y de Lumi, ordenado por necesidad. Se elige el grupo que corresponde a la tarea y se baja a la página concreta solo si hace falta.

## Entender

- [overview.md](overview.md): qué hacen Lumia Studio y Lumi, y glosario de términos con su nombre en el código. Se lee primero, sin importar la tarea.
- [architecture/README.md](architecture/README.md): piezas del sistema, diagrama de AWS y recursos de cada stack. Se lee para saber dónde vive cada responsabilidad.
- [architecture/lumi.md](architecture/lumi.md): recorrido de un mensaje y de un cambio con consentimiento. Se lee para entender cómo trabaja el agente.

## Correr

- [development/setup.md](development/setup.md): requisitos, instalación, cuentas de prueba y servicios locales. Se lee para levantar el editor y Lumi en la máquina local.
- [development/testing.md](development/testing.md): tipos de prueba, comandos y lo que necesita cada uno. Se lee para ejecutar o agregar pruebas.

## Cambiar

- [development/README.md](development/README.md): ruta para el primer día en el repositorio. Se lee al empezar a trabajar en el código.
- [development/repository.md](development/repository.md): carpetas y paquetes, sus puntos de entrada y cuándo tocarlos. Se lee para ubicar dónde va un cambio.
- [development/conventions.md](development/conventions.md): idioma, TypeScript, ESLint, commits y secretos. Se lee para preparar un cambio.
- [architecture/api.md](architecture/api.md), [architecture/data.md](architecture/data.md), [architecture/authentication.md](architecture/authentication.md), [architecture/lumi-tools.md](architecture/lumi-tools.md) y [architecture/lumi-reference.md](architecture/lumi-reference.md): detalle de cada pieza. Se leen al cambiar esa pieza.

## Desplegar

- [operations/deployment.md](operations/deployment.md): stacks, tres pasadas, comandos y riesgos. Se lee para desplegar un entorno nuevo o actualizar uno existente.

## Operar

- [operations/content.md](operations/content.md): árbol de contenido, cuentas, roles y accesos en la base de datos. Se lee para agregar clases o dar acceso a una persona.
- [operations/troubleshooting.md](operations/troubleshooting.md): logs, síntomas, mensajes y limitaciones conocidas. Se lee al diagnosticar un problema.

## README de cada parte

| Parte | README |
|---|---|
| Repositorio | [README.md](../README.md) |
| API y Studio MCP | [apps/api/README.md](../apps/api/README.md) |
| Web | [apps/web/README.md](../apps/web/README.md) |
| Lumi | [apps/agent/README.md](../apps/agent/README.md) |
| Sandbox | [sandbox/README.md](../sandbox/README.md) |

Siguiente: [Visión general](overview.md)
