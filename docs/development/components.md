# Componentes de diapositiva

El catálogo define 66 componentes en 10 grupos. La API, la web y Lumi leen el mismo catálogo: ninguna lista de componentes se repite fuera de `packages/src/catalog`. Esta página describe los grupos, las convenciones de las propiedades y los archivos que cambian al agregar un componente.

## Dónde vive cada parte

| Parte | Ubicación |
|---|---|
| Definición, esquema Zod, valores por defecto y tamaño | `packages/src/catalog/components/<grupo>-components.ts` |
| Propiedades compartidas (color, estilo, emoji, intentos, confeti) | `packages/src/catalog/components/shared.ts` |
| Registro del catálogo y orden | `packages/src/catalog/index.ts` (`BASE_COMPONENTS`) |
| Renderizador Vue | `apps/web/src/features/slide-components/<Nombre>Block.vue` |
| Registro de renderizadores | `apps/web/src/features/slide-components/index.ts` (`CATALOG_COMPONENTS`) |
| Auxiliares de color, movimiento y confeti | `tone.ts`, `motion.ts` y `confetti.ts` en la misma carpeta |
| Orden en la paleta | `apps/web/src/features/palette/palette.ts` |
| Íconos de la paleta | `apps/web/src/ui/studio-icons.ts` (`cmp-<clave>`, `group-<grupo>`) |
| Nombres en español e inglés | `apps/web/src/i18n/locales/{es,en}/catalog.ts` y `properties.ts` |

## Convenciones de las propiedades

- El panel de Propiedades se construye desde el JSON Schema del componente. Cada propiedad del esquema aparece como un campo, con la etiqueta de `properties.fields` y las opciones de `properties.values`.
- Una propiedad nueva de un componente existente lleva `.default(...)`. Los elementos guardados antes del cambio siguen validando.
- El color es una llave del tema: `surface`, `surface-alt`, `primary`, `accent`, `success`, `warning`, `danger`, `text`, `muted`, `purple`, `pink` u `orange`. Nunca un valor hexadecimal.
- La propiedad `variant` elige cómo se pinta la superficie: `gradient`, `solid` o `soft`.
- El color y el estilo son propiedades de cada componente. No existe un tema global de diapositiva.
- Las preguntas y los juegos tienen `color` y `confetti`. Las preguntas reciben además `attempts` y los mensajes de retroalimentación.
- Un componente que puede ocupar el alto de su contenido declara `fitsContent: true`.
- Una propiedad de texto marcada con `.meta({ emojiSet: 'general' })` o `'characters'` (ayudante `emojiProp` de `shared.ts`) se edita con un selector de emojis. El conjunto `characters` ofrece solo personas, profesiones, animales y figuras de fantasía.
- Una propiedad marcada con `.meta({ hidden: true })` no aparece en Propiedades. Se usa para propiedades antiguas que se conservan solo para que las diapositivas guardadas sigan dibujándose.
- Una propiedad marcada con `.meta({ editor: 'flowchart' })` o `'mindmap'` se edita con el editor de texto Mermaid.

## Diagramas y mapas mentales

`diagram` y `mindmap` guardan su contenido como texto en la propiedad `code`, en un subconjunto de Mermaid que analiza `packages/src/catalog/diagram-code.ts`. El mismo texto lo escriben las personas, el editor visual de Propiedades y Lumi.

| Componente | Sintaxis | Ejemplo |
|---|---|---|
| `diagram` | `flowchart`: nodos `A[texto]`, `A(texto)`, `A([texto])`, `A((texto))`, `A{texto}`; uniones `-->`, `---`, `-.->`, `==>` con etiqueta `-->\|texto\|` | `A[Inicio] --> B{¿Listo?}` |
| `mindmap` | `mindmap`, idea central `root((Tema))` y ramas sangradas por niveles | `  root((Energía))` y, debajo, `    Solar` |

