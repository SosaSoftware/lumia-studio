import { randomUUID } from 'node:crypto';
import type { Database } from '../infrastructure/db/index.ts';

export interface PauseValues {
  startsAtS: number;
  durationS: number;
  message: string;
  onEnd: string;
  timerElementId: string | null;
}

export interface AudioValues {
  mediaId: string;
  startsAtS: number;
  durationS: number;
  name: string;
  kind: string;
  volume: number;
}

/** `pause`, `audio_clip` and `slide_comment`. */
export class TimelineRepository {
  public constructor(private readonly db: Database) {}

  public async insertPause(slideId: string, values: PauseValues): Promise<string> {
    const id = randomUUID();
    await this.db.execute(
      `insert into studio.pause (id, slide_id, starts_at_s, duration_s, message, on_end, timer_element_id)
       values (:id::uuid, :slideId::uuid, :startsAtS::numeric, :durationS::numeric, :message, :onEnd::studio.pause_end, :timerElementId::uuid)`,
      { id, slideId, ...values },
    );
    return id;
  }

  /** Returns the slide that owns the pause, or null when it does not exist. */
  public async pauseSlide(pauseId: string): Promise<string | null> {
    return this.owner('pause', pauseId);
  }

  public async updatePause(pauseId: string, values: PauseValues): Promise<void> {
    await this.db.execute(
      `update studio.pause set starts_at_s = :startsAtS::numeric, duration_s = :durationS::numeric, message = :message,
              on_end = :onEnd::studio.pause_end, timer_element_id = :timerElementId::uuid where id = :id::uuid`,
      { id: pauseId, ...values },
    );
  }

  public async deletePause(pauseId: string): Promise<void> {
    await this.db.execute('delete from studio.pause where id = :id::uuid', { id: pauseId });
  }

  /** Whether the element exists inside the slide. */
  public async elementInSlide(elementId: string, slideId: string): Promise<boolean> {
    const rows = await this.db.query<{ id: string }>(
      'select id::text as id from studio.slide_element where id = :elementId::uuid and slide_id = :slideId::uuid',
      { elementId, slideId },
    );
    return rows.length > 0;
  }

  public async insertAudio(slideId: string, values: AudioValues): Promise<string> {
    const id = randomUUID();
    await this.db.execute(
      `insert into studio.audio_clip (id, slide_id, media_id, starts_at_s, duration_s, name, kind, volume)
       values (:id::uuid, :slideId::uuid, :mediaId::uuid, :startsAtS::numeric, :durationS::numeric, :name,
               :kind::studio.audio_kind, :volume::numeric)`,
      { id, slideId, ...values },
    );
    return id;
  }

  public async audioSlide(audioClipId: string): Promise<string | null> {
    return this.owner('audio_clip', audioClipId);
  }

  public async updateAudio(audioClipId: string, values: AudioValues): Promise<void> {
    await this.db.execute(
      `update studio.audio_clip set media_id = :mediaId::uuid, starts_at_s = :startsAtS::numeric,
              duration_s = :durationS::numeric, name = :name, kind = :kind::studio.audio_kind, volume = :volume::numeric
        where id = :id::uuid`,
      { id: audioClipId, ...values },
    );
  }

  public async deleteAudio(audioClipId: string): Promise<void> {
    await this.db.execute('delete from studio.audio_clip where id = :id::uuid', { id: audioClipId });
  }

  public async insertComment(slideId: string, authorSub: string, authorName: string, body: string): Promise<string> {
    const id = randomUUID();
    await this.db.execute(
      `insert into studio.slide_comment (id, slide_id, author_sub, author_name, body)
       values (:id::uuid, :slideId::uuid, :authorSub, :authorName, :body)`,
      { id, slideId, authorSub, authorName, body },
    );
    return id;
  }

  public async deleteComment(commentId: string): Promise<void> {
    await this.db.execute('delete from studio.slide_comment where id = :id::uuid', { id: commentId });
  }

  /** `table` is a constant chosen by this class. */
  private async owner(table: 'pause' | 'audio_clip', id: string): Promise<string | null> {
    const rows = await this.db.query<{ slide_id: string }>(`select slide_id::text as slide_id from studio.${table} where id = :id::uuid`, { id });
    return rows[0]?.slide_id ?? null;
  }
}
