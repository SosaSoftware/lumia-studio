import type { StudioClaims } from '../auth/index.ts';
import type { Database } from '../infrastructure/db/index.ts';
import { AppError } from '../shared/errors/index.ts';
import type { ObjectStorage } from '../infrastructure/storage/index.ts';
import { ADVANCING_BUTTON_ACTIONS, BUTTON_COMPONENT, DEFAULT_SLIDE_START_MODE, DEFAULT_SLIDE_UNLOCK, DEFAULT_SLIDE_BACKGROUND, START_BUTTON_ACTION, DEFAULT_SLIDE_DURATION_S, SLIDE_HEIGHT, SLIDE_WIDTH, THEME_COLOR_KEYS, componentCatalog } from '@lumia/packages/catalog';
import type { ComponentCatalog } from '@lumia/packages/catalog';
import type { DeletedResultDto, ElementDto, SlideDto } from '../domain/dto.ts';
import { NEXT_UNLOCKS, ENTRANCES, EXITS, START_MODES, TRANSITIONS, inRange, oneOf } from '../domain/enums.ts';
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
  title?: string;
  background?: string;
  durationS?: number;
  transition?: string;
  unlock?: string;
  startMode?: string;
  /** Start button of the slide; an empty text clears it. */
  startElementId?: string;
  /** Custom button of the slide; an empty text clears it. */
  unlockElementId?: string;
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
  exit?: string;
  disappearsAtS?: number;
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
  exit?: string;
  disappearsAtS?: number;
  props: unknown;
}

export interface DraftSlide {
  title: string;
  background?: string;
  durationS?: number;
  transition?: string;
  unlock?: string;
  startMode?: string;
  elements: DraftElement[];
}

const MAX_REPORTED_ISSUES = 10;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Exit of an element: without an exit the element stays until the slide ends, so it has no second to leave; with one, it
 * leaves after it appears.
 */
function exitOf(value: string, disappearsAtS: number | null, appearsAtS: number, label: string): { exit: string; disappearsAtS: number | null } {
  const exit = oneOf('exit', value, EXITS);
  if (exit === 'none') return { exit, disappearsAtS: null };
  if (disappearsAtS === null || !Number.isFinite(disappearsAtS) || disappearsAtS <= appearsAtS) {
    throw AppError.validation(`${label}, disappearsAtS: debe ser mayor que el segundo en que aparece (${String(appearsAtS)}).`);
  }
  return { exit, disappearsAtS };
}

