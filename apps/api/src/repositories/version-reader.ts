import type { Database } from '../infrastructure/db/index.ts';
import { isoTimestamp } from '../infrastructure/db/sql-functions.ts';
import type { ObjectStorage } from '../infrastructure/storage/index.ts';
import type {
  AudioClipDto, DocumentVersionDto, ElementDto, MediaRefDto, NarrationClipDto, PauseDto, SlideCommentDto, SlideDto, VersionStatus,
} from '../domain/dto.ts';

/** Lifetime of the signed download URLs returned to the editor. */
export const DOWNLOAD_URL_TTL_S = 3600;

interface SlideRow {
  id: string;
  version_id: string;
  position: number;
  type: string;
  title: string;
  background: string;
  duration_s: number;
  transition: string;
  advance: string;
}

interface ElementRow {
  id: string;
  slide_id: string;
  component: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  appears_at_s: number;
  entrance: string;
  props: unknown;
  media_id: string | null;
  media_name: string | null;
  media_mime: string | null;
  media_key: string | null;
}

interface NarrationRow {
  id: string;
  slide_id: string;
  starts_at_s: number;
  script: string;
  voice: string | null;
  speed: number;
  generated_duration_s: number;
  audio_key: string | null;
  speech_marks_key: string | null;
  status: string;
  error_message: string | null;
}

interface PauseRow {
  id: string;
  slide_id: string;
  starts_at_s: number;
  duration_s: number;
  message: string;
  on_end: string;
  timer_element_id: string | null;
}

interface AudioRow {
  id: string;
  slide_id: string;
  media_id: string;
  starts_at_s: number;
  duration_s: number;
  name: string;
  kind: string;
  volume: number;
  media_name: string;
  media_mime: string;
  media_key: string;
}

interface CommentRow {
  id: string;
  slide_id: string;
  author_sub: string;
  author_name: string;
  body: string;
  created_at: string;
}

interface VersionRow {
  id: string;
  document_id: string;
  number: number;
  status: VersionStatus;
  created_at: string;
  created_by: string;
  published_at: string | null;
  published_by: string | null;
}

/** Slide filters; the SQL is constant and the value is always the single `:id` parameter. */
const FILTERS = {
  version: 's.version_id = :id::uuid',
  slide: 's.id = :id::uuid',
} as const;

type SlideFilter = keyof typeof FILTERS;

function groupBy<T extends { slide_id: string }>(rows: readonly T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const group = groups.get(row.slide_id);
    if (group === undefined) {
      groups.set(row.slide_id, [row]);
    } else {
      group.push(row);
    }
  }
  return groups;
}

/** A jsonb object column: pg parses it, the RDS Data API returns it as JSON text. */
function jsonObject(value: unknown): Record<string, unknown> {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? { ...parsed } : {};
}

/** Loads versions and slides with everything they own, and signs the URLs of their files. */
export class VersionReader {
  public constructor(
    private readonly db: Database,
    private readonly storage: ObjectStorage,
  ) {}

  public async version(versionId: string): Promise<DocumentVersionDto | null> {
    const rows = await this.db.query<VersionRow>(
      `select id::text as id, document_id::text as document_id, number, status::text as status, ${isoTimestamp('created_at')} as created_at,
              created_by, ${isoTimestamp('published_at')} as published_at, published_by from studio.document_version where id = :id::uuid`,
      { id: versionId },
    );
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return {
      id: row.id,
      documentId: row.document_id,
      number: row.number,
      status: row.status,
      createdAt: row.created_at,
      createdBy: row.created_by,
      publishedAt: row.published_at,
      publishedBy: row.published_by,
      slides: await this.slides('version', versionId),
    };
  }

  public async slide(slideId: string): Promise<SlideDto | null> {
    return (await this.slides('slide', slideId))[0] ?? null;
  }

  /** The slides with the given ids, in position order. */
  public async slidesByIds(slideIds: readonly string[]): Promise<SlideDto[]> {
    const loaded = await Promise.all(slideIds.map((id) => this.slide(id)));
    return loaded.flatMap((slide) => slide ?? []).sort((a, b) => a.position - b.position);
  }

