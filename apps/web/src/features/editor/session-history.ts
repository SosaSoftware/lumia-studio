import type { AudioClip, ElementPatch, NarrationClip, Pause, Slide, SlideElement, SlidePatch } from '../../api/types.ts';
import type { AudioPatch, NarrationPatch, PausePatch } from './document-session.ts';
import { IdHandles } from './id-handles.ts';
import { ActionEntry, CompositeEntry, PatchEntry, UndoHistory } from './undo-history.ts';
import { cloneValue, snapshotElement, snapshotSlide, valuesBefore } from './undo-snapshots.ts';
import type { ClipData, ClipKind, ClipSnapshot, ElementData, ElementSnapshot, RestoredSlide, SlideData, SlideSnapshot } from './undo-snapshots.ts';

/** What the history needs the session to do. The session implements it; the history never touches its state. */
export interface HistoryOps {
  updateElement(id: string, patch: ElementPatch): void;
  updateSlide(id: string, patch: SlidePatch): void;
  updatePause(id: string, patch: PausePatch): void;
  updateAudio(id: string, patch: AudioPatch): void;
  updateNarration(id: string, patch: NarrationPatch): void;
  deleteElements(ids: readonly string[]): Promise<void>;
  /** Creates elements again on a slide; returns the new ones in the order of `items`. */
  restoreElements(slideId: string, items: readonly ElementData[]): Promise<SlideElement[]>;
  deleteSlide(id: string): Promise<void>;
  /** Creates a slide again, with its content, at a 0-based index. */
  restoreSlide(data: SlideData, index: number): Promise<RestoredSlide>;
  moveSlide(id: string, toIndex: number): Promise<void>;
  deleteClip(kind: ClipKind, id: string): Promise<void>;
  /** Creates a clip again on a slide; returns its id. */
  restoreClip(slideId: string, data: ClipData): Promise<string>;
  /** Resolves when every edit made so far has been applied. */
  settle(): Promise<void>;
  slideOfElement(id: string): string | null;
  /** Shows a slide and selects elements of it. */
  focus(slideId: string | null, elementIds: readonly string[]): void;
  focusClip(kind: ClipKind, id: string): void;
}

/** A slide gets longer when a clip is added after its end; undoing the addition gives the length back. */
export interface SlideLength {
  readonly before: number;
  readonly after: number;
}

/**
 * The undo and redo of a class being edited. The session reports each change it makes and the history turns it into
 * a step that can be undone and redone. The steps refer to things by name, so they still work after the things were
 * deleted and created again, or copied into a new version.
 */
export class SessionHistory {
  public readonly steps = new UndoHistory();
  public readonly handles = new IdHandles();

  public constructor(private readonly ops: HistoryOps) {}

  public get recording(): boolean {
    return this.steps.recording;
  }

  public clear(): void {
    this.steps.clear();
    this.handles.clear();
  }

  // -- Snapshots, taken before something is deleted ------------------------------

  public snapshotElement(element: SlideElement): ElementSnapshot {
    return snapshotElement(this.handles, element);
  }

  public snapshotSlide(slide: Slide): SlideSnapshot {
    return snapshotSlide(this.handles, slide);
  }

  private ids(clip: { id: string; slideId: string }): { handle: string; slideHandle: string } {
    return { handle: this.handles.handle(clip.id), slideHandle: this.handles.handle(clip.slideId) };
  }

  public snapshotPause(pause: Pause): ClipSnapshot {
    const { startsAtS, durationS, message, onEnd, timerElementId } = pause;
    const timerHandle = timerElementId === null ? null : this.handles.handle(timerElementId);
    return { kind: 'pause', startsAtS, durationS, message, onEnd, timerHandle, ...this.ids(pause) };
  }

  /** Null for a clip without a medium, which cannot be created again. */
  public snapshotAudio(clip: AudioClip): ClipSnapshot | null {
    if (clip.mediaId === null) return null;
    const { startsAtS, durationS, name, volume } = clip;
    return { kind: 'audio', mediaId: clip.mediaId, startsAtS, durationS, name, audioKind: clip.kind, volume, ...this.ids(clip) };
  }

  public snapshotNarration(clip: NarrationClip): ClipSnapshot {
    const { script, startsAtS, voice, speed } = clip;
    return { kind: 'narration', script, startsAtS, voice, speed, ...this.ids(clip) };
  }

