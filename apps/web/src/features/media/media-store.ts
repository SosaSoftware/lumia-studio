import { computed, shallowRef } from 'vue';
import type { ComputedRef } from 'vue';
import type { StudioApi } from '../../api/studio-api.ts';
import type { MediaAsset } from '../../api/types.ts';

export type MediaApi = Pick<StudioApi, 'mediaLibrary'>;

/**
 * Media library of the category shown in the workspace. Loads on first use and resolves media ids that the API does
 * not resolve by itself, such as the items of a gallery.
 */
export class MediaStore {
  private readonly byId = shallowRef(new Map<string, MediaAsset>());
  private loading: Promise<void> | null = null;
  private loaded = false;
  private categoryId: string | null = null;

  public readonly assets: ComputedRef<MediaAsset[]> = computed(() => [...this.byId.value.values()]);

  public constructor(private readonly api: MediaApi) {}

  /** Category whose library uploads go to and lists show. */
  public get category(): string | null {
    return this.categoryId;
  }

  /** Switches to the library of another category; the next use loads it. */
  public useCategory(categoryId: string | null): void {
    if (categoryId === this.categoryId) return;
    this.categoryId = categoryId;
    this.byId.value = new Map();
    this.loaded = false;
    this.loading = null;
  }

  /** Medium by id; the first unknown id triggers one load of the library. */
  public get(id: string): MediaAsset | null {
    const asset = this.byId.value.get(id);
    if (asset === undefined && !this.loaded) void this.load();
    return asset ?? null;
  }

  /** Loads the library of the category; concurrent calls share one request. */
  public load(force = false): Promise<void> {
    const categoryId = this.categoryId;
    if (categoryId === null || (this.loaded && !force)) return Promise.resolve();
    this.loading ??= this.api
      .mediaLibrary(categoryId)
      .then((items) => {
        if (categoryId !== this.categoryId) return;
        // Media added while the list was loading (a fresh upload) stays, even if the answer does not include it yet.
        const next = new Map(items.map((item) => [item.id, item]));
        for (const [id, asset] of this.byId.value) if (!next.has(id)) next.set(id, asset);
        this.byId.value = next;
        this.loaded = true;
      })
      .catch(() => {
        // Without the library the components show their placeholders; the next explicit load retries.
        this.loaded = true;
      })
      .finally(() => {
        this.loading = null;
      });
    return this.loading;
  }

  /** Adds a medium that was just uploaded. */
  public add(asset: MediaAsset): void {
    const next = new Map(this.byId.value);
    next.set(asset.id, asset);
    this.byId.value = next;
  }
}