  public async mediaRef(key: string, id: string, name: string, mimeType: string): Promise<MediaRefDto> {
    return { id, name, mimeType, url: await this.storage.createDownloadUrl(key, DOWNLOAD_URL_TTL_S) };
  }

  public async narrationClip(clipId: string): Promise<NarrationClipDto | null> {
    const rows = await this.db.query<NarrationRow>(`${NARRATION_SELECT} where n.id = :id::uuid`, { id: clipId });
    const row = rows[0];
    return row === undefined ? null : this.narration(row);
  }

  public async pause(pauseId: string): Promise<PauseDto | null> {
    const rows = await this.db.query<PauseRow>(`${PAUSE_SELECT} where p.id = :id::uuid`, { id: pauseId });
    const row = rows[0];
    return row === undefined ? null : VersionReader.pause(row);
  }

  public async audioClip(audioClipId: string): Promise<AudioClipDto | null> {
    const rows = await this.db.query<AudioRow>(`${AUDIO_SELECT} where a.id = :id::uuid`, { id: audioClipId });
    const row = rows[0];
    return row === undefined ? null : this.audio(row);
  }

  public async comment(commentId: string): Promise<SlideCommentDto | null> {
    const rows = await this.db.query<CommentRow>(`${COMMENT_SELECT} where c.id = :id::uuid`, { id: commentId });
    const row = rows[0];
    return row === undefined ? null : VersionReader.comment(row);
  }

  public async element(elementId: string): Promise<ElementDto | null> {
    const rows = await this.db.query<ElementRow>(`${ELEMENT_SELECT} where e.id = :id::uuid`, { id: elementId });
    const row = rows[0];
    return row === undefined ? null : this.elementDto(row);
  }

  private async slides(filter: SlideFilter, id: string): Promise<SlideDto[]> {
    const where = FILTERS[filter];
    const params = { id };
    const slideRows = await this.db.query<SlideRow>(
      `select s.id::text as id, s.version_id::text as version_id, s.position, s.type::text as type, s.title, s.background,
              s.duration_s, s.transition::text as transition, s.advance::text as advance
         from studio.slide s where ${where} order by s.position`,
      params,
    );
    const [elements, narrations, pauses, audio, comments] = await Promise.all([
      this.db.query<ElementRow>(`${ELEMENT_SELECT} join studio.slide s on s.id = e.slide_id where ${where} order by e.z, e.id`, params),
      this.db.query<NarrationRow>(`${NARRATION_SELECT} join studio.slide s on s.id = n.slide_id where ${where} order by n.starts_at_s, n.id`, params),
      this.db.query<PauseRow>(`${PAUSE_SELECT} join studio.slide s on s.id = p.slide_id where ${where} order by p.starts_at_s, p.id`, params),
      this.db.query<AudioRow>(`${AUDIO_SELECT} join studio.slide s on s.id = a.slide_id where ${where} order by a.starts_at_s, a.id`, params),
      this.db.query<CommentRow>(`${COMMENT_SELECT} join studio.slide s on s.id = c.slide_id where ${where} order by c.created_at, c.id`, params),
    ]);
    const elementsBySlide = groupBy(elements);
    const narrationBySlide = groupBy(narrations);
    const pausesBySlide = groupBy(pauses);
    const audioBySlide = groupBy(audio);
    const commentsBySlide = groupBy(comments);
    return Promise.all(
      slideRows.map(async (row): Promise<SlideDto> => ({
        id: row.id,
        versionId: row.version_id,
        position: row.position,
        type: row.type,
        title: row.title,
        background: row.background,
        durationS: row.duration_s,
        transition: row.transition,
        advance: row.advance,
        elements: await Promise.all((elementsBySlide.get(row.id) ?? []).map((item) => this.elementDto(item))),
        narrationClips: await Promise.all((narrationBySlide.get(row.id) ?? []).map((item) => this.narration(item))),
        pauses: (pausesBySlide.get(row.id) ?? []).map((item) => VersionReader.pause(item)),
        audioClips: await Promise.all((audioBySlide.get(row.id) ?? []).map((item) => this.audio(item))),
        comments: (commentsBySlide.get(row.id) ?? []).map((item) => VersionReader.comment(item)),
      })),
    );
  }

