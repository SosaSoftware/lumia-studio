import type { StudioClaims } from '../auth/index.ts';
import type { Database } from '../infrastructure/db/index.ts';
import { AppError } from '../shared/errors/index.ts';
import type { ObjectStorage } from '../infrastructure/storage/index.ts';
import { SLIDE_HEIGHT, SLIDE_WIDTH, THEME_COLOR_KEYS, componentCatalog, findSlideType, SLIDE_TYPE_KEYS } from '@lumia/packages/catalog';
import type { ComponentCatalog } from '@lumia/packages/catalog';
import type { DeletedResultDto, ElementDto, SlideDto } from '../domain/dto.ts';
import { ADVANCE_MODES, ENTRANCES, TRANSITIONS, inRange, oneOf } from '../domain/enums.ts';
import type { ElementValues } from '../repositories/element-repository.ts';
import type { RepositorySet } from '../repositories/repository-set.ts';
import type { NewSlide, SlideChanges } from '../repositories/slide-repository.ts';
import { VersionLocator } from '../repositories/version-locator.ts';
import { ElementValidator } from './element-validator.ts';
import { StudioService } from './studio-service.ts';

export interface SaveSlideRequest {
  id?: string;
  versionId: string;
  position?: number;
  type?: string;
  title?: string;
  background?: string;
  durationS?: number;
  transition?: string;
  advance?: string;
}

export interface SaveElementRequest {
  id?: string;
  slideId: string;
  component: string;
  name?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  z?: number;
  appearsAtS?: number;
  entrance?: string;
  props: unknown;
  mediaId?: string;
}

export interface DraftElement {
  component: string;
  name?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  appearsAtS: number;
  entrance?: string;
  props: unknown;
}

export interface DraftSlide {
  type: string;
  title: string;
  background?: string;
  durationS?: number;
  elements: DraftElement[];
}

const MAX_REPORTED_ISSUES = 10;

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw AppError.validation(`${field}: debe ser un objeto.`);
  }
  return Object.fromEntries(Object.entries(value));
}

/** Slides and elements of the draft version. */
export class SlideService extends StudioService {
  private readonly validator: ElementValidator;

  public constructor(
    db: Database,
    storage: ObjectStorage,
    private readonly catalog: ComponentCatalog = componentCatalog,
  ) {
    super(db, storage);
    this.validator = new ElementValidator(catalog);
  }

  public async saveSlide(claims: StudioClaims, request: SaveSlideRequest): Promise<SlideDto> {
    const owner = VersionLocator.requireDraft(await this.repos.locator.ofVersion(request.versionId));
    const changes = this.slideChanges(request);
    const slideId = await this.inTransaction(async (repos) => {
      await repos.locator.lockDraft(owner.versionId);
      let id = request.id;
      if (id === undefined) {
        id = await this.createSlide(repos, request, changes);
      } else {
        const existing = await repos.slides.find(id);
        if (existing?.versionId !== request.versionId) {
          throw AppError.notFound('La diapositiva no existe en esta versión.');
        }
        await repos.slides.update(id, changes);
        if (request.position !== undefined) {
          await this.move(repos, request.versionId, id, request.position);
        }
      }
      await repos.documents.touch(owner.documentId, claims.sub);
      return id;
    });
    return this.requireSlide(slideId);
  }

  /** `slideIds` must list every slide of the version exactly once. */
  public async reorderSlides(claims: StudioClaims, versionId: string, slideIds: readonly string[]): Promise<SlideDto[]> {
    const owner = VersionLocator.requireDraft(await this.repos.locator.ofVersion(versionId));
    await this.inTransaction(async (repos) => {
      await repos.locator.lockDraft(owner.versionId);
      const current = await repos.slides.orderedIds(versionId);
      const requested = new Set(slideIds);
      if (requested.size !== slideIds.length || slideIds.length !== current.length || !current.every((id) => requested.has(id))) {
        throw AppError.validation('slideIds: debe incluir cada diapositiva de la versión exactamente una vez.');
      }
      await repos.slides.applyOrder(slideIds);
      await repos.documents.touch(owner.documentId, claims.sub);
    });
    return this.repos.reader.slidesByIds(slideIds);
  }

  public async duplicateSlide(claims: StudioClaims, slideId: string): Promise<SlideDto> {
    const owner = VersionLocator.requireDraft(await this.repos.locator.ofSlide(slideId));
    const newId = await this.inTransaction(async (repos) => {
      await repos.locator.lockDraft(owner.versionId);
      const slide = await repos.slides.find(slideId);
      if (slide === null) {
        throw AppError.notFound('La diapositiva no existe.');
      }
      await repos.slides.openGap(slide.versionId, slide.position, 1);
      const [created] = await repos.copier.copy(slide.versionId, [{ slideId, position: slide.position + 1 }]);
      await repos.documents.touch(owner.documentId, claims.sub);
      if (created === undefined) {
        throw AppError.internal('No se pudo duplicar la diapositiva.');
      }
      return created;
    });
    return this.requireSlide(newId);
  }

