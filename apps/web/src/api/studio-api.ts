import type { GraphqlClient } from './graphql-client.ts';
import {
  decodeAudioClip,
  decodeCatalog,
  decodeCategory,
  decodeComment,
  decodeDocument,
  decodeElement,
  decodeNarrationClip,
  decodePause,
  decodeSlide,
  decodeTreeNode,
  decodeVersion,
  list,
  rec,
  str,
} from './decode.ts';
import type {
  AudioClip,
  CatalogInfo,
  Category,
  ClassDocument,
  DocumentVersion,
  DraftSlideInput,
  ElementPatch,
  MediaAsset,
  MediaUpload,
  NarrationClip,
  Pause,
  Slide,
  SlideComment,
  SlideElement,
  SlidePatch,
  TreeNode,
  Voice,
} from './types.ts';

const NARRATION_FIELDS = `id slideId startsAtS script voice speed generatedDurationS audioUrl status errorMessage`;
const PAUSE_FIELDS = `id slideId startsAtS durationS message onEnd timerElementId`;
const AUDIO_FIELDS = `id slideId mediaId media { id name mimeType url } startsAtS durationS name kind volume`;
const COMMENT_FIELDS = `id slideId authorSub authorName body createdAt`;
const ELEMENT_FIELDS = `id slideId component name x y w h z appearsAtS entrance props mediaId media { id name mimeType url }`;
const SLIDE_FIELDS = `id versionId position type title background durationS transition advance elements { ${ELEMENT_FIELDS} } narrationClips { ${NARRATION_FIELDS} } pauses { ${PAUSE_FIELDS} } audioClips { ${AUDIO_FIELDS} } comments { ${COMMENT_FIELDS} }`;
const VERSION_FIELDS = `id documentId number status slides { ${SLIDE_FIELDS} }`;
const DOCUMENT_FIELDS = `id nodeId status currentVersion publishedVersion versions { id number status } editingVersion { ${VERSION_FIELDS} }`;
const TREE_NODE_FIELDS = `id subcategoryId parentId kind name displayName description position documentId documentStatus currentVersion publishedVersion`;
/** Largest page the API serves; lists are read page by page until `nextToken` is null. */
const PAGE_LIMIT = 1000;

/** What Studio lets the signed-in person do. */
export interface StudioAccess {
  email: string;
  name: string;
  role: string;
  roleName: string;
  actions: string[];
}

/** Typed access to the Lumia Studio API; every mutation returns what changed. */
export class StudioApi {
  public constructor(private readonly client: GraphqlClient) {}

  /** The signed-in person's role and actions, as Studio reads them from its database for each request. */
  public async me(): Promise<StudioAccess> {
    const me = rec((await this.client.request('query { me { email name role roleName actions } }')).me);
    return { email: str(me.email), name: str(me.name), role: str(me.role), roleName: str(me.roleName), actions: list(me.actions).filter((action): action is string => typeof action === 'string') };
  }

  /** Categories the person can see, with the subcategories they can open. */
  public async categories(): Promise<Category[]> {
    return this.pages((page) => this.client.request(
      `query($page: PageInput) { categories(page: $page) { items { id name displayName description groupName
        subcategories { id categoryId name displayName description groupName } } nextToken } }`,
      { page },
    ), 'categories', decodeCategory);
  }

  /** Every folder and class of a subcategory. */
  public async treeNodes(subcategoryId: string): Promise<TreeNode[]> {
    return this.pages((page) => this.client.request(
      `query($filter: TreeNodeFilter!, $page: PageInput) { treeNodes(filter: $filter, page: $page) { items { ${TREE_NODE_FIELDS} } nextToken } }`,
      { filter: { subcategoryId }, page },
    ), 'treeNodes', decodeTreeNode);
  }

  public async componentCatalog(): Promise<CatalogInfo> {
    const data = await this.client.request(
      `query { componentCatalog { components { key name group groupName usage propsSchema defaults defaultSize { w h } usesMedia isQuestion }
        slideTypes { key name usage defaultBackground defaultDurationS starterComponents } } }`,
    );
    return decodeCatalog(data.componentCatalog);
  }

  public async document(nodeId: string): Promise<ClassDocument | null> {
    const data = await this.client.request(`query($id: ID!) { document(nodeId: $id) { ${DOCUMENT_FIELDS} } }`, { id: nodeId });
    return data.document === null || data.document === undefined ? null : decodeDocument(data.document);
  }

  public async version(id: string): Promise<DocumentVersion> {
    const data = await this.client.request(`query($id: ID!) { version(id: $id) { ${VERSION_FIELDS} } }`, { id });
    return decodeVersion(data.version);
  }

  public async createDocument(nodeId: string): Promise<ClassDocument> {
    const data = await this.client.request(`mutation($id: ID!) { createDocument(nodeId: $id) { ${DOCUMENT_FIELDS} } }`, { id: nodeId });
    return decodeDocument(data.createDocument);
  }