  private async elementDto(row: ElementRow): Promise<ElementDto> {
    const media =
      row.media_id !== null && row.media_key !== null && row.media_name !== null && row.media_mime !== null
        ? await this.mediaRef(row.media_key, row.media_id, row.media_name, row.media_mime)
        : null;
    return {
      id: row.id,
      slideId: row.slide_id,
      component: row.component,
      name: row.name,
      x: row.x,
      y: row.y,
      w: row.w,
      h: row.h,
      z: row.z,
      appearsAtS: row.appears_at_s,
      entrance: row.entrance,
      props: jsonObject(row.props),
      mediaId: row.media_id,
      media,
    };
  }

  private async narration(row: NarrationRow): Promise<NarrationClipDto> {
    return {
      id: row.id,
      slideId: row.slide_id,
      startsAtS: row.starts_at_s,
      script: row.script,
      voice: row.voice,
      speed: row.speed,
      generatedDurationS: row.generated_duration_s,
      audioUrl: row.audio_key === null ? null : await this.storage.createDownloadUrl(row.audio_key, DOWNLOAD_URL_TTL_S),
      speechMarksUrl: row.speech_marks_key === null ? null : await this.storage.createDownloadUrl(row.speech_marks_key, DOWNLOAD_URL_TTL_S),
      status: row.status,
      errorMessage: row.error_message,
    };
  }

  private async audio(row: AudioRow): Promise<AudioClipDto> {
    return {
      id: row.id,
      slideId: row.slide_id,
      mediaId: row.media_id,
      media: await this.mediaRef(row.media_key, row.media_id, row.media_name, row.media_mime),
      startsAtS: row.starts_at_s,
      durationS: row.duration_s,
      name: row.name,
      kind: row.kind,
      volume: row.volume,
    };
  }

  private static pause(row: PauseRow): PauseDto {
    return {
      id: row.id,
      slideId: row.slide_id,
      startsAtS: row.starts_at_s,
      durationS: row.duration_s,
      message: row.message,
      onEnd: row.on_end,
      timerElementId: row.timer_element_id,
    };
  }

  private static comment(row: CommentRow): SlideCommentDto {
    return {
      id: row.id,
      slideId: row.slide_id,
      authorSub: row.author_sub,
      authorName: row.author_name,
      body: row.body,
      createdAt: row.created_at,
    };
  }
}

const ELEMENT_SELECT = `select e.id::text as id, e.slide_id::text as slide_id, e.component, e.name, e.x, e.y, e.w, e.h, e.z,
       e.appears_at_s, e.entrance::text as entrance, e.props, e.media_id::text as media_id,
       m.name as media_name, m.mime_type as media_mime, m.s3_key as media_key
  from studio.slide_element e left join studio.media_asset m on m.id = e.media_id`;

const NARRATION_SELECT = `select n.id::text as id, n.slide_id::text as slide_id, n.starts_at_s, n.script, n.voice, n.speed,
       n.generated_duration_s, n.audio_key, n.speech_marks_key, n.status::text as status, n.error_message
  from studio.narration_clip n`;

const PAUSE_SELECT = `select p.id::text as id, p.slide_id::text as slide_id, p.starts_at_s, p.duration_s, p.message,
       p.on_end::text as on_end, p.timer_element_id::text as timer_element_id from studio.pause p`;

const AUDIO_SELECT = `select a.id::text as id, a.slide_id::text as slide_id, a.media_id::text as media_id, a.starts_at_s, a.duration_s,
       a.name, a.kind::text as kind, a.volume, m.name as media_name, m.mime_type as media_mime, m.s3_key as media_key
  from studio.audio_clip a join studio.media_asset m on m.id = a.media_id`;

const COMMENT_SELECT = `select c.id::text as id, c.slide_id::text as slide_id, c.author_sub, c.author_name, c.body,
       ${isoTimestamp('c.created_at')} as created_at
  from studio.slide_comment c`;
