import { describe, expect, it, vi } from 'vitest';
import type { MediaAsset } from '../../api/types.ts';
import { MediaStore } from './media-store.ts';

const asset = (id: string): MediaAsset => ({ id, name: `${id}.png`, mimeType: 'image/png', url: `/storage/${id}` });

describe('MediaStore', () => {
  it('loads the library of the category and starts over when the category changes', async () => {
    const mediaLibrary = vi.fn<(categoryId: string) => Promise<MediaAsset[]>>((categoryId) => Promise.resolve([asset(`${categoryId}-1`)]));
    const store = new MediaStore({ mediaLibrary });
    await store.load();
    expect(mediaLibrary).not.toHaveBeenCalled();
    store.useCategory('a');
    await store.load();
    expect(store.assets.value.map((item) => item.id)).toEqual(['a-1']);
    store.useCategory('b');
    expect(store.assets.value).toEqual([]);
    await store.load();
    expect(store.assets.value.map((item) => item.id)).toEqual(['b-1']);
  });

  it('keeps an upload that finished while the list was loading', async () => {
    let answer: (items: MediaAsset[]) => void = () => undefined;
    const mediaLibrary = vi.fn<(categoryId: string) => Promise<MediaAsset[]>>(() => new Promise((resolve) => { answer = resolve; }));
    const store = new MediaStore({ mediaLibrary });
    store.useCategory('a');
    const loading = store.load(true);
    store.add(asset('fresh'));
    answer([asset('old')]);
    await loading;
    expect(store.assets.value.map((item) => item.id).sort()).toEqual(['fresh', 'old']);
  });
});
