import { reactive } from 'vue';
import { slideLayoutEngine } from '@lumia/packages/catalog';
import type { SlideTypeKey } from '@lumia/packages/catalog';
import { ApiError } from '../../api/graphql-client.ts';
import type { StudioApi } from '../../api/studio-api.ts';
import type {
  AudioClip,
  ClassDocument,
  DraftElementInput,
  ElementPatch,
  MediaAsset,
  MediaRef,
  NarrationClip,
  Pause,
  Slide,
  SlideElement,
  SlidePatch,
  TreeNode,
} from '../../api/types.ts';
import { canvasMargins } from '../../composables/canvas-margins.ts';
import { nextStart, narrationDuration } from '../timeline/timeline-model.ts';
import type { CatalogStore } from './catalog-store.ts';
import type { Geometry } from './geometry.ts';
import { clampGeometry, findFreeSpot, fitInsideMargins } from './geometry.ts';
import { SaveScheduler } from './save-scheduler.ts';

/** Difference in `cqw` from which the height of a component that fits its content is saved again. */
const FIT_EPSILON = 0.05;
/** Difference from which the height of another component grows; the content height is read in whole pixels. */
const GROW_EPSILON = 0.15;

export type DocumentApi = Pick<
  StudioApi,
  | 'document'
  | 'createDocument'
  | 'createVersion'
  | 'publishVersion'
  | 'saveSlide'
  | 'reorderSlides'
  | 'duplicateSlide'
  | 'deleteSlide'
  | 'saveElement'
  | 'deleteElement'
  | 'applySlidesDraft'
  | 'savePause'
  | 'deletePause'
  | 'saveAudio'
  | 'deleteAudio'
  | 'saveNarration'
  | 'deleteNarration'
  | 'generateNarrationFor'
  | 'saveComment'
  | 'deleteComment'
>;

/** What is selected in the timeline besides elements: the slide transition or one clip. */
export type ClipSelection = { kind: 'transition' } | { kind: 'narration' | 'audio' | 'pause'; id: string };

export interface PausePatch {
  startsAtS?: number;
  durationS?: number;
  message?: string;
  onEnd?: Pause['onEnd'];
  timerElementId?: string | null;
}

export interface AudioPatch {
  startsAtS?: number;
  durationS?: number;
  name?: string;
  kind?: AudioClip['kind'];
  volume?: number;
  mediaId?: string;
  media?: MediaRef | null;
}

export interface NarrationPatch {
  script?: string;
  voice?: string;
  speed?: number;
  startsAtS?: number;
}

export interface SessionState {
  /** Class node of the tree being edited. */
  classNode: TreeNode | null;
  document: ClassDocument | null;
  slides: Slide[];
  selectedSlideId: string | null;
  selectedElementId: string | null;
  selectedClip: ClipSelection | null;
  loading: boolean;
  /** Error that stops the class from loading. */
  loadError: string | null;
  /** Message of the last failed save that has no field to show it on. */
  saveError: string | null;
  /** Short message in the top bar, e.g. that a new version was created. */
  notice: string | null;
  /** Saves waiting or in flight. */
  pending: number;
  /** API validation errors by element id and field path (`props.text`, `geometry`). */
  fieldErrors: Record<string, Record<string, string>>;
  /** Errors of the slide properties by slide id. */
  slideErrors: Record<string, string>;
}

/** Maps ids from before a new version was created to the ids of the copy. */
export class IdRemap {
  public constructor(
    private readonly slides: ReadonlyMap<string, string>,
    private readonly elements: ReadonlyMap<string, string>,
    private readonly children: ReadonlyMap<string, string> = new Map(),
  ) {}

  public slide(id: string): string {
    return this.slides.get(id) ?? id;
  }

  public element(id: string): string {
    return this.elements.get(id) ?? id;
  }

  /** Narration clips, audio clips, pauses and comments. */
  public child(id: string): string {
    return this.children.get(id) ?? id;
  }
}

const NOTICE_MS = 8000;
const SAVE_DEBOUNCE_MS = 400;

/** Copy of a record without one key. */
function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'No se pudo guardar el cambio.';
}

/**
 * The class being edited: its document, slides and selection, with debounced saves.
 * Editing a published version first creates the next draft; editing a class without content first creates its document.
 */
export class DocumentSession {
  public readonly state: SessionState = reactive<SessionState>({
    classNode: null,
    document: null,
    slides: [],
    selectedSlideId: null,
    selectedElementId: null,
    selectedClip: null,
    loading: false,
    loadError: null,
    saveError: null,
    notice: null,
    pending: 0,
    fieldErrors: {},
    slideErrors: {},
  });

