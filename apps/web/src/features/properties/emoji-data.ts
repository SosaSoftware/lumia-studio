/** One emoji with the Spanish words people search it by. */
export type EmojiEntry = readonly [emoji: string, keywords: string];

export interface EmojiCategory {
  readonly key: string;
  /** Emoji shown on the category tab. */
  readonly icon: string;
  /** Spanish name of the category. */
  readonly label: string;
  readonly entries: readonly EmojiEntry[];
}

/** Emojis of the general picker, grouped for the tabs. Keywords are lowercase and without accents. */
export const GENERAL_EMOJIS: readonly EmojiCategory[] = [
  {
    key: 'faces',
    icon: '😀',
    label: 'Caras y gestos',
    entries: [
      ['😀', 'feliz sonrisa alegre'], ['😃', 'feliz contento'], ['😄', 'risa alegre'], ['😁', 'sonrisa dientes'], ['😆', 'risa carcajada'], ['😅', 'sudor alivio'],
      ['😂', 'risa lagrimas'], ['🙂', 'sonrisa leve'], ['😉', 'guino'], ['😊', 'sonrojado feliz'], ['😇', 'angel inocente'], ['🥰', 'amor enamorado'],
      ['😍', 'ojos corazon encantado'], ['🤩', 'emocionado estrellas asombro'], ['😘', 'beso'], ['😋', 'rico delicioso'], ['😜', 'travieso lengua'], ['🤪', 'loco divertido'],
      ['🤔', 'pensando duda pregunta'], ['🤨', 'duda ceja'], ['😐', 'neutral serio'], ['😶', 'silencio sin boca'], ['🙄', 'ojos aburrido'], ['😏', 'picaro'],
      ['😴', 'dormir sueno'], ['🤤', 'baba antojo'], ['😌', 'tranquilo alivio calma'], ['😎', 'genial lentes sol'], ['🤓', 'estudioso nerd lentes'], ['🧐', 'monoculo investigar'],
      ['😮', 'sorpresa asombro'], ['😲', 'sorprendido'], ['😳', 'avergonzado'], ['😱', 'miedo susto grito'], ['😨', 'miedo'], ['😢', 'triste llorar'],
      ['😭', 'llanto triste'], ['😞', 'decepcion triste'], ['😠', 'enojado'], ['😡', 'furioso enojo'], ['🤯', 'mente explota asombro'], ['🥳', 'fiesta celebracion'],
      ['🤗', 'abrazo'], ['🤭', 'secreto risa'], ['🤫', 'silencio shh'], ['🥶', 'frio helado'], ['🥵', 'calor'], ['🤒', 'enfermo fiebre'],
      ['👍', 'bien pulgar aprobar'], ['👎', 'mal pulgar'], ['👏', 'aplauso'], ['🙌', 'celebrar manos'], ['🙏', 'gracias por favor'], ['💪', 'fuerza musculo'],
      ['👋', 'saludo hola adios'], ['✌️', 'paz victoria'], ['🤞', 'suerte dedos'], ['👆', 'arriba senalar'], ['👉', 'derecha senalar'], ['👀', 'ojos mirar'],
      ['🧠', 'cerebro mente'], ['❤️', 'corazon amor'], ['💡', 'idea foco'], ['💬', 'dialogo mensaje'],
    ],
  },
  {
    key: 'nature',
    icon: '🌳',
    label: 'Animales y naturaleza',
    entries: [
      ['🐶', 'perro'], ['🐱', 'gato'], ['🐭', 'raton'], ['🐹', 'hamster'], ['🐰', 'conejo'], ['🦊', 'zorro'], ['🐻', 'oso'], ['🐼', 'panda'],
      ['🐨', 'koala'], ['🐯', 'tigre'], ['🦁', 'leon'], ['🐮', 'vaca'], ['🐷', 'cerdo'], ['🐸', 'rana'], ['🐵', 'mono'], ['🐔', 'gallina pollo'],
      ['🐧', 'pinguino'], ['🐦', 'pajaro ave'], ['🦉', 'buho'], ['🦅', 'aguila'], ['🦋', 'mariposa'], ['🐝', 'abeja'], ['🐞', 'mariquita insecto'], ['🐢', 'tortuga'],
      ['🐍', 'serpiente'], ['🦎', 'lagarto'], ['🐙', 'pulpo'], ['🐠', 'pez'], ['🐬', 'delfin'], ['🐳', 'ballena'], ['🦈', 'tiburon'], ['🦖', 'dinosaurio rex'],
      ['🌱', 'planta semilla brote'], ['🌿', 'hierba hoja'], ['🌳', 'arbol'], ['🌴', 'palmera'], ['🌵', 'cactus desierto'], ['🍄', 'hongo'], ['🌸', 'flor cerezo'], ['🌻', 'girasol'],
      ['🌹', 'rosa flor'], ['🍀', 'trebol suerte'], ['🌍', 'tierra mundo planeta'], ['🌙', 'luna noche'], ['☀️', 'sol dia'], ['⭐', 'estrella'], ['🌟', 'estrella brillante'], ['☁️', 'nube'],
      ['🌧️', 'lluvia'], ['⛈️', 'tormenta rayo'], ['❄️', 'nieve copo'], ['🌈', 'arcoiris'], ['🔥', 'fuego'], ['💧', 'agua gota'], ['🌊', 'ola mar'], ['⛰️', 'montana'],
    ],
  },
  {
    key: 'food',
    icon: '🍎',
    label: 'Comida',
    entries: [
      ['🍎', 'manzana fruta'], ['🍐', 'pera'], ['🍊', 'naranja'], ['🍋', 'limon'], ['🍌', 'platano banana'], ['🍉', 'sandia'], ['🍇', 'uvas'], ['🍓', 'fresa'],
      ['🍒', 'cerezas'], ['🍑', 'durazno'], ['🥭', 'mango'], ['🍍', 'pina'], ['🥥', 'coco'], ['🥑', 'aguacate'], ['🍅', 'tomate'], ['🥕', 'zanahoria'],
      ['🌽', 'maiz elote'], ['🥦', 'brocoli'], ['🍞', 'pan'], ['🧀', 'queso'], ['🥚', 'huevo'], ['🍳', 'huevo frito'], ['🥞', 'panqueques'], ['🍔', 'hamburguesa'],
      ['🍕', 'pizza'], ['🌮', 'taco'], ['🍝', 'pasta espagueti'], ['🍚', 'arroz'], ['🍰', 'pastel'], ['🍪', 'galleta'], ['🍫', 'chocolate'], ['🍩', 'dona'],
      ['🍦', 'helado'], ['🥛', 'leche'], ['☕', 'cafe'], ['🥤', 'refresco bebida'],
    ],
  },
  {
    key: 'activities',
    icon: '⚽',
    label: 'Actividades y premios',
    entries: [
      ['⚽', 'futbol balon'], ['🏀', 'baloncesto'], ['🏈', 'futbol americano'], ['⚾', 'beisbol'], ['🎾', 'tenis'], ['🏐', 'voleibol'], ['🏓', 'ping pong'], ['🥊', 'boxeo'],
      ['🏆', 'trofeo premio campeon'], ['🥇', 'medalla oro primero'], ['🥈', 'medalla plata'], ['🥉', 'medalla bronce'], ['🏅', 'medalla'], ['🎯', 'diana objetivo meta'], ['🎮', 'videojuego control'], ['🎲', 'dado juego'],
      ['🧩', 'rompecabezas pieza'], ['♟️', 'ajedrez'], ['🎨', 'arte pintura paleta'], ['🎭', 'teatro mascaras'], ['🎤', 'microfono cantar'], ['🎧', 'audifonos musica'], ['🎵', 'musica nota'], ['🎸', 'guitarra'],
      ['🎹', 'piano'], ['🥁', 'tambor bateria'], ['🎬', 'cine claqueta'], ['📸', 'camara foto'], ['🎉', 'fiesta confeti celebracion'], ['🎊', 'confeti'], ['🎁', 'regalo sorpresa'], ['🎈', 'globo'],
    ],
  },
  {
    key: 'travel',
    icon: '🚀',
    label: 'Viajes y lugares',
    entries: [
      ['🚀', 'cohete espacio'], ['🛸', 'ovni platillo'], ['🛰️', 'satelite'], ['🪐', 'saturno planeta anillos'], ['🌌', 'galaxia'], ['☄️', 'cometa'], ['🌠', 'estrella fugaz'], ['🔭', 'telescopio'],
      ['✈️', 'avion'], ['🚁', 'helicoptero'], ['🚗', 'auto carro'], ['🚕', 'taxi'], ['🚌', 'autobus'], ['🚎', 'trolebus'], ['🚂', 'tren'], ['🚲', 'bicicleta'],
      ['⛵', 'velero barco'], ['🚢', 'barco'], ['🏠', 'casa'], ['🏫', 'escuela'], ['🏛️', 'museo edificio'], ['🏙️', 'ciudad'], ['🌆', 'ciudad atardecer'], ['🗺️', 'mapa'],
      ['🧭', 'brujula'], ['⛺', 'campamento'], ['🏖️', 'playa'], ['🌋', 'volcan'], ['🗽', 'estatua libertad'], ['🗼', 'torre'], ['🎡', 'rueda feria'], ['🎢', 'montana rusa'],
    ],
  },
  {
    key: 'objects',
    icon: '💻',
    label: 'Objetos y escuela',
    entries: [
      ['📚', 'libros'], ['📖', 'libro abierto lectura'], ['📝', 'nota escribir tarea'], ['✏️', 'lapiz'], ['🖊️', 'pluma boligrafo'], ['📏', 'regla'], ['📐', 'escuadra geometria'], ['🔬', 'microscopio ciencia'],
      ['🧪', 'tubo ensayo quimica'], ['⚗️', 'alambique quimica'], ['🧬', 'adn genetica'], ['🔭', 'telescopio'], ['⚙️', 'engranaje'], ['🔧', 'llave herramienta'], ['🧲', 'iman'], ['💻', 'computadora laptop'],
      ['🖥️', 'monitor computadora'], ['📱', 'telefono celular'], ['⌨️', 'teclado'], ['🖱️', 'raton mouse'], ['🔋', 'bateria energia'], ['💾', 'guardar disquete'], ['📊', 'grafica barras'], ['📈', 'grafica sube crecimiento'],
      ['📉', 'grafica baja'], ['🗓️', 'calendario'], ['⏰', 'reloj alarma'], ['⏳', 'reloj arena tiempo'], ['🔍', 'lupa buscar'], ['🔑', 'llave'], ['🔒', 'candado cerrado'], ['🛒', 'carrito compras'],
      ['💰', 'dinero bolsa'], ['🪙', 'moneda'], ['📣', 'megafono anuncio'], ['🔔', 'campana aviso'], ['📌', 'chincheta ubicacion'], ['🧮', 'abaco calculo'], ['🖼️', 'cuadro imagen'], ['🎒', 'mochila escuela'],
    ],
  },
  {
    key: 'symbols',
    icon: '✅',
    label: 'Símbolos',
    entries: [
      ['✅', 'correcto listo visto'], ['❌', 'incorrecto error cruz'], ['⭕', 'circulo'], ['❓', 'pregunta'], ['❗', 'exclamacion atencion'], ['⚠️', 'advertencia peligro'], ['🚫', 'prohibido'], ['➕', 'mas suma'],
      ['➖', 'menos resta'], ['✖️', 'multiplicacion por'], ['➗', 'division'], ['🟰', 'igual'], ['♻️', 'reciclaje'], ['🔄', 'repetir ciclo'], ['➡️', 'flecha derecha'], ['⬅️', 'flecha izquierda'],
      ['⬆️', 'flecha arriba'], ['⬇️', 'flecha abajo'], ['🔴', 'circulo rojo'], ['🟠', 'circulo naranja'], ['🟡', 'circulo amarillo'], ['🟢', 'circulo verde'], ['🔵', 'circulo azul'], ['🟣', 'circulo morado'],
      ['🔺', 'triangulo rojo'], ['🔷', 'rombo azul'], ['💯', 'cien perfecto'], ['✨', 'brillo destellos magia'], ['⚡', 'rayo energia'], ['💥', 'explosion'], ['🆕', 'nuevo'], ['🔝', 'arriba top'],
    ],
  },
];