/** Id of a referenced button: an empty text clears the reference. */
function buttonReference(field: string, value: string): string | null {
  if (value.trim() === '') return null;
  if (!UUID.test(value)) throw AppError.validation(`${field}: no es un identificador válido.`);
  return value;
}

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
        await this.requireButtons(repos, id, changes);
      } else {
        const existing = await repos.slides.find(id);
        if (existing?.versionId !== request.versionId) {
          throw AppError.notFound('La diapositiva no existe en esta versión.');
        }
        await this.requireButtons(repos, id, changes);
        await repos.slides.update(id, changes);
        if (request.position !== undefined) {
          await this.move(repos, request.versionId, id, request.position);
        }
      }
      await this.pinStartButton(repos, id);
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
    // The start button of the slide cannot appear later than its start.
    if (request.id !== undefined && (await this.isStartButton(request.slideId, request.id, props))) values.appearsAtS = 0;
    const exit = exitOf(request.exit ?? existing?.exit ?? 'none', request.disappearsAtS ?? existing?.disappearsAtS ?? null, values.appearsAtS, 'Elemento');
    const validProps = this.validator.validate({ ...values, props: candidateProps }, 'Elemento');
    await this.requireMedia(this.catalog.mediaIds(request.component, validProps), owner.categoryId);
    const elementId = await this.inTransaction(async (repos) => {
      await repos.locator.lockDraft(owner.versionId);
      const record: ElementValues = {
        ...values,
        z: request.z ?? existing?.z ?? (await repos.elements.nextZ(request.slideId)),
        entrance,
        ...exit,
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
      const background = slide.background ?? DEFAULT_SLIDE_BACKGROUND;
      if (!THEME_COLOR_KEYS.some((key) => key === background)) {
        issues.push(`${slideLabel}, background: debe ser una llave de color del tema.`);
      }
      const transition = slide.transition ?? 'none';
      if (!TRANSITIONS.some((key) => key === transition)) {
        issues.push(`${slideLabel}, transition: debe ser una de ${TRANSITIONS.join(', ')}.`);
      }
      const unlock = slide.unlock ?? DEFAULT_SLIDE_UNLOCK;
      if (!NEXT_UNLOCKS.some((key) => key === unlock)) {
        issues.push(`${slideLabel}, unlock: debe ser uno de ${NEXT_UNLOCKS.join(', ')}.`);
      }
      const startMode = slide.startMode ?? DEFAULT_SLIDE_START_MODE;
      if (!START_MODES.some((key) => key === startMode)) {
        issues.push(`${slideLabel}, startMode: debe ser uno de ${START_MODES.join(', ')}.`);
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
            ...exitOf(element.exit ?? 'none', element.disappearsAtS ?? null, element.appearsAtS, `${slideLabel}, elemento ${String(elementIndex + 1)}`),
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
          title: slide.title,
          background,
          durationS: slide.durationS ?? DEFAULT_SLIDE_DURATION_S,
          transition,
          unlock,
          startMode,
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
    if (request.unlock !== undefined) {
      changes.unlock = oneOf('unlock', request.unlock, NEXT_UNLOCKS);
    }
    if (request.startMode !== undefined) {
      changes.startMode = oneOf('startMode', request.startMode, START_MODES);
    }
    if (request.startElementId !== undefined) {
      changes.startElementId = buttonReference('startElementId', request.startElementId);
    }
    if (request.unlockElementId !== undefined) {
      changes.unlockElementId = buttonReference('unlockElementId', request.unlockElementId);
    }
    return changes;
  }

  /**
   * Checks the buttons a slide starts to refer to: the start button must start the slide, and the custom button must
   * move on. Both must be buttons of the same slide. A reference that does not change is not checked again, so a save
   * of the whole slide keeps working after the button changes its action; the player then ignores that button.
   */
  private async requireButtons(repos: RepositorySet, slideId: string, changes: SlideChanges): Promise<void> {
    const current = await repos.slides.behavior(slideId);
    if (typeof changes.startElementId === 'string' && changes.startElementId !== current.startElementId) {
      await this.requireButton(repos, slideId, changes.startElementId, 'startElementId', [START_BUTTON_ACTION]);
    }
    if (typeof changes.unlockElementId === 'string' && changes.unlockElementId !== current.unlockElementId) {
      await this.requireButton(repos, slideId, changes.unlockElementId, 'unlockElementId', ADVANCING_BUTTON_ACTIONS);
    }
  }

  /** The start button of a slide that starts with a button appears at second 0: the slide starts with it. */
  private async pinStartButton(repos: RepositorySet, slideId: string): Promise<void> {
    const behavior = await repos.slides.behavior(slideId);
    if (behavior.unlock !== 'after_time' || behavior.startMode !== 'button' || behavior.startElementId === null) return;
    if ((await repos.elements.propsOf(behavior.startElementId)).action === START_BUTTON_ACTION) {
      await repos.elements.moveToStart(behavior.startElementId);
    }
  }

  /** Whether the element is the start button its slide uses now, so it stays at second 0. */
  private async isStartButton(slideId: string, elementId: string, props: Record<string, unknown>): Promise<boolean> {
    if (props.action !== START_BUTTON_ACTION) return false;
    const behavior = await this.repos.slides.behavior(slideId);
    return behavior.unlock === 'after_time' && behavior.startMode === 'button' && behavior.startElementId === elementId;
  }

  private async requireButton(repos: RepositorySet, slideId: string, elementId: string, field: string, actions: readonly string[]): Promise<void> {
    const element = await repos.elements.find(elementId);
    if (element?.slideId !== slideId || element.component !== BUTTON_COMPONENT) {
      throw AppError.validation(`${field}: debe ser un botón de esta diapositiva.`);
    }
    const action = (await repos.elements.propsOf(elementId)).action;
    if (typeof action !== 'string' || !actions.includes(action)) {
      throw AppError.validation(`${field}: el botón debe tener la acción ${actions.join(' o ')}.`);
    }
  }

  private async createSlide(repos: RepositorySet, request: SaveSlideRequest, changes: SlideChanges): Promise<string> {
    const total = (await repos.slides.orderedIds(request.versionId)).length;
    const position = Math.min(Math.max(request.position ?? total + 1, 1), total + 1);
    await repos.slides.openGap(request.versionId, position - 1, 1);
    return repos.slides.insert({
      versionId: request.versionId,
      position,
      title: changes.title ?? '',
      background: changes.background ?? DEFAULT_SLIDE_BACKGROUND,
      durationS: changes.durationS ?? DEFAULT_SLIDE_DURATION_S,
      transition: changes.transition ?? 'none',
      unlock: changes.unlock ?? DEFAULT_SLIDE_UNLOCK,
      startMode: changes.startMode ?? DEFAULT_SLIDE_START_MODE,
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
