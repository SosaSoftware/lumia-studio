import { AppError } from '../shared/errors/index.ts';
import type { ComponentCatalog, Geometry } from '@lumia/packages/catalog';

export interface ElementToValidate extends Geometry {
  component: string;
  props: unknown;
  appearsAtS: number;
}

/** Validates elements against the component catalog; every failure is a `ValidationError` that names the field. */
export class ElementValidator {
  public constructor(private readonly catalog: ComponentCatalog) {}

  /**
   * Returns the props parsed by the component schema.
   * @param label Where the element is, e.g. `Diapositiva 2, elemento 1`.
   */
  public validate(candidate: ElementToValidate, label: string): Record<string, unknown> {
    const issues: string[] = [];
    if (candidate.appearsAtS < 0 || !Number.isFinite(candidate.appearsAtS)) {
      issues.push('appearsAtS: debe ser mayor o igual a 0.');
    }
    const result = this.catalog.validateElement({
      component: candidate.component,
      props: candidate.props,
      geometry: { x: candidate.x, y: candidate.y, w: candidate.w, h: candidate.h },
    });
    if (!result.ok) {
      issues.push(...result.errors.map((error) => `${error.path}: ${error.message}`));
    }
    if (issues.length > 0 || !result.ok) {
      throw AppError.validation(`${label} (${candidate.component}): ${issues.join(' ')}`);
    }
    return result.props;
  }
}