  // -- Edits of fields -----------------------------------------------------------

  /** The values the fields of `patch` have now in `source`, to record before changing them. */
  public before<P extends object>(source: object, patch: P): P {
    return valuesBefore(source, patch);
  }

  public recordElementPatch(id: string, before: ElementPatch, after: ElementPatch): void {
    if (this.recording) this.steps.record(this.elementPatch(id, before, after));
  }

  /** Several elements edited at once, such as a group moved or aligned: one step. */
  public recordElementPatches(changes: readonly { readonly id: string; readonly before: ElementPatch; readonly after: ElementPatch }[]): void {
    if (!this.recording || changes.length === 0) return;
    const handles = changes.map((change) => this.handles.handle(change.id));
    this.steps.record(new CompositeEntry(changes.map((change) => this.elementPatch(change.id, change.before, change.after)), () => {
      this.focusElements(handles);
    }));
  }

  public recordSlidePatch(id: string, before: SlidePatch, after: SlidePatch): void {
    if (!this.recording) return;
    this.steps.record(
      new PatchEntry('slide', this.handles.handle(id), before, cloneValue(after), async (handle, patch) => {
        const real = this.handles.real(handle);
        this.ops.updateSlide(real, patch);
        await this.ops.settle();
        this.ops.focus(real, []);
      }),
    );
  }

  public recordPausePatch(id: string, before: PausePatch, after: PausePatch): void {
    if (!this.recording) return;
    this.steps.record(this.clipPatch('pause', id, before, after, (real, patch) => { this.ops.updatePause(real, patch); }));
  }

  public recordAudioPatch(id: string, before: AudioPatch, after: AudioPatch): void {
    if (!this.recording) return;
    this.steps.record(this.clipPatch('audio', id, before, after, (real, patch) => { this.ops.updateAudio(real, patch); }));
  }

  public recordNarrationPatch(id: string, before: NarrationPatch, after: NarrationPatch): void {
    if (!this.recording) return;
    this.steps.record(this.clipPatch('narration', id, before, after, (real, patch) => { this.ops.updateNarration(real, patch); }));
  }

  private elementPatch(id: string, before: ElementPatch, after: ElementPatch): PatchEntry<ElementPatch> {
    return new PatchEntry('element', this.handles.handle(id), before, cloneValue(after), async (handle, patch) => {
      const real = this.handles.real(handle);
      this.ops.updateElement(real, patch);
      await this.ops.settle();
      this.focusElements([handle]);
    });
  }

  private clipPatch<P extends object>(kind: ClipKind, id: string, before: P, after: P, apply: (real: string, patch: P) => void): PatchEntry<P> {
    return new PatchEntry(kind, this.handles.handle(id), before, cloneValue(after), async (handle, patch) => {
      const real = this.handles.real(handle);
      apply(real, patch);
      await this.ops.settle();
      this.ops.focusClip(kind, real);
    });
  }

  // -- Elements ------------------------------------------------------------------

  public recordElementsCreated(created: readonly SlideElement[]): void {
    if (!this.recording || created.length === 0) return;
    const snapshots = created.map((element) => this.snapshotElement(element));
    this.steps.record(new ActionEntry(() => this.removeElements(snapshots), () => this.restoreElements(snapshots)));
  }

  public recordElementsDeleted(snapshots: readonly ElementSnapshot[]): void {
    if (!this.recording || snapshots.length === 0) return;
    this.steps.record(new ActionEntry(() => this.restoreElements(snapshots), () => this.removeElements(snapshots)));
  }

  private async removeElements(snapshots: readonly ElementSnapshot[]): Promise<void> {
    await this.ops.deleteElements(snapshots.map((snapshot) => this.handles.real(snapshot.handle)));
  }

  /** Creates the elements again, slide by slide, and gives each its old name. */
  private async restoreElements(snapshots: readonly ElementSnapshot[]): Promise<void> {
    const bySlide = new Map<string, ElementSnapshot[]>();
    for (const snapshot of snapshots) bySlide.set(snapshot.slideHandle, [...(bySlide.get(snapshot.slideHandle) ?? []), snapshot]);
    const restored: string[] = [];
    for (const [slideHandle, items] of bySlide) {
      const created = await this.ops.restoreElements(this.handles.real(slideHandle), items);
      created.forEach((element, index) => {
        const snapshot = items[index];
        if (snapshot !== undefined) this.handles.bind(snapshot.handle, element.id);
        restored.push(element.id);
      });
    }
    const slideId = restored[0] === undefined ? null : this.ops.slideOfElement(restored[0]);
    this.ops.focus(slideId, restored);
  }

