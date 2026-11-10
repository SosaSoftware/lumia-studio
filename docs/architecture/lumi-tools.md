# Herramientas y skills de Lumi

Lumi usa tres grupos de herramientas: las del Studio MCP, que leen y cambian clases por la API; las de pantalla, que ejecuta la web; y las del harness. Las skills son instrucciones que Lumi carga bajo demanda. Esta página es la referencia de cada una.

## Studio MCP

El gateway nombra cada herramienta `<target>___<tool>`, por ejemplo `studio-slides___delete_slide`. Las cuatro Lambdas viven en `LumiaStudioMcpStack` y el código en `apps/api/src/mcp`. Los esquemas de las herramientas viven en los targets de `LumiaStudioAgentStack`, así que agregar o cambiar una herramienta exige desplegar los dos stacks.

| Target | Herramienta | Acción | Función |
|---|---|---|---|
| `studio-read` | `get_my_access` | `documents.view` | Rol, acciones y herramientas disponibles para la persona |
| `studio-read` | `list_categories` | `documents.view` | Categorías y subcategorías visibles |
| `studio-read` | `list_tree` | `documents.view` | Carpetas y clases de una subcategoría |
| `studio-read` | `get_class` | `documents.view` | Resumen de una clase |
| `studio-read` | `get_slide` | `documents.view` | Diapositiva completa |
| `studio-read` | `list_components` | `documents.view` | Catálogo de componentes |
| `studio-read` | `search_media` | `documents.view` | Búsqueda en la biblioteca de medios |
| `studio-read` | `list_voices` | `documents.view` | Voces de Amazon Polly |
| `studio-slides` | `add_slides` | `documents.edit` | Agrega diapositivas |
| `studio-slides` | `update_slide` | `documents.edit` | Cambia datos de una diapositiva |
| `studio-slides` | `move_slide` | `documents.edit` | Mueve una diapositiva |
| `studio-slides` | `duplicate_slide` | `documents.edit` | Duplica una diapositiva |
| `studio-slides` | `delete_slide` | `documents.edit` | Borra una diapositiva |
| `studio-elements` | `add_element` | `documents.edit` | Agrega un componente |
| `studio-elements` | `update_element` | `documents.edit` | Cambia un componente |
| `studio-elements` | `delete_element` | `documents.edit` | Borra un componente |
| `studio-timeline` | `save_narration` | `documents.edit` | Crea o cambia una narración |
| `studio-timeline` | `generate_narration_audio` | `narration.generate` | Genera el audio con Polly |
| `studio-timeline` | `delete_narration` | `documents.edit` | Borra una narración |
| `studio-timeline` | `save_audio_clip` | `documents.edit` | Coloca o ajusta un audio |
| `studio-timeline` | `delete_audio_clip` | `documents.edit` | Quita un audio |
| `studio-timeline` | `save_pause` | `documents.edit` | Crea o cambia una pausa |
| `studio-timeline` | `delete_pause` | `documents.edit` | Borra una pausa |

Cada herramienta responde JSON: el resultado o `{ error: { code, message } }`. Si un cambio tiene que crear un borrador, su respuesta incluye `draft.idMap`: id anterior y id nuevo de cada elemento copiado.

| Código | Significado |
|---|---|
| `forbidden` | El rol no permite la acción |
| `unauthenticated` | La sesión no es válida o venció |
| `not_found` | El registro no existe |
| `invalid_input` | Los argumentos no son válidos |
| `conflict` | El estado actual impide la operación |
| `unknown_tool` | La herramienta no existe en ese target |
| `unavailable` | Studio no respondió |

## Herramientas de pantalla

La web las declara en cada petición y las ejecuta en el navegador (`apps/web/src/features/lumi/frontend-tools.ts`).

| Herramienta | Función |
|---|---|
| `open_class` | Abre una clase del árbol |
| `select_slide` | Selecciona una diapositiva |
| `select_element` | Selecciona un elemento |
| `open_panel` | Abre un panel |
| `highlight_element` | Resalta un elemento o control |
| `filter_tree` | Filtra el árbol por estado o texto |
| `start_preview` | Inicia la vista previa |
| `confirm_change` | Pide confirmación de los cambios |

### `confirm_change`

Lumi llama a `confirm_change` con un cambio por cada llamada que ejecutará:

```json
{
  "message": "<pregunta de confirmación>",
  "changes": [
    {
      "action": "studio-slides___delete_slide",
      "summary": "<qué cambia, en el idioma de la persona>",
      "arguments": { "nodeId": "<node-id>", "slideId": "<slide-id>" },
      "targets": [{ "kind": "slide", "id": "<slide-id>", "label": "<título visible>" }]
    }
  ]
}
```

| Campo | Requerido | Contenido |
|---|---|---|
| `message` | Sí | Pregunta en una frase |
| `changes` | Sí | Un elemento por llamada, de 1 a 20 |
| `changes[].action` | Sí | Nombre exacto de la herramienta |
| `changes[].summary` | Sí | Descripción del cambio |
| `changes[].arguments` | Sí | Argumentos exactos que Lumi enviará |
| `changes[].targets` | No | Elementos existentes que el cambio afecta. `kind` es `slide`, `element`, `narration`, `audio_clip` o `pause`. |

La web muestra una tarjeta de confirmación y responde `{ confirmed }`. Si no pudo preguntar, responde `{ confirmed: false, error }`, por ejemplo cuando la petición es inválida o un elemento no está en la clase abierta. Las reglas del servidor están en [lumi.md](lumi.md).

## Herramientas del harness

| Herramienta | Función |
|---|---|
| `skills` | Carga una skill |
| `todo_write` | Lleva una lista de pasos en trabajos largos |
| `search_memory` | Busca en las preferencias de la persona |

## Skills

Cada skill vive en `apps/agent/skills/<name>/SKILL.md`. El campo `name` de cada `SKILL.md` debe coincidir con el nombre de su carpeta.

| Skill | Se usa para |
|---|---|
| `class-editing` | Cambiar, mover, duplicar o borrar diapositivas y componentes |
| `narration` | Escribir, cambiar o generar narraciones, y colocar audios y pausas |
| `question-slides` | Escribir preguntas o un quiz |
| `slide-creation` | Crear diapositivas o el contenido de una clase vacía |
| `studio-guide` | Explicar Lumia Studio y guiar a la persona por la pantalla |

Siguiente: [Referencia de Lumi](lumi-reference.md)