- El analizador conserva lo que entiende y reporta el resto con su número de línea. La validación del catálogo rechaza el texto con errores y Lumi recibe el mensaje.
- `kind` del diagrama elige la distribución: `flow` (por capas), `cycle` (en círculo) o `hierarchy` (por capas, siempre de arriba abajo).
- La primera línea del texto da la orientación de un `flow`: `flowchart LR` (horizontal, de izquierda a derecha) o `flowchart TD` (vertical, de arriba abajo). El selector de orientación del editor visual reescribe esa línea.
- Los diagramas y mapas guardados con las propiedades antiguas (`nodes` y `edges`, o `center` y `branches`) se siguen dibujando. Al primer cambio en el editor visual se convierten a texto.
- El editor visual de Propiedades reescribe el texto: agrega, renombra, conecta y quita nodos. Se desactiva mientras el texto tiene errores.

## Flecha y conector

La flecha (`arrow`) puede ser libre, con dirección, o unir dos componentes: `fromElementId` y `toElementId` eligen los elementos, `fromAnchor` y `toAnchor` el lado de cada extremo y `style` la forma de la línea (recta, curva o en codo). Una flecha unida sigue a los elementos que une. El conector (`connector`) se conserva sin cambios para las diapositivas que ya lo usan.

## Modos de renderizado

Cada renderizador recibe `mode`:

| Modo | Dónde | Comportamiento |
|---|---|---|
| `edit` | Lienzo del editor y miniaturas | Contenido estático. Los bucles decorativos corren en el lienzo y no en las miniaturas. |
| `student` | Vista previa y demo | Interacciones, entradas animadas y juegos. |

Las animaciones respetan `prefers-reduced-motion`. Los componentes que informan si la actividad terminó usan `useQuestionState` o `useCompletion`, para que una diapositiva con avance «Al completar» continúe.

## Catálogo

### Texto

| Clave | Nombre | Uso |
|---|---|---|
| `title` | Título | Título o encabezado de la diapositiva. Uno por diapositiva. |
| `title_animated` | Título animado | Título llamativo con degradado y entrada animada palabra por palabra. Ideal para portadas y aperturas de tema. |
| `paragraph` | Párrafo | Explicación breve en prosa. Máximo 3 o 4 oraciones claras. |
| `paragraph_highlight` | Párrafo con resaltados | Párrafo con palabras o frases clave resaltadas para guiar la lectura. Lista en highlights las frases exactas a resaltar. |
| `bullet_list` | Lista | Puntos clave, pasos o ejemplos. De 2 a 6 elementos cortos. |
| `table` | Tabla | Tabla para organizar datos en columnas y filas. De 1 a 6 columnas y 1 a 10 filas. |
| `callout` | Destacado | Idea clave, consejo, advertencia o dato importante que debe resaltar. |
| `quote` | Cita | Cita o frase célebre con autor y fuente opcionales. |
| `banner` | Banner | Cinta o etiqueta llamativa para marcar una sección nueva, un reto o un aviso corto. |
| `stepper` | Pasos | Secuencia de 2 a 6 pasos numerados con el paso actual resaltado. Para procesos e instrucciones. |
| `typewriter` | Máquina de escribir | Texto corto que se escribe letra por letra frente al estudiante. Para preguntas detonantes o revelaciones. |
| `code_snippet` | Bloque de código | Fragmento de código con resaltado de sintaxis y números de línea. Para clases de programación. |

### Multimedia

| Clave | Nombre | Uso |
|---|---|---|
| `image` | Imagen | Imagen que apoya la explicación. Sin medio subido, describe en prompt la imagen que la persona debe agregar. |
| `video` | Video | Video corto. Sin medio subido, describe en prompt el video que la persona debe agregar. |
| `audio` | Audio | Clip de audio. Sin medio subido, describe en prompt el audio que la persona debe agregar. |
| `icon` | Ícono | Ícono decorativo del catálogo para acompañar texto o resaltar ideas. |
| `illustration` | Ilustración | Ilustración generada o subida. Describe en prompt el estilo y contenido deseado. |
| `animation` | Animación | GIF o imagen con movimiento continuo (flotar, latir, girar, rebotar) para dar vida a la diapositiva. |
| `before_after` | Antes y después | Dos imágenes superpuestas con un deslizador que el estudiante arrastra para compararlas. |
| `gallery` | Galería | Galería de 2 a 8 imágenes: una a la vez con navegación, en mosaico o en cuadrícula. |
| `carousel` | Carrusel | Tarjetas con imagen o emoji, título y texto que el estudiante recorre una a una. De 2 a 8 tarjetas. |

