import type { IconName } from '@lumia/packages/catalog';

const ring = (cx: number, cy: number, r: number): string => `M${String(cx)} ${String(cy - r)}a${String(r)} ${String(r)} 0 1 0 0 ${String(2 * r)}a${String(r)} ${String(r)} 0 1 0 0 ${String(-2 * r)}z`;

/** Line icons (24×24, drawn with `stroke: currentColor`) of the `icon` component. */
export const CONTENT_ICONS: Readonly<Record<IconName, readonly string[]>> = {
  math: ['M5 6h6M8 3v6M14 6h5M5 15l4 4M9 15l-4 4M14 16h5M14 19h5'],
  science: ['M9 3h6M10 3v6L5 18a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 18l-5-9V3M7.5 14h9'],
  idea: ['M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z'],
  alert: ['M12 3 2 21h20zM12 10v5M12 18h.01'],
  question: [ring(12, 12, 9), 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01'],
  check: ['M20 6 9 17l-5-5'],
  clock: [ring(12, 12, 9), 'M12 7v5l3 2'],
  book: ['M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z'],
  computer: ['M3 5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM8 20h8M12 16v4'],
  globe: [ring(12, 12, 9), 'M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18'],
  heart: ['M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z'],
  star: ['M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z'],
  lightning: ['M13 2 4 14h7l-1 8 9-12h-7z'],
  magnifier: [ring(11, 11, 7), 'M20 20l-4-4'],
  pencil: ['M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'],
  palette: ['M12 3a9 9 0 0 0 0 18c1.2 0 1.5-1 1-2-.6-1.2.2-2.5 1.5-2.5H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5z', 'M7.5 11h.01M10 7h.01M15 7.5h.01'],
  music: ['M9 18V5l12-2v13', ring(6, 18, 3), ring(18, 16, 3)],
  camera: ['M4 8a2 2 0 0 1 2-2h2l2-2h4l2 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', ring(12, 13, 3)],
  microphone: ['M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM5 10a7 7 0 0 0 14 0M12 17v5M8 22h8'],
  trophy: ['M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4'],
  medal: ['M8 3l2 6M16 3l-2 6', ring(12, 15, 6), 'M12 12.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3z'],
  puzzle: ['M10 3h4v2a2 2 0 1 0 4 0V3h3v7h-2a2 2 0 1 0 0 4h2v7h-7v-2a2 2 0 1 0-4 0v2H3v-7h2a2 2 0 1 0 0-4H3V3z'],
  gear: [
    ring(12, 12, 3),
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  ],
  chart: ['M4 20V10M10 20V4M16 20v-7M21 20H3'],
  calculator: ['M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h4'],
  atom: ['M12 12h.01', 'M12 3c2.5 0 4.5 4 4.5 9s-2 9-4.5 9-4.5-4-4.5-9 2-9 4.5-9z', 'M4.2 7.5c1.2-2.2 5.7-1.9 10 .6s6.8 6.3 5.6 8.4-5.7 1.9-10-.6-6.8-6.3-5.6-8.4z'],
  dna: ['M7 3c0 6 10 6 10 12 0 3-2 5-3 6M17 3c0 6-10 6-10 12 0 3 2 5 3 6M8.5 7h7M8.5 17h7M10 12h4'],
  plant: ['M12 21v-9M12 12C12 7 8 4 4 4c0 5 3 8 8 8zM12 14c0-4 3-7 8-7 0 4-3 7-8 7zM8 21h8'],
  mountain: ['M3 20 9 9l4 6 2-3 6 8z'],
  sun: [ring(12, 12, 4), 'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41'],
};

export const CONTENT_ICON_LABELS: Readonly<Record<IconName, string>> = {
  math: 'Matemáticas',
  science: 'Ciencia',
  idea: 'Idea',
  alert: 'Alerta',
  question: 'Pregunta',
  check: 'Correcto',
  clock: 'Reloj',
  book: 'Libro',
  computer: 'Computadora',
  globe: 'Mundo',
  heart: 'Corazón',
  star: 'Estrella',
  lightning: 'Rayo',
  magnifier: 'Lupa',
  pencil: 'Lápiz',
  palette: 'Paleta',
  music: 'Música',
  camera: 'Cámara',
  microphone: 'Micrófono',
  trophy: 'Trofeo',
  medal: 'Medalla',
  puzzle: 'Rompecabezas',
  gear: 'Engranaje',
  chart: 'Gráfica',
  calculator: 'Calculadora',
  atom: 'Átomo',
  dna: 'ADN',
  plant: 'Planta',
  mountain: 'Montaña',
  sun: 'Sol',
};

export function contentIcon(name: string): readonly string[] {
  return Object.entries(CONTENT_ICONS).find(([key]) => key === name)?.[1] ?? CONTENT_ICONS.idea;
}