  public async deleteSlide(claims: StudioClaims, slideId: string): Promise<DeletedResultDto> {
    const owner = VersionLocator.requireDraft(await this.repos.locator.ofSlide(slideId));
    await this.inTransaction(async (repos) => {
      await repos.locator.lockDraft(owner.versionId);
      const slide = await repos.slides.find(slideId);
      if (slide === null) {
        throw AppError.notFound('La diapositiva no existe.');
      }
      await repos.slides.delete(slideId);
      await repos.slides.openGap(slide.versionId, slide.position, -1);
      await repos.documents.touch(owner.documentId, claims.sub);
    });
    return { id: slideId, deleted: true };
  }

  public async saveElement(claims: StudioClaims, request: SaveElementRequest): Promise<ElementDto> {
    const owner = VersionLocator.requireDraft(await this.repos.locator.ofSlide(request.slideId));
    const definition = this.catalog.get(request.component);
    if (definition === undefined) {
      throw AppError.validation(`component: el componente "${request.component}" no existe en el catálogo.`);
    }
    const existing = request.id === undefined ? null : await this.repos.elements.find(request.id);
    if (request.id !== undefined && existing?.slideId !== request.slideId) {
      throw AppError.notFound('El elemento no existe en esta diapositiva.');
    }
    const width = request.w ?? existing?.w ?? definition.defaultSize.w;
    const height = request.h ?? existing?.h ?? definition.defaultSize.h;
    const props = asRecord(request.props, 'props');
    // Only components with one medium keep it in `props.mediaId`; a gallery keeps one per item.
    const singleMedia = this.catalog.hasMediaField(request.component);
    const mediaId = singleMedia ? (request.mediaId ?? (typeof props.mediaId === 'string' ? props.mediaId : null)) : null;
    const candidateProps = singleMedia ? { ...props, mediaId } : props;
    const entrance = oneOf('entrance', request.entrance ?? existing?.entrance ?? 'none', ENTRANCES);
    const values = {
      component: request.component,
      name: request.name ?? existing?.name ?? definition.name,
      x: request.x ?? existing?.x ?? Math.max(0, (SLIDE_WIDTH - width) / 2),
      y: request.y ?? existing?.y ?? Math.max(0, (SLIDE_HEIGHT - height) / 2),
      w: width,
      h: height,
      appearsAtS: request.appearsAtS ?? existing?.appearsAtS ?? 0,
    };
    const validProps = this.validator.validate({ ...values, props: candidateProps }, 'Elemento');
    await this.requireMedia(this.catalog.mediaIds(request.component, validProps), owner.categoryId);
    const elementId = await this.inTransaction(async (repos) => {
      await repos.locator.lockDraft(owner.versionId);
      const record: ElementValues = {
        ...values,
        z: request.z ?? existing?.z ?? (await repos.elements.nextZ(request.slideId)),
        entrance,
        props: validProps,
        mediaId,
      };
      let id = request.id;
      if (id === undefined) {
        id = await repos.elements.insert(request.slideId, record);
      } else {
        await repos.elements.update(id, record);
      }
      await repos.documents.touch(owner.documentId, claims.sub);
      return id;
    });
    return this.requireElement(elementId);
  }

  public async deleteElement(claims: StudioClaims, elementId: string): Promise<DeletedResultDto> {
    const owner = VersionLocator.requireDraft(await this.repos.locator.ofChild('slide_element', elementId));
    await this.inTransaction(async (repos) => {
      await repos.locator.lockDraft(owner.versionId);
      await repos.elements.delete(elementId);
      await repos.documents.touch(owner.documentId, claims.sub);
    });
    return { id: elementId, deleted: true };
  }

  /**
   * Inserts an accepted draft after `afterPosition` (at the end when undefined) in one transaction.
   * Every element is validated before anything is written.
   */
  public async applySlidesDraft(
    claims: StudioClaims,
    versionId: string,
    afterPosition: number | undefined,
    slides: readonly DraftSlide[],
  ): Promise<SlideDto[]> {
    const owner = VersionLocator.requireDraft(await this.repos.locator.ofVersion(versionId));
    const prepared = await this.prepareDraft(slides, owner.categoryId);
    const slideIds = await this.inTransaction(async (repos) => {
      await repos.locator.lockDraft(owner.versionId);
      const total = (await repos.slides.orderedIds(versionId)).length;
      const after = Math.min(Math.max(afterPosition ?? total, 0), total);
      await repos.slides.openGap(versionId, after, prepared.length);
      const ids: string[] = [];
      for (const [index, slide] of prepared.entries()) {
        const slideId = await repos.slides.insert({ versionId, position: after + 1 + index, ...slide.values });
        ids.push(slideId);
        for (const element of slide.elements) {
          await repos.elements.insert(slideId, element);
        }
      }
      await repos.documents.touch(owner.documentId, claims.sub);
      return ids;
    });
    return this.repos.reader.slidesByIds(slideIds);
  }