  public async createVersion(documentId: string): Promise<DocumentVersion> {
    const data = await this.client.request(`mutation($id: ID!) { createVersion(documentId: $id) { ${VERSION_FIELDS} } }`, { id: documentId });
    return decodeVersion(data.createVersion);
  }

  public async publishVersion(documentId: string): Promise<ClassDocument> {
    const data = await this.client.request(`mutation($id: ID!) { publishVersion(documentId: $id) { ${DOCUMENT_FIELDS} } }`, { id: documentId });
    return decodeDocument(data.publishVersion);
  }

  public async saveSlide(slideId: string, versionId: string, patch: SlidePatch): Promise<Slide> {
    const data = await this.client.request(
      `mutation($input: SlideInput!) { saveSlide(input: $input) { ${SLIDE_FIELDS} } }`,
      { input: { id: slideId, versionId, ...patch } },
    );
    return decodeSlide(data.saveSlide);
  }

  public async reorderSlides(versionId: string, slideIds: string[]): Promise<Slide[]> {
    const data = await this.client.request(
      `mutation($versionId: ID!, $slideIds: [ID!]!) { reorderSlides(versionId: $versionId, slideIds: $slideIds) { ${SLIDE_FIELDS} } }`,
      { versionId, slideIds },
    );
    return list(data.reorderSlides).map(decodeSlide);
  }

  public async duplicateSlide(slideId: string): Promise<Slide> {
    const data = await this.client.request(`mutation($id: ID!) { duplicateSlide(slideId: $id) { ${SLIDE_FIELDS} } }`, { id: slideId });
    return decodeSlide(data.duplicateSlide);
  }

  public async deleteSlide(slideId: string): Promise<void> {
    await this.client.request(`mutation($id: ID!) { deleteSlide(slideId: $id) { id deleted } }`, { id: slideId });
  }

  /** Creates the element when `id` is null; otherwise updates it. */
  public async saveElement(slideId: string, id: string | null, component: string, patch: ElementPatch & { props: Record<string, unknown> }): Promise<SlideElement> {
    const input = { ...patch, id, slideId, component, props: JSON.stringify(patch.props) };
    const data = await this.client.request(`mutation($input: ElementInput!) { saveElement(input: $input) { ${ELEMENT_FIELDS} } }`, { input });
    return decodeElement(data.saveElement);
  }

  public async deleteElement(elementId: string): Promise<void> {
    await this.client.request(`mutation($id: ID!) { deleteElement(elementId: $id) { id deleted } }`, { id: elementId });
  }

  public async applySlidesDraft(versionId: string, afterPosition: number | null, slides: DraftSlideInput[]): Promise<Slide[]> {
    const input = slides.map((slide) => ({
      ...slide,
      elements: slide.elements.map((element) => ({ ...element, props: JSON.stringify(element.props) })),
    }));
    const data = await this.client.request(
      `mutation($versionId: ID!, $after: Int, $slides: [DraftSlideInput!]!) { applySlidesDraft(versionId: $versionId, afterPosition: $after, slides: $slides) { ${SLIDE_FIELDS} } }`,
      { versionId, after: afterPosition, slides: input },
    );
    return list(data.applySlidesDraft).map(decodeSlide);
  }

  public async createMediaUpload(categoryId: string, name: string, mimeType: string, sizeBytes: number): Promise<MediaUpload> {
    const data = await this.client.request(
      `mutation($input: MediaUploadInput!) { createMediaUpload(input: $input) { key uploadUrl } }`,
      { input: { categoryId, name, mimeType, sizeBytes } },
    );
    const upload = rec(data.createMediaUpload);
    return { key: str(upload.key), uploadUrl: str(upload.uploadUrl) };
  }

  public async registerMedia(categoryId: string, key: string, name: string, mimeType: string, sizeBytes: number): Promise<MediaAsset> {
    const data = await this.client.request(
      `mutation($input: RegisterMediaInput!) { registerMedia(input: $input) { id name mimeType url } }`,
      { input: { categoryId, key, name, mimeType, sizeBytes } },
    );
    const asset = rec(data.registerMedia);
    return { id: str(asset.id), name: str(asset.name), mimeType: str(asset.mimeType), url: str(asset.url) };
  }

  /** Generates the voice of an existing clip with its current settings. */
  public async generateNarrationFor(clip: Pick<NarrationClip, 'id' | 'slideId' | 'script' | 'startsAtS' | 'voice' | 'speed'>): Promise<NarrationClip> {
    const { id, slideId, script, startsAtS, voice, speed } = clip;
    const data = await this.client.request(
      `mutation($input: NarrationInput!) { generateNarration(input: $input) { ${NARRATION_FIELDS} } }`,
      { input: { id, slideId, script, startsAtS, voice, speed } },
    );
    return decodeNarrationClip(data.generateNarration);
  }