  private readonly scheduler: SaveScheduler;
  private preparing: Promise<IdRemap> | null = null;
  private noticeTimer: ReturnType<typeof setTimeout> | undefined;
  private opening = 0;
  /** Height each element needs for its content, as the canvas measured it. */
  private readonly measured = new Map<string, number>();
  /** Elements the person edited since the class was opened: only those get their measured height saved. */
  private readonly touched = new Set<string>();
  /** Slide ids of the published version mapped to their copy in the draft, for moves queued before the draft existed. */
  private readonly slideAliases = new Map<string, string>();
  /** Order of the slides the person asked for last, until the API has stored it. */
  private desiredOrder: readonly string[] | null = null;
  /** Structural actions run one after another, so quick clicks reach the API in order. */
  private chain: Promise<void> = Promise.resolve();
  private running = 0;

  public constructor(
    private readonly api: DocumentApi,
    private readonly catalog: CatalogStore,
    private readonly onChanged: () => void = () => undefined,
    debounceMs: number = SAVE_DEBOUNCE_MS,
  ) {
    this.scheduler = new SaveScheduler(debounceMs, () => {
      this.syncPending();
    });
  }

  // -- Reading --------------------------------------------------------------

  public get currentSlide(): Slide | null {
    return this.state.slides.find((slide) => slide.id === this.state.selectedSlideId) ?? null;
  }

  public get selectedElement(): SlideElement | null {
    const slide = this.currentSlide;
    return slide?.elements.find((element) => element.id === this.state.selectedElementId) ?? null;
  }

  public get selectedNarration(): NarrationClip | null {
    const selection = this.state.selectedClip;
    if (selection?.kind !== 'narration') return null;
    return this.currentSlide?.narrationClips.find((clip) => clip.id === selection.id) ?? null;
  }

  public get selectedAudio(): AudioClip | null {
    const selection = this.state.selectedClip;
    if (selection?.kind !== 'audio') return null;
    return this.currentSlide?.audioClips.find((clip) => clip.id === selection.id) ?? null;
  }

  public get selectedPause(): Pause | null {
    const selection = this.state.selectedClip;
    if (selection?.kind !== 'pause') return null;
    return this.currentSlide?.pauses.find((pause) => pause.id === selection.id) ?? null;
  }

  public get versionId(): string | null {
    return this.state.document?.editingVersion.id ?? null;
  }

  public get versionNumber(): number | null {
    return this.state.document?.editingVersion.number ?? null;
  }

  /** Whether a first edit has to create the document or the next draft before it applies. */
  public get needsPreparation(): boolean {
    const document = this.state.document;
    return this.state.classNode !== null && (document === null || document.editingVersion.status === 'published');
  }

  // -- Opening --------------------------------------------------------------

  /** Opens a class; pending saves of the previous one are flushed first. */
  public async open(node: TreeNode): Promise<void> {
    await this.flush();
    const ticket = ++this.opening;
    this.touched.clear();
    this.slideAliases.clear();
    this.desiredOrder = null;
    this.state.classNode = node;
    this.state.document = null;
    this.state.slides = [];
    this.state.selectedSlideId = null;
    this.state.selectedElementId = null;
    this.state.selectedClip = null;
    this.state.loading = true;
    this.state.loadError = null;
    this.state.fieldErrors = {};
    this.state.slideErrors = {};
    this.state.saveError = null;
    try {
      const document = await this.api.document(node.id);
      if (ticket !== this.opening) return;
      this.apply(document);
      this.state.selectedSlideId = this.state.slides[0]?.id ?? null;
    } catch (error) {
      if (ticket === this.opening) this.state.loadError = errorMessage(error);
    } finally {
      if (ticket === this.opening) this.state.loading = false;
    }
  }

  /** Closes the open class. */
  public async close(): Promise<void> {
    await this.flush();
    this.opening += 1;
    this.state.classNode = null;
    this.state.document = null;
    this.state.slides = [];
    this.state.selectedSlideId = null;
    this.state.selectedElementId = null;
    this.state.selectedClip = null;
    this.state.loading = false;
  }

  /** Re-queries the document and keeps the selection when its ids still exist. */
  public async reload(): Promise<void> {
    const node = this.state.classNode;
    if (node === null) return;
    const document = await this.api.document(node.id);
    this.apply(document);
    this.fixSelection();
  }