### Decorativos

| Clave | Nombre | Uso |
|---|---|---|
| `sticker` | Sticker | Emoji sobre una forma de color, con movimiento suave. Decora y da tono a la diapositiva; no lleva contenido. |
| `badge` | Medalla | Medalla o insignia de logro con emoji y etiqueta. Para celebrar avances o marcar retos por desbloquear. |
| `confetti` | Celebración | Mensaje de celebración que lanza confeti al aparecer o cuando el estudiante hace clic. Para cerrar un reto o una clase. |

### Formas y diagramas

| Clave | Nombre | Uso |
|---|---|---|
| `shape` | Forma | Forma geométrica básica para decorar o agrupar: rectángulo, cuadrado, círculo, elipse, triángulo, rombo, pentágono, hexágono, octágono, estrella, corazón, cruz, paralelogramo o trapecio. Puede llevar un texto corto dentro. |
| `arrow` | Flecha | Flecha para señalar o para unir dos componentes de la diapositiva. Con fromElementId y toElementId une dos elementos y los sigue si se mueven; sin ellos es una flecha libre con dirección. |
| `connector` | Conector | Línea que conecta visualmente dos elementos de la diapositiva. |
| `diagram` | Diagrama | Diagrama de flujo, ciclo o jerarquía escrito en sintaxis Mermaid (flowchart): nodos con forma y uniones con flechas y etiquetas. kind elige la distribución: flow (por capas, de izquierda a derecha), cycle (en círculo) o hierarchy (por capas, de arriba abajo). |
| `mindmap` | Mapa mental | Mapa mental escrito en sintaxis Mermaid (mindmap): una idea central y ramas con sub-ideas, sangradas por niveles. Para organizar un tema. |
| `pyramid` | Pirámide | Jerarquía de 2 a 6 niveles en forma de pirámide, de la cima a la base. Para prioridades o cadenas. |
| `venn` | Diagrama de Venn | Dos o tres conjuntos que se cruzan, con sus elementos propios y los que comparten. Para comparar. |
| `funnel` | Embudo | Etapas que se van estrechando, de la más amplia a la más pequeña. De 2 a 6 etapas. |

### Datos y gráficos

| Clave | Nombre | Uso |
|---|---|---|
| `bar_chart` | Gráfico de barras | Compara de 2 a 10 cantidades con barras. Cada barra tiene etiqueta, valor y color. |
| `donut_chart` | Gráfico de dona | Muestra cómo se reparte un total en 2 a 8 partes, como dona o pastel, con leyenda. |
| `counter` | Contador | Número grande que cuenta hasta su valor al aparecer, con etiqueta. Para destacar una cifra. |
| `progress_ring` | Anillo de progreso | Anillo que se llena hasta un porcentaje, con el valor al centro. Para avance o proporciones. |
| `progress_bar` | Barra de progreso | Barra horizontal que se llena hasta un valor, con etiqueta y porcentaje. |
| `stat_card` | Tarjeta de dato | Tarjeta con una cifra grande, emoji, descripción y tendencia opcional. Para datos clave. |

### Interactivos

