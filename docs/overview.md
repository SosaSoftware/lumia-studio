# Visión general

Lumia Studio es un editor web de clases interactivas. Lumi es el agente de cocreación que trabaja dentro del editor. Esta página explica qué hace cada uno y define los términos que usa el resto de la documentación.

## Lumia Studio

Lumia Studio organiza el contenido en un árbol: categoría, subcategoría, carpetas y clases. Cada clase guarda diapositivas con componentes, narraciones, audios y pausas en una línea de tiempo. Una clase publicada se exporta como un archivo `.lumia`.

Lumia Studio tiene datos, personas, roles, permisos e infraestructura de AWS propios. El editor edita el contenido de las clases existentes. El árbol, las personas, los roles y los accesos se administran en la base de datos.

El editor incluye el árbol de clases, el lienzo de diapositivas, las propiedades, la línea de tiempo, los comentarios, la biblioteca de medios, la vista previa y el panel de Lumi.

## Lumi

Lumi crea y edita clases desde el panel del editor y guía a la persona por la pantalla.

- Es reactivo: actúa solo sobre lo que la persona pide. No sugiere ni revisa por iniciativa propia.
- Usa el token de la persona, así que Studio aplica los permisos de esa persona a cada llamada.
- Ningún cambio se ejecuta sin consentimiento: la persona lo acepta en pantalla, en el mismo turno y con los mismos argumentos.
- No accede a la base de datos: lee y escribe por la API de Studio.

## Ciclo de una clase

1. La clase existe en el árbol, sin contenido.
2. Al crear su documento nace la versión 1, en borrador.
3. Publicar el borrador lo convierte en la versión publicada, archiva la anterior y exporta el archivo `.lumia`.
4. Para seguir editando se crea un borrador nuevo, copia de la versión publicada.

El detalle de las tablas y las operaciones está en [architecture/data.md](architecture/data.md).

## Glosario

| Término | En el código | Significado |
|---|---|---|
| Árbol | `studio.category`, `studio.subcategory` y `studio.tree_node` | Estructura del contenido: categoría, subcategoría, carpetas y clases. |
| Categoría | `studio.category` | Primer nivel del árbol. Tiene su propia biblioteca de medios. |
| Subcategoría | `studio.subcategory` | Segundo nivel del árbol. Pertenece a una categoría. |
| Carpeta | `studio.tree_node` con `kind` en `folder` | Agrupa carpetas y clases dentro de una subcategoría. |
| Grupo de menú | `group_name` en `studio.category` y `studio.subcategory` | Encabezado visual de los menús. No tiene reglas de acceso. |
| Clase | `studio.tree_node` con `kind` en `class`, y su `studio.class_document` | Hoja del árbol. Su nombre lógico termina en `.lumia`. El documento guarda su contenido. |
| Versión | `studio.document_version` | Copia numerada del contenido de una clase, con estado `draft`, `published` o `archived`. |
| Borrador | `studio.document_version` con `status` en `draft` | Versión editable. Una clase tiene como máximo un borrador. |
| Publicación | `publishVersion` y `export_status` de `studio.document_version` | Convierte el borrador en la versión publicada y exporta su archivo `.lumia` al bucket `Published`. |
| Archivo `.lumia` | Lambda `Export` | Zip con `definition.json`, medios y audios de una versión publicada. |
| Diapositiva | `studio.slide` | Pantalla de una clase, con tipo, título, fondo, duración, transición y modo de avance. |
| Componente | `studio.slide_element` y el catálogo de `packages/src/catalog` | Elemento de una diapositiva: texto, medio, forma, interacción o pregunta. El catálogo define 28 componentes. |
| Línea de tiempo | `studio.narration_clip`, `studio.audio_clip` y `studio.pause` | Narraciones, audios y pausas de una diapositiva. |
| Narración | `studio.narration_clip` | Guion que Amazon Polly convierte en audio. |
| Medio | `studio.media_asset` | Archivo de la biblioteca de una categoría. |
| Rol | `studio.role` y `studio.role_permission` | Conjunto de acciones que una persona puede ejecutar. |
| Acción | `PERMISSION_CATALOG`, por ejemplo `documents.edit` | Permiso que Cedar evalúa en cada operación. |
| Acceso | `studio.access_grant` | Categoría completa o subcategoría donde una persona usa las acciones de su rol. |
| Turno | — | Va desde un mensaje de la persona hasta que Lumi termina de trabajar en él. Puede abarcar varias peticiones, una por cada ronda de herramientas de pantalla. |
| Herramienta | Studio MCP (`apps/api/src/mcp`) y herramientas de pantalla (`frontend-tools.ts`) | Operación que Lumi puede invocar. |
| Consentimiento | `confirm_change` y `ConfirmationGate` | Aceptación en pantalla de un cambio que Lumi propone. Vale una vez, en el mismo turno y con los mismos argumentos. |
| Skill | `apps/agent/skills/<name>/SKILL.md` | Instrucciones de Lumi que se cargan bajo demanda. |

Siguiente: [Arquitectura](architecture/README.md)