  private async prepareDraft(slides: readonly DraftSlide[], categoryId: string): Promise<
    { values: Omit<NewSlide, 'versionId' | 'position'>; elements: ElementValues[] }[]
  > {
    const issues: string[] = [];
    const mediaIds = new Set<string>();
    const prepared = slides.map((slide, slideIndex) => {
      const slideLabel = `Diapositiva ${String(slideIndex + 1)}`;
      const type = findSlideType(slide.type);
      if (type === undefined) {
        issues.push(`${slideLabel}, type: el tipo "${slide.type}" no existe.`);
      }
      const background = slide.background ?? type?.defaultBackground ?? 'surface';
      if (!THEME_COLOR_KEYS.some((key) => key === background)) {
        issues.push(`${slideLabel}, background: debe ser una llave de color del tema.`);
      }
      const elements = slide.elements.flatMap((element, elementIndex): ElementValues[] => {
        try {
          const definition = this.catalog.get(element.component);
          const props = this.validator.validate({ ...element, props: element.props }, `${slideLabel}, elemento ${String(elementIndex + 1)}`);
          for (const id of this.catalog.mediaIds(element.component, props)) {
            mediaIds.add(id);
          }
          const mediaId = this.catalog.hasMediaField(element.component) && typeof props.mediaId === 'string' ? props.mediaId : null;
          return [{
            component: element.component,
            name: element.name ?? definition?.name ?? element.component,
            x: element.x, y: element.y, w: element.w, h: element.h, z: element.z,
            appearsAtS: element.appearsAtS,
            entrance: oneOf('entrance', element.entrance ?? 'none', ENTRANCES),
            props,
            mediaId,
          }];
        } catch (error) {
          if (error instanceof AppError && error.errorType === 'ValidationError') {
            issues.push(error.message);
            return [];
          }
          throw error;
        }
      });
      return {
        values: {
          type: slide.type,
          title: slide.title,
          background,
          durationS: slide.durationS ?? type?.defaultDurationS ?? 10,
          transition: 'none',
          advance: type?.defaultAdvance ?? 'click',
        },
        elements,
      };
    });
    if (issues.length > 0) {
      throw AppError.validation(issues.slice(0, MAX_REPORTED_ISSUES).join(' | '));
    }
    await this.requireMedia([...mediaIds], categoryId);
    return prepared;
  }

  private slideChanges(request: SaveSlideRequest): SlideChanges {
    const changes: SlideChanges = {};
    if (request.type !== undefined) {
      changes.type = oneOf('type', request.type, SLIDE_TYPE_KEYS);
    }
    if (request.title !== undefined) {
      changes.title = request.title;
    }
    if (request.background !== undefined) {
      changes.background = oneOf('background', request.background, THEME_COLOR_KEYS);
    }
    if (request.durationS !== undefined) {
      changes.durationS = inRange('durationS', request.durationS, 0);
    }
    if (request.transition !== undefined) {
      changes.transition = oneOf('transition', request.transition, TRANSITIONS);
    }
    if (request.advance !== undefined) {
      changes.advance = oneOf('advance', request.advance, ADVANCE_MODES);
    }
    return changes;
  }

  private async createSlide(repos: RepositorySet, request: SaveSlideRequest, changes: SlideChanges): Promise<string> {
    if (changes.type === undefined) {
      throw AppError.validation('type: es obligatorio al crear una diapositiva.');
    }
    const definition = findSlideType(changes.type);
    const total = (await repos.slides.orderedIds(request.versionId)).length;
    const position = Math.min(Math.max(request.position ?? total + 1, 1), total + 1);
    await repos.slides.openGap(request.versionId, position - 1, 1);
    return repos.slides.insert({
      versionId: request.versionId,
      position,
      type: changes.type,
      title: changes.title ?? '',
      background: changes.background ?? definition?.defaultBackground ?? 'surface',
      durationS: changes.durationS ?? definition?.defaultDurationS ?? 10,
      transition: changes.transition ?? 'none',
      advance: changes.advance ?? definition?.defaultAdvance ?? 'click',
    });
  }

  private async move(repos: RepositorySet, versionId: string, slideId: string, position: number): Promise<void> {
    const ids = (await repos.slides.orderedIds(versionId)).filter((id) => id !== slideId);
    const index = Math.min(Math.max(position, 1), ids.length + 1) - 1;
    ids.splice(index, 0, slideId);
    await repos.slides.applyOrder(ids);
  }

  private async requireMedia(ids: readonly string[], categoryId: string): Promise<void> {
    const missing = await this.repos.media.missing(ids, categoryId);
    if (missing.length > 0) {
      throw AppError.validation(`mediaId: el medio ${missing.join(', ')} no existe en la biblioteca de esta categoría.`);
    }
  }

  private async requireSlide(slideId: string): Promise<SlideDto> {
    const slide = await this.repos.reader.slide(slideId);
    if (slide === null) {
      throw AppError.notFound('La diapositiva no existe.');
    }
    return slide;
  }

  private async requireElement(elementId: string): Promise<ElementDto> {
    const element = await this.repos.reader.element(elementId);
    if (element === null) {
      throw AppError.notFound('El elemento no existe.');
    }
    return element;
  }
}