| Clave | Nombre | Uso |
|---|---|---|
| `flip_card` | Tarjeta que se voltea | Pregunta o concepto al frente y respuesta o definición atrás; el estudiante la voltea. |
| `button_link` | Botón o enlace | Botón que navega a otra diapositiva o abre una URL externa. |
| `hotspot` | Punto interactivo | Punto que al hacer clic muestra contenido oculto. Ideal sobre imágenes. |
| `tabs` | Pestañas | Contenido organizado en pestañas. De 2 a 5 pestañas. |
| `accordion` | Acordeón | Secciones colapsables. De 2 a 6 secciones. |
| `timeline_component` | Línea de tiempo | Secuencia cronológica de 2 a 8 eventos, horizontal o vertical. |
| `timer` | Temporizador | Cuenta regresiva para actividades cronometradas. |
| `content_grid` | Cuadrícula de tarjetas | De 2 a 9 tarjetas con emoji, título y texto en cuadrícula. Para conceptos, ejemplos o categorías. |
| `roulette` | Ruleta | Ruleta de 2 a 10 opciones que el estudiante gira para elegir un tema, un reto o un turno al azar. |
| `dice` | Dado | Uno o dos dados que el estudiante lanza con un clic. Para juegos, turnos o problemas de probabilidad. |
| `scratch_card` | Rasca y descubre | Contenido oculto bajo una capa que el estudiante raspa con el cursor o el dedo para descubrirlo. |

### Preguntas

| Clave | Nombre | Uso |
|---|---|---|
| `multiple_choice` | Opción múltiple | Pregunta con 2 a 6 opciones y una sola respuesta correcta, con retroalimentación. |
| `true_false` | Verdadero o falso | Afirmación que el estudiante marca como verdadera o falsa, con retroalimentación. |
| `fill_blank` | Completar | Texto con espacios en blanco marcados con [[respuesta]] que el estudiante debe rellenar. |
| `drag_drop` | Arrastrar y soltar | Elementos que el estudiante arrastra a sus destinos correctos, con retroalimentación. |
| `ordering` | Ordenar | Lista de elementos que el estudiante debe ordenar correctamente. De 2 a 8 elementos. |
| `matching` | Unir | Pares que el estudiante debe emparejar correctamente. De 2 a 6 pares. |
| `quiz_timer` | Pregunta contrarreloj | Pregunta de opción múltiple con cuenta regresiva: al terminar el tiempo se bloquea y muestra la respuesta. |

### Juegos

| Clave | Nombre | Uso |
|---|---|---|
| `memory` | Memoria | Juego de memoria con 2 a 8 parejas. Cada pareja puede ser idéntica (🪐 y 🪐) o un concepto y su respuesta (H₂O y Agua). |
| `word_search` | Sopa de letras | Sopa de letras con 3 a 10 palabras escondidas que el estudiante marca arrastrando sobre las letras. |
| `hangman` | Ahorcado | Adivinar una palabra o frase corta letra por letra antes de agotar los errores, con pista opcional. |
| `racing` | Carrera de preguntas | Carrera contra un rival: cada respuesta correcta adelanta al estudiante; el rival avanza solo con el tiempo. De 2 a 8 preguntas. |

### Personajes

| Clave | Nombre | Uso |
|---|---|---|
| `character_guide` | Personaje guía | Personaje con nombre que habla al estudiante en una burbuja. Para narrar, presentar un tema o dar instrucciones. |
| `comic` | Viñeta de cómic | Viñeta de cómic con un escenario, de 1 a 3 personajes y sus diálogos, y un recuadro de narración opcional. |
| `emotion_avatar` | Avatar de emociones | Cara que expresa una emoción. Con interactive, el estudiante elige cómo se siente: sirve como termómetro emocional. |
| `scene_background` | Fondo de escena | Fondo temático que ocupa la diapositiva, con elementos animados. Va detrás del resto de componentes. |

### Lumi

| Clave | Nombre | Uso |
|---|---|---|
| `lumi_orb` | Orbe de Lumi | Orbe animado que representa a Lumi, el asistente de voz. Indica que Lumi escucha, piensa o narra la diapositiva. |
| `lumi_bubble` | Burbuja de Lumi | Mensaje de Lumi en una burbuja de chat, con indicador de escritura antes de aparecer. |

Siguiente: [Pruebas](testing.md)
