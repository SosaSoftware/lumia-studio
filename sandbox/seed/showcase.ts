import type { DraftElement, DraftSlide } from '@lumia/api/services';

let z = 0;

/** An element of the showcase; `z` grows in reading order and each element appears half a second after the previous one. */
function el(component: string, x: number, y: number, w: number, h: number, props: Record<string, unknown>, appearsAtS = 0): DraftElement {
  z += 1;
  return { component, x, y, w, h, z, appearsAtS, entrance: component === 'title' ? 'fade' : 'appear', props };
}

const title = (text: string, level: 'h1' | 'h2' = 'h2'): DraftElement => el('title', 6, 4, 88, 7, { text, level, align: 'left' });

/** Eight slides that use every component of the catalog, in the order of the palette groups. */
export const SHOWCASE_SLIDES: DraftSlide[] = [
  {
    type: 'cover',
    title: 'Portada',
    background: 'surface',
    elements: [
      el('paragraph', 7, 12, 50, 4, { text: 'Fundamentos de inteligencia artificial', align: 'left', size: 'sm' }),
      el('title', 7, 16, 48, 14, { text: '¿Qué es la inteligencia artificial?', level: 'h1', align: 'left' }, 0.5),
      el('paragraph', 7, 33, 46, 4, { text: 'Cómo aprenden las máquinas', align: 'left', size: 'md' }, 1),
      el('button_link', 7, 40, 17, 5.4, { label: 'Comenzar', action: 'next_slide', target: '' }, 2),
      el('illustration', 58, 9, 36, 26, { mediaId: null, alt: 'Persona conversando con un asistente', prompt: 'Ilustración plana de una persona y un asistente virtual', style: 'flat' }, 1.5),
    ],
  },
  {
    type: 'explanatory',
    title: 'Texto',
    background: 'surface',
    elements: [
      title('La IA aprende de ejemplos'),
      el('paragraph', 6, 13, 52, 9, { text: 'Un sistema de inteligencia artificial encuentra patrones en muchos ejemplos y los usa para responder preguntas nuevas.', align: 'left', size: 'md' }, 1),
      el('bullet_list', 6, 24, 52, 20, { items: ['Datos: los ejemplos', 'Modelo: lo que aprende', 'Respuesta: lo que produce'], ordered: true }, 2),
      el('callout', 62, 13, 32, 13, { title: 'Idea clave', text: 'La IA no piensa como una persona: calcula la respuesta más probable.', tone: 'key' }, 3),
      el('table', 62, 29, 32, 16, { columns: ['Ejemplo', 'Tarea'], rows: [['Traductor', 'Cambiar de idioma'], ['Asistente de voz', 'Responder preguntas']], headerRow: true }, 4),
      el('bullet_list', 6, 45, 52, 8, { items: ['Siempre revisamos sus respuestas'], ordered: false }, 5),
    ],
  },
  {
    type: 'explanatory',
    title: 'Multimedia',
    background: 'surface',
    elements: [
      title('Dónde la encontramos'),
      el('image', 6, 13, 40, 26, { mediaId: null, alt: 'Celular con un asistente de voz', prompt: 'Foto de un celular con un asistente de voz en pantalla', caption: 'Un asistente en el celular', fit: 'contain' }, 1),
      el('video', 50, 13, 44, 25, { mediaId: null, title: 'La IA en la vida diaria', prompt: 'Video corto con ejemplos de traductores, mapas y asistentes', startAtS: 0, autoplay: false }, 2),
      el('audio', 6, 43, 40, 8, { mediaId: null, title: 'Resumen en audio', prompt: 'Narración breve que resume la clase', showControls: true }, 3),
      el('icon', 50, 42, 8, 8, { name: 'computer', color: 'primary', label: 'Computadora' }, 4),
      el('icon', 60, 42, 8, 8, { name: 'idea', color: 'warning', label: 'Idea' }, 4),
      el('icon', 70, 42, 8, 8, { name: 'check', color: 'success', label: 'Correcto' }, 4),
      el('icon', 80, 42, 8, 8, { name: 'heart', color: 'danger', label: 'Me gusta' }, 4),
    ],
  },
  {
    type: 'whiteboard',
    title: 'Formas y diagramas',
    background: 'surface-alt',
    elements: [
      title('Cómo responde un asistente'),
      el('shape', 6, 14, 18, 12, { kind: 'rectangle', fill: 'accent', stroke: 'accent', strokeWidth: 1 }, 1),
      el('shape', 30, 14, 12, 12, { kind: 'ellipse', fill: 'primary', stroke: 'primary', strokeWidth: 0 }, 1.5),
      el('arrow', 6, 30, 18, 4, { direction: 'right', color: 'primary', strokeWidth: 2 }, 2),
      el('arrow', 30, 29, 4, 10, { direction: 'down', color: 'accent', strokeWidth: 3 }, 2),
      el('connector', 6, 38, 36, 12, { fromElementId: '', toElementId: '', style: 'straight', color: 'accent' }, 2.5),
      el('diagram', 46, 13, 48, 24, {
        kind: 'hierarchy',
        nodes: [{ id: 'a', text: 'Asistente' }, { id: 'b', text: 'Escuchar' }, { id: 'c', text: 'Responder' }, { id: 'd', text: 'Micrófono' }, { id: 'e', text: 'Altavoz' }],
        edges: [{ from: 'a', to: 'b' }, { from: 'a', to: 'c' }, { from: 'b', to: 'd' }, { from: 'c', to: 'e' }],
      }, 3),
      el('diagram', 46, 39, 48, 15, {
        kind: 'flow',
        nodes: [{ id: 'a', text: 'Pregunta' }, { id: 'b', text: 'Buscar patrones' }, { id: 'c', text: 'Respuesta' }],
        edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }],
      }, 4),
    ],
  },
  {
    type: 'explanatory',
    title: 'Interactivos A',
    background: 'surface',
    elements: [
      title('Explora los conceptos'),
      el('flip_card', 6, 13, 26, 18, { front: '¿Qué necesita una IA para aprender?', back: 'Muchos ejemplos: los datos' }, 1),
      el('button_link', 6, 35, 20, 6, { label: 'Ir a la práctica', action: 'go_to_slide', target: '7' }, 2),
      el('hotspot', 38, 15, 5, 5, { label: 'Datos', content: 'Los ejemplos con los que aprende el sistema.' }, 2),
      el('hotspot', 46, 15, 5, 5, { label: 'Modelo', content: 'Lo que el sistema aprendió de los datos.' }, 2.5),
      el('timer', 62, 13, 32, 11, { seconds: 30, label: 'Piensa en un ejemplo', autoStart: false }, 3),
      el('tabs', 36, 28, 58, 25, {
        tabs: [
          { title: 'Traducir', content: 'Cambia un texto de un idioma a otro.' },
          { title: 'Recomendar', content: 'Sugiere videos o canciones parecidas.' },
          { title: 'Reconocer', content: 'Identifica objetos en una foto.' },
        ],
      }, 4),
    ],
  },
  {
    type: 'explanatory',
    title: 'Interactivos B',
    background: 'surface',
    elements: [
      title('Para repasar'),
      el('accordion', 6, 13, 42, 28, {
        sections: [
          { title: 'Datos', content: 'Son los ejemplos con los que se aprende.' },
          { title: 'Modelo', content: 'Es lo que el sistema aprende de los datos.' },
          { title: 'Respuesta', content: 'Es lo que el sistema produce ante una pregunta nueva.' },
        ],
      }, 1),
      el('gallery', 52, 13, 42, 28, {
        items: [
          { mediaId: null, alt: 'Traductor en el celular', caption: 'Traductor' },
          { mediaId: null, alt: 'Mapa con una ruta', caption: 'Mapa' },
          { mediaId: null, alt: 'Asistente de voz', caption: 'Asistente de voz' },
        ],
      }, 2),
      el('timeline_component', 6, 43, 88, 11, {
        events: [
          { label: '1950', description: 'Primeras ideas sobre máquinas que aprenden' },
          { label: '1997', description: 'Una computadora gana al ajedrez' },
          { label: '2011', description: 'Asistentes de voz en el celular' },
          { label: 'Hoy', description: 'Asistentes que conversan' },
        ],
      }, 3),
    ],
  },
  {
    type: 'quiz',
    title: 'Preguntas A',
    background: 'surface',
    elements: [
      title('Comprueba lo que aprendiste'),
      el('multiple_choice', 6, 13, 56, 24, {
        question: '¿Qué necesita una IA para aprender?',
        options: [{ id: 'a', text: 'Solo electricidad' }, { id: 'b', text: 'Muchos ejemplos' }, { id: 'c', text: 'Un teclado' }, { id: 'd', text: 'Una cámara' }],
        correctOptionId: 'b',
        feedbackCorrect: '¡Muy bien!',
        feedbackIncorrect: 'Piensa en cómo aprende: con ejemplos.',
        attempts: 2,
      }, 1),
      el('true_false', 66, 13, 28, 20, { statement: 'La IA siempre tiene la razón.', answer: false, feedbackCorrect: '¡Correcto! Hay que revisar sus respuestas.', feedbackIncorrect: 'Revisa la explicación.', attempts: 1 }, 2),
      el('fill_blank', 6, 40, 88, 13, { text: 'La IA aprende con [[datos]] y produce una [[respuesta]].', caseSensitive: false, feedbackCorrect: '¡Correcto!', feedbackIncorrect: 'Revisa las palabras.', attempts: 2 }, 3),
    ],
  },
  {
    type: 'quiz',
    title: 'Preguntas B',
    background: 'surface',
    elements: [
      title('Practica'),
      el('drag_drop', 6, 13, 56, 24, {
        items: [{ id: 'i1', text: 'Traductor' }, { id: 'i2', text: 'Mapa' }],
        targets: [{ id: 't1', text: 'Cambia el idioma', correctItemId: 'i1' }, { id: 't2', text: 'Muestra el camino', correctItemId: 'i2' }],
        feedbackCorrect: '¡Correcto!',
        feedbackIncorrect: 'Intenta de nuevo.',
        attempts: 2,
      }, 1),
      el('ordering', 66, 13, 28, 24, { items: ['Hacer una pregunta', 'Buscar patrones', 'Dar una respuesta'], feedbackCorrect: '¡Correcto!', feedbackIncorrect: 'Revisa el orden.', attempts: 2 }, 2),
      el('matching', 6, 39, 88, 15, {
        pairs: [{ left: 'Datos', right: 'Ejemplos' }, { left: 'Modelo', right: 'Lo aprendido' }, { left: 'Respuesta', right: 'Lo que produce' }],
        feedbackCorrect: '¡Correcto!',
        feedbackIncorrect: 'Revisa las parejas.',
        attempts: 2,
      }, 3),
    ],
  },
];

/** Narration clips of the second slide: scripts only, because the sandbox cannot reach Polly to pick a voice. */
export const SHOWCASE_NARRATION = [
  { slide: 2, startsAtS: 1, script: 'Un sistema de inteligencia artificial aprende de muchos ejemplos. Con ellos encuentra patrones.' },
  { slide: 2, startsAtS: 13, script: 'Aunque sus respuestas parecen humanas, siempre conviene revisarlas.' },
] as const;

/** Pause of the second slide, after the first narration clip. */
export const SHOWCASE_PAUSE = { slide: 2, startsAtS: 8, durationS: 5, message: 'Piensa en un ejemplo', onEnd: 'continue' } as const;
