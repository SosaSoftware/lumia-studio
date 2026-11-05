/** Slide size in container query units (`cqw`): the slide is 100 units wide with a 16:9 ratio. */
export const SLIDE_WIDTH = 100;
export const SLIDE_HEIGHT = 56.25;

export interface Geometry {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}

/** Returns Spanish messages for every bound the geometry breaks; an empty list means it is valid. */
export function geometryErrors(geometry: Geometry): string[] {
  const errors: string[] = [];
  const { x, y, w, h } = geometry;
  if (![x, y, w, h].every((value) => Number.isFinite(value))) {
    return ['La posición y el tamaño deben ser números.'];
  }
  if (w <= 0 || h <= 0) errors.push('El ancho y el alto deben ser mayores que cero.');
  if (x < 0 || y < 0) errors.push('La posición no puede ser negativa.');
  if (x + w > SLIDE_WIDTH + 0.01) errors.push(`El elemento sale de la diapositiva por la derecha (máximo ${String(SLIDE_WIDTH)}).`);
  if (y + h > SLIDE_HEIGHT + 0.01) errors.push(`El elemento sale de la diapositiva por abajo (máximo ${String(SLIDE_HEIGHT)}).`);
  return errors;
}

export function overlaps(a: Geometry, b: Geometry): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