  private apply(document: ClassDocument | null): void {
    this.state.document = document;
    this.state.slides = document?.editingVersion.slides ?? [];
  }

  private fixSelection(): void {
    const slides = this.state.slides;
    if (!slides.some((slide) => slide.id === this.state.selectedSlideId)) {
      this.state.selectedSlideId = slides[0]?.id ?? null;
      this.state.selectedElementId = null;
      this.state.selectedClip = null;
    }
    if (this.selectedElement === null) this.state.selectedElementId = null;
    const clip = this.state.selectedClip;
    if (clip !== null && clip.kind !== 'transition' && this.selectedNarration === null && this.selectedAudio === null && this.selectedPause === null) {
      this.state.selectedClip = null;
    }
  }

  // -- Selection ------------------------------------------------------------

  public selectSlide(id: string | null): void {
    if (id !== this.state.selectedSlideId) {
      this.state.selectedElementId = null;
      this.state.selectedClip = null;
    }
    this.state.selectedSlideId = id;
  }

  public selectElement(id: string | null): void {
    this.state.selectedElementId = id;
    if (id !== null) this.state.selectedClip = null;
  }

  /** Selects the transition or a clip of the current slide; null clears it. */
  public selectClip(selection: ClipSelection | null): void {
    this.state.selectedClip = selection;
    if (selection !== null) this.state.selectedElementId = null;
  }

  // -- Preparation (document and draft) -------------------------------------

  /** Creates the document or the next draft when needed, then returns the id mapping to apply to queued edits. */
  public prepare(): Promise<IdRemap> {
    this.preparing ??= this.doPrepare().finally(() => {
      this.preparing = null;
    });
    return this.preparing;
  }

  private async doPrepare(): Promise<IdRemap> {
    await this.flush();
    const node = this.state.classNode;
    const document = this.state.document;
    if (node === null) throw new ApiError('Conflict', 'No hay una clase abierta.');
    if (document === null) {
      this.apply(await this.api.createDocument(node.id));
      this.fixSelection();
      this.onChanged();
      return new IdRemap(new Map(), new Map());
    }
    if (document.editingVersion.status !== 'published') return new IdRemap(new Map(), new Map());
    // The copy keeps the stored order, so the slides are paired in that order and not in the order shown after a move.
    const before = [...this.state.slides].sort((a, b) => a.position - b.position);
    const selected = { slide: this.state.selectedSlideId, element: this.state.selectedElementId, clip: this.state.selectedClip };
    await this.api.createVersion(document.id);
    await this.reload();
    const slides = new Map<string, string>();
    const elements = new Map<string, string>();
    const children = new Map<string, string>();
    const pairs = <T extends { id: string }>(from: readonly T[], to: readonly T[] | undefined): void => {
      from.forEach((item, index) => {
        const copy = to?.[index];
        if (copy !== undefined) children.set(item.id, copy.id);
      });
    };
    before.forEach((slide, slideIndex) => {
      const copy = this.state.slides[slideIndex];
      if (copy === undefined) return;
      slides.set(slide.id, copy.id);
      slide.elements.forEach((element, elementIndex) => {
        const elementCopy = copy.elements[elementIndex];
        if (elementCopy !== undefined) elements.set(element.id, elementCopy.id);
      });
      pairs(slide.narrationClips, copy.narrationClips);
      pairs(slide.audioClips, copy.audioClips);
      pairs(slide.pauses, copy.pauses);
      pairs(slide.comments, copy.comments);
    });
    slides.forEach((copy, original) => this.slideAliases.set(original, copy));
    const remap = new IdRemap(slides, elements, children);
    this.state.selectedSlideId = selected.slide === null ? null : remap.slide(selected.slide);
    this.state.selectedElementId = selected.element === null ? null : remap.element(selected.element);
    this.state.selectedClip = selected.clip === null || selected.clip.kind === 'transition' ? selected.clip : { kind: selected.clip.kind, id: remap.child(selected.clip.id) };
    this.fixSelection();
    this.showNotice(`Se creó la versión ${String(this.versionNumber ?? '')} en borrador.`);
    this.onChanged();
    return remap;
  }