/** Characters for the guide, the comic and similar components: people, professions, animals and fantasy. */
export const CHARACTER_EMOJIS: readonly EmojiCategory[] = [
  {
    key: 'people',
    icon: '🧑',
    label: 'Personas',
    entries: [
      ['🧑', 'persona'], ['👦', 'nino'], ['👧', 'nina'], ['👨', 'hombre'], ['👩', 'mujer'], ['🧒', 'infante'], ['👴', 'abuelo'], ['👵', 'abuela'],
      ['🧔', 'barba'], ['👱', 'rubio'], ['👨‍🦱', 'rizado'], ['👩‍🦱', 'rizada'], ['👨‍🦰', 'pelirrojo'], ['👩‍🦰', 'pelirroja'], ['👩‍🦳', 'canosa'], ['🧑‍🦲', 'calvo'],
    ],
  },
  {
    key: 'jobs',
    icon: '👩‍🏫',
    label: 'Profesiones',
    entries: [
      ['👩‍🏫', 'maestra profesora'], ['👨‍🏫', 'maestro profesor'], ['🧑‍🏫', 'docente'], ['🧑‍🎓', 'estudiante alumno'], ['👩‍🎓', 'estudiante alumna'], ['👨‍🎓', 'estudiante alumno'],
      ['👩‍🔬', 'cientifica'], ['👨‍🔬', 'cientifico'], ['🧑‍🔬', 'cientifique'], ['👩‍🚀', 'astronauta mujer'], ['👨‍🚀', 'astronauta hombre'], ['🧑‍🚀', 'astronauta'],
      ['👩‍⚕️', 'doctora medica'], ['👨‍⚕️', 'doctor medico'], ['🧑‍🍳', 'cocinero chef'], ['👩‍🌾', 'granjera agricultora'], ['👨‍🌾', 'granjero agricultor'], ['👩‍💻', 'programadora'],
      ['👨‍💻', 'programador'], ['🧑‍💻', 'tecnologia programacion'], ['👩‍🎨', 'artista pintora'], ['👨‍🎨', 'artista pintor'], ['👩‍🚒', 'bombera'], ['👨‍🚒', 'bombero'],
      ['👮', 'policia'], ['🕵️', 'detective'], ['👷', 'constructor obrero'], ['🤴', 'principe'], ['👸', 'princesa'], ['🧑‍✈️', 'piloto'],
    ],
  },
  {
    key: 'fantasy',
    icon: '🧙',
    label: 'Fantasía y robots',
    entries: [
      ['🦸', 'superheroe'], ['🦹', 'villano'], ['🧙', 'mago hechicero'], ['🧚', 'hada'], ['🧛', 'vampiro'], ['🧜', 'sirena'], ['🧞', 'genio'], ['🧟', 'zombi'],
      ['🥷', 'ninja'], ['🎅', 'santa claus'], ['🤖', 'robot'], ['👽', 'extraterrestre alien'], ['👾', 'monstruo videojuego'], ['👻', 'fantasma'], ['🤡', 'payaso'], ['💀', 'calavera'],
      ['🐲', 'dragon'], ['🦄', 'unicornio'], ['🦖', 'dinosaurio'], ['🦕', 'dinosaurio cuello largo'],
    ],
  },
  {
    key: 'animals',
    icon: '🐶',
    label: 'Animales',
    entries: [
      ['🐶', 'perro'], ['🐱', 'gato'], ['🐭', 'raton'], ['🐰', 'conejo'], ['🦊', 'zorro'], ['🐻', 'oso'], ['🐼', 'panda'], ['🐨', 'koala'],
      ['🐯', 'tigre'], ['🦁', 'leon'], ['🐮', 'vaca'], ['🐷', 'cerdo'], ['🐸', 'rana'], ['🐵', 'mono'], ['🐔', 'gallina'], ['🐧', 'pinguino'],
      ['🦉', 'buho'], ['🦅', 'aguila'], ['🦋', 'mariposa'], ['🐢', 'tortuga'], ['🐙', 'pulpo'], ['🐬', 'delfin'], ['🐘', 'elefante'], ['🦒', 'jirafa'],
      ['🦓', 'cebra'], ['🐴', 'caballo'], ['🦜', 'loro'], ['🐝', 'abeja'],
    ],
  },
];

export function emojiCategories(set: 'general' | 'characters'): readonly EmojiCategory[] {
  return set === 'characters' ? CHARACTER_EMOJIS : GENERAL_EMOJIS;
}

/** Entries whose keywords contain every word typed, in category order. Accents and case are ignored. */
export function searchEmojis(categories: readonly EmojiCategory[], query: string): EmojiEntry[] {
  const words = query
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== '');
  if (words.length === 0) return [];
  const seen = new Set<string>();
  const found: EmojiEntry[] = [];
  for (const category of categories) {
    for (const entry of category.entries) {
      if (seen.has(entry[0])) continue;
      if (words.every((word) => entry[1].includes(word) || category.label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(word))) {
        seen.add(entry[0]);
        found.push(entry);
      }
    }
  }
  return found;
}