  private focusElements(handles: readonly string[]): void {
    const ids = handles.map((handle) => this.handles.real(handle));
    const first = ids[0];
    this.ops.focus(first === undefined ? null : this.ops.slideOfElement(first), ids);
  }

  // -- Slides --------------------------------------------------------------------

  /** A slide was added, duplicated or created with its first element. */
  public recordSlideCreated(slide: Slide, index: number): void {
    if (!this.recording) return;
    const snapshot = this.snapshotSlide(slide);
    this.steps.record(new ActionEntry(() => this.removeSlide(snapshot), () => this.restoreSlide(snapshot, index)));
  }

  public recordSlideDeleted(snapshot: SlideSnapshot, index: number): void {
    if (!this.recording) return;
    this.steps.record(new ActionEntry(() => this.restoreSlide(snapshot, index), () => this.removeSlide(snapshot)));
  }

  public recordSlideMoved(id: string, from: number, to: number): void {
    if (!this.recording) return;
    const handle = this.handles.handle(id);
    this.steps.record(
      new ActionEntry(
        () => this.ops.moveSlide(this.handles.real(handle), from),
        () => this.ops.moveSlide(this.handles.real(handle), to),
      ),
    );
  }

  private async removeSlide(snapshot: SlideSnapshot): Promise<void> {
    await this.ops.deleteSlide(this.handles.real(snapshot.handle));
  }

  private async restoreSlide(snapshot: SlideSnapshot, index: number): Promise<void> {
    const restored = await this.ops.restoreSlide(snapshot, index);
    this.handles.bind(snapshot.handle, restored.slideId);
    const bind = (handles: readonly string[], ids: readonly string[]): void => {
      handles.forEach((handle, position) => {
        const id = ids[position];
        if (id !== undefined && id !== '') this.handles.bind(handle, id);
      });
    };
    bind(snapshot.elementHandles, restored.elementIds);
    bind(snapshot.pauseHandles, restored.pauseIds);
    bind(snapshot.audioHandles, restored.audioIds);
    bind(snapshot.narrationHandles, restored.narrationIds);
    this.ops.focus(restored.slideId, []);
  }

  // -- Clips of the timeline -----------------------------------------------------

  /** A pause, an audio clip or a narration clip was added; `length` tells if the slide had to grow for it. */
  public recordClipCreated(snapshot: ClipSnapshot, length: SlideLength): void {
    if (!this.recording) return;
    const setLength = async (durationS: number): Promise<void> => {
      if (length.before === length.after) return;
      this.ops.updateSlide(this.handles.real(snapshot.slideHandle), { durationS });
      await this.ops.settle();
    };
    this.steps.record(
      new ActionEntry(
        async () => {
          await this.removeClip(snapshot);
          await setLength(length.before);
        },
        async () => {
          await this.restoreClip(snapshot);
          await setLength(length.after);
        },
      ),
    );
  }

  public recordClipDeleted(snapshot: ClipSnapshot): void {
    if (!this.recording) return;
    this.steps.record(new ActionEntry(() => this.restoreClip(snapshot), () => this.removeClip(snapshot)));
  }

  private async removeClip(snapshot: ClipSnapshot): Promise<void> {
    await this.ops.deleteClip(snapshot.kind, this.handles.real(snapshot.handle));
  }

  private async restoreClip(snapshot: ClipSnapshot): Promise<void> {
    const slideId = this.handles.real(snapshot.slideHandle);
    const id = await this.ops.restoreClip(slideId, this.clipData(snapshot));
    this.handles.bind(snapshot.handle, id);
    this.ops.focusClip(snapshot.kind, id);
  }

  private clipData(snapshot: ClipSnapshot): ClipData {
    if (snapshot.kind === 'pause') {
      const { startsAtS, durationS, message, onEnd, timerHandle } = snapshot;
      return { kind: 'pause', startsAtS, durationS, message, onEnd, timerElementId: timerHandle === null ? null : this.handles.real(timerHandle) };
    }
    return snapshot;
  }
}