  /** Creates (id null) or updates a clip without synthesizing the voice. */
  public async saveNarration(slideId: string, id: string | null, values: { script: string; startsAtS: number; voice: string | null; speed: number }): Promise<NarrationClip> {
    const data = await this.client.request(
      `mutation($input: NarrationInput!) { saveNarration(input: $input) { ${NARRATION_FIELDS} } }`,
      { input: { id, slideId, ...values } },
    );
    return decodeNarrationClip(data.saveNarration);
  }

  public async deleteNarration(clipId: string): Promise<void> {
    await this.client.request(`mutation($id: ID!) { deleteNarration(narrationClipId: $id) { id deleted } }`, { id: clipId });
  }

  // -- Timeline: pauses ------------------------------------------------------

  public async savePause(slideId: string, id: string | null, patch: { startsAtS?: number; durationS?: number; message?: string; onEnd?: string; timerElementId?: string | null }): Promise<Pause> {
    const data = await this.client.request(
      `mutation($input: PauseInput!) { savePause(input: $input) { ${PAUSE_FIELDS} } }`,
      { input: { id, slideId, ...patch } },
    );
    return decodePause(data.savePause);
  }

  public async deletePause(pauseId: string): Promise<void> {
    await this.client.request(`mutation($id: ID!) { deletePause(pauseId: $id) { id deleted } }`, { id: pauseId });
  }

  // -- Timeline: audio -------------------------------------------------------

  public async saveAudio(slideId: string, id: string | null, patch: { mediaId?: string; startsAtS?: number; durationS?: number; name?: string; kind?: string; volume?: number }): Promise<AudioClip> {
    const data = await this.client.request(
      `mutation($input: AudioClipInput!) { saveAudio(input: $input) { ${AUDIO_FIELDS} } }`,
      { input: { id, slideId, ...patch } },
    );
    return decodeAudioClip(data.saveAudio);
  }

  public async deleteAudio(audioClipId: string): Promise<void> {
    await this.client.request(`mutation($id: ID!) { deleteAudio(audioClipId: $id) { id deleted } }`, { id: audioClipId });
  }

  // -- Comments --------------------------------------------------------------

  public async saveComment(slideId: string, body: string): Promise<SlideComment> {
    const data = await this.client.request(
      `mutation($slideId: ID!, $body: String!) { saveComment(slideId: $slideId, body: $body) { ${COMMENT_FIELDS} } }`,
      { slideId, body },
    );
    return decodeComment(data.saveComment);
  }

  public async deleteComment(commentId: string): Promise<void> {
    await this.client.request(`mutation($id: ID!) { deleteComment(commentId: $id) { id deleted } }`, { id: commentId });
  }

  // -- Media library ---------------------------------------------------------

  /** Every voice Polly offers for narration; the API pages the list. */
  public async voices(): Promise<Voice[]> {
    const voices: Voice[] = [];
    let nextToken: string | null = null;
    do {
      const data = await this.client.request(
        `query($page: PageInput) { narrationVoices(page: $page) { items { id name gender languageCode } nextToken } }`,
        { page: { limit: 200, nextToken } },
      );
      const page = rec(data.narrationVoices);
      for (const item of list(page.items)) {
        const voice = rec(item);
        voices.push({ id: str(voice.id), name: str(voice.name), gender: voice.gender === 'male' ? 'male' : 'female', languageCode: str(voice.languageCode) });
      }
      nextToken = typeof page.nextToken === 'string' && page.nextToken !== '' ? page.nextToken : null;
    } while (nextToken !== null);
    return voices;
  }

  /** Media library of a category, newest first. */
  public async mediaLibrary(categoryId: string): Promise<MediaAsset[]> {
    return this.pages((page) => this.client.request(
      `query($filter: MediaFilter!, $page: PageInput) { mediaLibrary(filter: $filter, page: $page) { items { id name mimeType url } nextToken } }`,
      { filter: { categoryId }, page: { limit: Math.min(PAGE_LIMIT, 100), nextToken: page.nextToken } },
    ), 'mediaLibrary', (item) => {
      const asset = rec(item);
      return { id: str(asset.id), name: str(asset.name), mimeType: str(asset.mimeType), url: str(asset.url) };
    });
  }

  /** Reads every page of a list field: `{ items, nextToken }`. */
  private async pages<T>(
    request: (page: { limit: number; nextToken: string | null }) => Promise<Record<string, unknown>>,
    field: string,
    decode: (item: unknown) => T,
  ): Promise<T[]> {
    const items: T[] = [];
    let nextToken: string | null = null;
    do {
      const page = rec((await request({ limit: PAGE_LIMIT, nextToken }))[field]);
      items.push(...list(page.items).map(decode));
      nextToken = typeof page.nextToken === 'string' && page.nextToken !== '' ? page.nextToken : null;
    } while (nextToken !== null);
    return items;
  }
}