  private showNotice(message: string): void {
    this.state.notice = message;
    if (this.noticeTimer !== undefined) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => {
      this.state.notice = null;
    }, NOTICE_MS);
  }

  // -- Slides ---------------------------------------------------------------

  /** Adds a slide of a type after the current one, with the starter elements of its template. */
  public async addSlide(type: SlideTypeKey): Promise<void> {
    await this.run(async () => {
      await this.prepare();
      const versionId = this.requireVersion();
      const definition = this.catalog.slideType(type);
      if (definition === undefined) throw new ApiError('ValidationError', 'type: el tipo de diapositiva no existe.');
      const placed = slideLayoutEngine.place(
        type,
        definition.starterComponents.map((component) => ({ component })),
      );
      const elements = definition.starterComponents.flatMap((component, index): DraftElementInput[] => {
        const info = this.catalog.component(component);
        const place = placed[index];
        if (info === undefined || place === undefined) return [];
        return [{ component, name: info.name, ...place, props: { ...info.defaults } }];
      });
      const after = this.currentSlide?.position ?? null;
      const created = await this.api.applySlidesDraft(versionId, after, [
        { type, title: definition.name, background: definition.defaultBackground, durationS: definition.defaultDurationS, elements },
      ]);
      await this.reload();
      this.selectSlide(created[0]?.id ?? this.state.selectedSlideId);
    });
  }

  public async duplicateSlide(slideId: string): Promise<void> {
    await this.run(async () => {
      const remap = await this.prepare();
      const copy = await this.api.duplicateSlide(remap.slide(slideId));
      await this.reload();
      this.selectSlide(copy.id);
    });
  }

  public async deleteSlide(slideId: string): Promise<void> {
    await this.run(async () => {
      const remap = await this.prepare();
      const id = remap.slide(slideId);
      const index = this.state.slides.findIndex((slide) => slide.id === id);
      this.cancelSlideSaves(id);
      await this.api.deleteSlide(id);
      await this.reload();
      const next = this.state.slides[Math.min(index, this.state.slides.length - 1)];
      this.selectSlide(next?.id ?? null);
      this.onChanged();
    });
  }

  /**
   * Moves a slide to a 0-based index. The new order shows at once, so a second move starts from what the person sees;
   * the API call follows in the queue with the full list of ids, not with an index.
   */
  public async moveSlide(slideId: string, toIndex: number): Promise<void> {
    const ids = this.state.slides.map((slide) => slide.id);
    const from = ids.indexOf(slideId);
    const target = Math.min(Math.max(toIndex, 0), ids.length - 1);
    if (from < 0 || target === from) return;
    ids.splice(from, 1);
    ids.splice(target, 0, slideId);
    this.desiredOrder = ids;
    this.showSlideOrder(ids);
    await this.run(async () => {
      try {
        await this.prepare();
        // Creating the draft reloads the slides in their stored order, so the latest order asked for is shown again.
        this.showSlideOrder(this.currentSlideIds(this.desiredOrder ?? ids));
        const ordered = this.currentSlideIds(ids);
        try {
          await this.api.reorderSlides(this.requireVersion(), ordered);
        } catch (error) {
          if (error instanceof ApiError && error.errorType === 'ValidationError') {
            throw new ApiError('Conflict', 'Las diapositivas cambiaron desde otra pestaña o por Lumi. Se actualizó la lista; vuelve a mover la diapositiva.');
          }
          throw error;
        }
        this.confirmSlideOrder(ordered);
      } finally {
        if (this.desiredOrder === ids) this.desiredOrder = null;
      }
    });
  }

  /** Slide ids as they are now: those of a published version map to their copy in the draft. */
  private currentSlideIds(ids: readonly string[]): string[] {
    return ids.map((id) => this.slideAliases.get(id) ?? id);
  }

  /** Shows the slides in the order of `ids`; the list is left as it is when it does not name the same slides. */
  private showSlideOrder(ids: readonly string[]): void {
    const bySlide = new Map(this.state.slides.map((slide) => [slide.id, slide]));
    const ordered = ids.flatMap((id) => {
      const slide = bySlide.get(id);
      return slide === undefined ? [] : [slide];
    });
    if (ordered.length === this.state.slides.length) this.state.slides = ordered;
  }

  /** Stores the position the API gave to each slide, so the next action reads the right one. */
  private confirmSlideOrder(ids: readonly string[]): void {
    const positions = new Map(ids.map((id, index) => [id, index + 1]));
    for (const slide of this.state.slides) {
      const position = positions.get(slide.id);
      if (position !== undefined) slide.position = position;
    }
  }

  /** Edits slide properties; the change shows now and is saved after the debounce. */
  public updateSlide(slideId: string, patch: SlidePatch): void {
    if (this.needsPreparation) {
      void this.run(async () => {
        const remap = await this.prepare();
        this.applySlidePatch(remap.slide(slideId), patch);
      });
      return;
    }
    this.applySlidePatch(slideId, patch);
  }

  private applySlidePatch(slideId: string, patch: SlidePatch): void {
    const slide = this.state.slides.find((candidate) => candidate.id === slideId);
    if (slide === undefined) return;
    Object.assign(slide, patch);
    this.state.slideErrors = without(this.state.slideErrors, slideId);
    this.scheduler.schedule(`slide:${slideId}`, async () => {
      const latest = this.state.slides.find((candidate) => candidate.id === slideId);
      if (latest === undefined) return;
      try {
        await this.api.saveSlide(slideId, latest.versionId, {
          type: latest.type,
          title: latest.title,
          background: latest.background,
          durationS: latest.durationS,
          transition: latest.transition,
          advance: latest.advance,
        });
      } catch (error) {
        this.state.slideErrors[slideId] = errorMessage(error);
      }
      this.syncPending();
    });
    this.syncPending();
  }

  private cancelSlideSaves(slideId: string): void {
    this.scheduler.cancel(`slide:${slideId}`);
    const slide = this.state.slides.find((candidate) => candidate.id === slideId);
    for (const element of slide?.elements ?? []) this.scheduler.cancel(`element:${element.id}`);
    this.syncPending();
  }

  // -- Elements -------------------------------------------------------------

  /** Adds a catalog component to the current slide (centered, or at a given top-left position). */
  public async addElement(component: string, at?: { x: number; y: number }): Promise<void> {
    await this.run(async () => {
      const info = this.catalog.component(component);
      if (info === undefined) throw new ApiError('ValidationError', 'component: el componente no existe en el catálogo.');
      const remap = await this.prepare();
      const slide = this.currentSlide;
      const size = info.defaultSize;
      if (slide === null) {
        const versionId = this.requireVersion();
        const geometry = clampGeometry({ x: (100 - size.w) / 2, y: 4, ...size });
        const created = await this.api.applySlidesDraft(versionId, null, [
          {
            type: 'explanatory',
            title: 'Diapositiva',
            elements: [{ component, name: info.name, ...geometry, z: 1, appearsAtS: 0, props: { ...info.defaults } }],
          },
        ]);
        await this.reload();
        this.selectSlide(created[0]?.id ?? null);
        this.state.selectedElementId = created[0]?.elements[0]?.id ?? null;
        return;
      }
      const offset = (slide.elements.length % 6) * 2;
      const free = at === undefined ? findFreeSpot(slide.elements, size) : null;
      const origin = at ?? free ?? { x: (100 - size.w) / 2 + offset, y: (56.25 - size.h) / 2 + offset };
      // A new element keeps inside the margins of the canvas, so it does not land against the edge of the slide.
      const geometry = fitInsideMargins(clampGeometry({ ...origin, ...size }), canvasMargins);
      const created = await this.api.saveElement(remap.slide(slide.id), null, component, {
        name: info.name,
        ...geometry,
        props: { ...info.defaults },
      });
      const target = this.state.slides.find((candidate) => candidate.id === created.slideId);
      target?.elements.push(created);
      this.touched.add(created.id);
      this.state.selectedElementId = created.id;
    });
  }

  /** Edits an element; the change shows now and is saved after the debounce. */
  public updateElement(elementId: string, patch: ElementPatch): void {
    if (this.needsPreparation) {
      void this.run(async () => {
        const remap = await this.prepare();
        this.applyElementPatch(remap.element(elementId), patch);
      });
      return;
    }
    this.applyElementPatch(elementId, patch);
  }

  /** Geometry change from a drag or a key press. */
  public updateGeometry(elementId: string, geometry: Geometry): void {
    this.updateElement(elementId, geometry);
  }

  /**
   * The canvas reports the height that an element needs for its content. It is saved only for an element the person
   * edited, so opening a class never changes it.
   */
  public reportHeight(elementId: string, height: number): void {
    this.measured.set(elementId, height);
    if (this.touched.has(elementId)) this.fitHeight(elementId);
  }

  /** Gives an element the height its content needs: always for a component that fits its content, and only when the content outgrows the frame for the others. */
  private fitHeight(elementId: string): void {
    const element = this.findElement(elementId);
    const needed = this.measured.get(elementId);
    if (element === undefined || needed === undefined) return;
    const difference = needed - element.h;
    const fits = this.catalog.fitsContent(element.component) ? Math.abs(difference) > FIT_EPSILON : difference > GROW_EPSILON;
    if (fits) this.applyElementPatch(elementId, { h: needed });
  }

  private findElement(elementId: string): SlideElement | undefined {
    for (const slide of this.state.slides) {
      const element = slide.elements.find((candidate) => candidate.id === elementId);
      if (element !== undefined) return element;
    }
    return undefined;
  }

  private applyElementPatch(elementId: string, patch: ElementPatch): void {
    const element = this.findElement(elementId);
    if (element === undefined) return;
    Object.assign(element, patch);
    this.touched.add(elementId);
    this.fitHeight(elementId);
    this.scheduler.schedule(`element:${elementId}`, async () => {
      const latest = this.findElement(elementId);
      if (latest === undefined) return;
      try {
        const saved = await this.api.saveElement(latest.slideId, latest.id, latest.component, {
          name: latest.name,
          x: latest.x,
          y: latest.y,
          w: latest.w,
          h: latest.h,
          z: latest.z,
          appearsAtS: latest.appearsAtS,
          entrance: latest.entrance,
          props: latest.props,
        });
        this.state.fieldErrors = without(this.state.fieldErrors, elementId);
        this.state.saveError = null;
        // Only the server-side fields are taken, so a newer edit in progress is not overwritten.
        if (!this.scheduler.has(`element:${elementId}`)) latest.media = saved.media;
        latest.mediaId = saved.mediaId;
      } catch (error) {
        if (error instanceof ApiError && Object.keys(error.fields).length > 0) {
          this.state.fieldErrors[elementId] = { ...error.fields };
        } else {
          this.state.fieldErrors[elementId] = { general: errorMessage(error) };
        }
      }
      this.syncPending();
    });
    this.syncPending();
  }

  /** Shows a just-uploaded medium on the element before the save answers. */
  public setElementMedia(elementId: string, media: MediaRef | null): void {
    const element = this.findElement(elementId);
    if (element === undefined) return;
    element.media = media;
    element.mediaId = media?.id ?? null;
  }

  public async deleteElement(elementId: string): Promise<void> {
    await this.run(async () => {
      const remap = await this.prepare();
      const id = remap.element(elementId);
      this.scheduler.cancel(`element:${id}`);
      await this.api.deleteElement(id);
      for (const slide of this.state.slides) {
        slide.elements = slide.elements.filter((element) => element.id !== id);
      }
      this.state.fieldErrors = without(this.state.fieldErrors, id);
      if (this.state.selectedElementId === id) this.state.selectedElementId = null;
      this.syncPending();
    });
  }

  // -- Timeline: pauses, audio and narration --------------------------------

  private requireSlide(id: string): Slide {
    const slide = this.state.slides.find((candidate) => candidate.id === id);
    if (slide === undefined) throw new ApiError('NotFound', 'La diapositiva ya no existe.');
    return slide;
  }

  /** Makes the slide long enough for a clip that ends at `end`. */
  private extendSlide(slide: Slide, end: number): void {
    if (end > slide.durationS) this.updateSlide(slide.id, { durationS: Math.ceil(end + 1) });
  }

  /** Appends a pause to the current slide and selects it. */
  public async addPause(): Promise<void> {
    await this.run(async () => {
      const remap = await this.prepare();
      const current = this.currentSlide;
      if (current === null) return;
      const slide = this.requireSlide(remap.slide(current.id));
      const startsAtS = nextStart(slide.pauses);
      const created = await this.api.savePause(slide.id, null, { startsAtS, durationS: 10, message: 'Nueva pausa', onEnd: 'continue', timerElementId: null });
      slide.pauses.push(created);
      this.extendSlide(slide, startsAtS + created.durationS);
      this.selectClip({ kind: 'pause', id: created.id });
    });
  }

  public updatePause(pauseId: string, patch: PausePatch): void {
    this.patchChild(pauseId, (remapped) => {
      const slide = this.state.slides.find((candidate) => candidate.pauses.some((pause) => pause.id === remapped));
      const pause = slide?.pauses.find((candidate) => candidate.id === remapped);
      if (slide === undefined || pause === undefined) return;
      Object.assign(pause, patch);
      this.scheduleSave(`pause:${remapped}`, async () => {
        const { startsAtS, durationS, message, onEnd, timerElementId } = pause;
        await this.api.savePause(slide.id, pause.id, { startsAtS, durationS, message, onEnd, timerElementId });
      });
    });
  }

  public async deletePause(pauseId: string): Promise<void> {
    await this.run(async () => {
      const remap = await this.prepare();
      const id = remap.child(pauseId);
      this.scheduler.cancel(`pause:${id}`);
      await this.api.deletePause(id);
      for (const slide of this.state.slides) slide.pauses = slide.pauses.filter((pause) => pause.id !== id);
      this.clearClip(id);
    });
  }

  /** Appends an audio clip of an uploaded medium to the current slide and selects it. */
  public async addAudio(media: MediaAsset, durationS: number): Promise<void> {
    await this.run(async () => {
      const remap = await this.prepare();
      const current = this.currentSlide;
      if (current === null) return;
      const slide = this.requireSlide(remap.slide(current.id));
      const startsAtS = slide.audioClips.length === 0 ? 0 : nextStart(slide.audioClips);
      const name = media.name.replace(/\.[a-z0-9]{2,4}$/i, '');
      const created = await this.api.saveAudio(slide.id, null, { mediaId: media.id, startsAtS, durationS, name, kind: 'effect', volume: 0.6 });
      slide.audioClips.push(created);
      this.extendSlide(slide, startsAtS + durationS);
      this.selectClip({ kind: 'audio', id: created.id });
    });
  }

  public updateAudio(audioId: string, patch: AudioPatch): void {
    this.patchChild(audioId, (remapped) => {
      const slide = this.state.slides.find((candidate) => candidate.audioClips.some((clip) => clip.id === remapped));
      const clip = slide?.audioClips.find((candidate) => candidate.id === remapped);
      if (slide === undefined || clip === undefined) return;
      Object.assign(clip, patch);
      this.scheduleSave(`audio:${remapped}`, async () => {
        if (clip.mediaId === null) return;
        const { mediaId, startsAtS, durationS, name, kind, volume } = clip;
        await this.api.saveAudio(slide.id, clip.id, { mediaId, startsAtS, durationS, name, kind, volume });
      });
    });
  }

  public async deleteAudio(audioId: string): Promise<void> {
    await this.run(async () => {
      const remap = await this.prepare();
      const id = remap.child(audioId);
      this.scheduler.cancel(`audio:${id}`);
      await this.api.deleteAudio(id);
      for (const slide of this.state.slides) slide.audioClips = slide.audioClips.filter((clip) => clip.id !== id);
      this.clearClip(id);
    });
  }

  /** Appends a narration clip without script to the current slide and selects it. */
  public async addNarration(): Promise<void> {
    await this.run(async () => {
      const remap = await this.prepare();
      const current = this.currentSlide;
      if (current === null) return;
      const slide = this.requireSlide(remap.slide(current.id));
      const startsAtS = nextStart(slide.narrationClips.map((clip) => ({ startsAtS: clip.startsAtS, durationS: narrationDuration(clip) })));
      // The clip has no voice until the person picks one of the voices that Polly lists.
      const created = await this.api.saveNarration(slide.id, null, { script: '', startsAtS, voice: null, speed: 1 });
      slide.narrationClips.push(created);
      this.extendSlide(slide, startsAtS + narrationDuration(created));
      this.selectClip({ kind: 'narration', id: created.id });
    });
  }

  /** Edits a narration clip; a new script or voice leaves it without voice until it is generated again. */
  public updateNarration(clipId: string, patch: NarrationPatch): void {
    this.patchChild(clipId, (remapped) => {
      const slide = this.state.slides.find((candidate) => candidate.narrationClips.some((clip) => clip.id === remapped));
      const clip = slide?.narrationClips.find((candidate) => candidate.id === remapped);
      if (slide === undefined || clip === undefined) return;
      const voiceChanged = (patch.script !== undefined && patch.script !== clip.script) || (patch.voice !== undefined && patch.voice !== clip.voice);
      Object.assign(clip, patch);
      if (voiceChanged && clip.status !== 'generating') {
        clip.status = 'pending';
        clip.audioUrl = null;
        clip.generatedDurationS = 0;
        clip.errorMessage = null;
      }
      const key = `narration:${remapped}`;
      this.scheduleSave(key, async () => {
        const { script, startsAtS, voice, speed } = clip;
        const saved = await this.api.saveNarration(slide.id, clip.id, { script, startsAtS, voice, speed });
        if (!this.scheduler.has(key)) Object.assign(clip, { status: saved.status, audioUrl: saved.audioUrl, generatedDurationS: saved.generatedDurationS, errorMessage: saved.errorMessage });
      });
    });
  }

  /** Generates the voice of a clip with its current script, voice and speed. */
  public async generateNarration(clipId: string): Promise<void> {
    await this.run(async () => {
      const remap = await this.prepare();
      const id = remap.child(clipId);
      await this.flush();
      const clip = this.state.slides.flatMap((slide) => slide.narrationClips).find((candidate) => candidate.id === id);
      if (clip === undefined) return;
      if (clip.script.trim() === '') throw new ApiError('ValidationError', 'Escribe lo que dirá la voz antes de generarla.');
      if (clip.voice === null) throw new ApiError('ValidationError', 'Elige una voz de Polly antes de generar la narración.');
      clip.status = 'generating';
      clip.errorMessage = null;
      const result = await this.api.generateNarrationFor(clip);
      Object.assign(clip, result);
      const slide = this.state.slides.find((candidate) => candidate.id === clip.slideId);
      if (slide !== undefined) this.extendSlide(slide, clip.startsAtS + narrationDuration(clip));
    });
  }

  public async deleteNarration(clipId: string): Promise<void> {
    await this.run(async () => {
      const remap = await this.prepare();
      const id = remap.child(clipId);
      this.scheduler.cancel(`narration:${id}`);
      await this.api.deleteNarration(id);
      for (const slide of this.state.slides) slide.narrationClips = slide.narrationClips.filter((clip) => clip.id !== id);
      this.clearClip(id);
    });
  }

  // -- Comments -------------------------------------------------------------

  public async addComment(body: string): Promise<boolean> {
    let added = false;
    await this.run(async () => {
      const remap = await this.prepare();
      const current = this.currentSlide;
      if (current === null) return;
      const slide = this.requireSlide(remap.slide(current.id));
      slide.comments.push(await this.api.saveComment(slide.id, body));
      added = true;
    });
    return added;
  }

  public async deleteComment(commentId: string): Promise<void> {
    await this.run(async () => {
      const remap = await this.prepare();
      const id = remap.child(commentId);
      await this.api.deleteComment(id);
      for (const slide of this.state.slides) slide.comments = slide.comments.filter((comment) => comment.id !== id);
    });
  }

  /** Applies an edit to a clip, creating the draft first when the class is published. */
  private patchChild(id: string, apply: (remappedId: string) => void): void {
    if (this.needsPreparation) {
      void this.run(async () => {
        const remap = await this.prepare();
        apply(remap.child(id));
      });
      return;
    }
    apply(id);
  }

  private scheduleSave(key: string, task: () => Promise<void>): void {
    this.scheduler.schedule(key, async () => {
      try {
        await task();
        this.state.saveError = null;
      } catch (error) {
        this.state.saveError = errorMessage(error);
      }
      this.syncPending();
    });
    this.syncPending();
  }

  private clearClip(id: string): void {
    const selection = this.state.selectedClip;
    if (selection !== null && selection.kind !== 'transition' && selection.id === id) this.state.selectedClip = null;
    this.syncPending();
  }

  // -- Publishing -----------------------------------------------------------

  public async publish(): Promise<void> {
    await this.run(async () => {
      await this.flush();
      const document = this.state.document;
      if (document === null) return;
      const published = await this.api.publishVersion(document.id);
      this.apply(published);
      this.fixSelection();
      this.showNotice(`La versión ${String(published.publishedVersion ?? '')} está publicada.`);
      this.onChanged();
    });
  }

  // -- Saving ---------------------------------------------------------------

  /** Runs every pending save and waits for the ones in flight. */
  public async flush(): Promise<void> {
    await this.scheduler.flush();
    this.syncPending();
  }

  private syncPending(): void {
    this.state.pending = this.scheduler.pending + this.running;
  }

  private requireVersion(): string {
    const id = this.versionId;
    if (id === null) throw new ApiError('Conflict', 'La clase no tiene una versión en borrador.');
    return id;
  }

  /** Queues a structural action after the ones in flight; it counts as a pending save until it ends. */
  private async run(action: () => Promise<void>): Promise<void> {
    this.running += 1;
    this.syncPending();
    const next = this.chain.then(() => this.execute(action));
    this.chain = next;
    try {
      await next;
    } finally {
      this.running -= 1;
      this.syncPending();
    }
  }

  /** Runs a structural action and reports its failure instead of throwing, so the queue never breaks. */
  private async execute(action: () => Promise<void>): Promise<void> {
    try {
      await action();
      this.state.saveError = null;
    } catch (error) {
      this.state.saveError = errorMessage(error);
      try {
        await this.reload();
      } catch {
        // The reload only restores the shown state; the original error is already reported.
      }
    }
  }
}
