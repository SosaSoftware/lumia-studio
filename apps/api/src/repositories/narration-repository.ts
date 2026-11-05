import { randomUUID } from 'node:crypto';
import type { Database } from '../infrastructure/db/index.ts';

export interface NarrationValues {
  startsAtS: number;
  script: string;
  /** Polly voice id; null until the person picks one. */
  voice: string | null;
  speed: number;
}

/** `narration_clip`. */
export class NarrationRepository {
  public constructor(private readonly db: Database) {}

  /** Creates the clip in `generating` state and returns its id; generation always has a voice. */
  public async insertGenerating(slideId: string, values: NarrationValues & { voice: string }): Promise<string> {
    const id = randomUUID();
    await this.db.execute(
      `insert into studio.narration_clip (id, slide_id, starts_at_s, script, voice, speed, status)
       values (:id::uuid, :slideId::uuid, :startsAtS::numeric, :script, :voice, :speed::numeric, 'generating')`,
      { id, slideId, ...values },
    );
    return id;
  }

  /** Creates a clip that has no voice yet and returns its id. */
  public async insertPending(slideId: string, values: NarrationValues): Promise<string> {
    const id = randomUUID();
    await this.db.execute(
      `insert into studio.narration_clip (id, slide_id, starts_at_s, script, voice, speed, status)
       values (:id::uuid, :slideId::uuid, :startsAtS::numeric, :script, :voice, :speed::numeric, 'pending')`,
      { id, slideId, ...values },
    );
    return id;
  }

  /** Replaces the text and settings; the previous voice no longer matches, so the clip goes back to `pending`. */
  public async resetToPending(clipId: string, values: NarrationValues): Promise<void> {
    await this.db.execute(
      `update studio.narration_clip
          set starts_at_s = :startsAtS::numeric, script = :script, voice = :voice, speed = :speed::numeric,
              status = 'pending', error_message = null, audio_key = null, speech_marks_key = null, generated_duration_s = 0
        where id = :id::uuid`,
      { id: clipId, ...values },
    );
  }

  /** Changes when the clip starts and how fast it plays; the generated voice stays valid. */
  public async updateTiming(clipId: string, startsAtS: number, speed: number): Promise<void> {
    await this.db.execute(
      'update studio.narration_clip set starts_at_s = :startsAtS::numeric, speed = :speed::numeric where id = :id::uuid',
      { id: clipId, startsAtS, speed },
    );
  }

  public async delete(clipId: string): Promise<void> {
    await this.db.execute('delete from studio.narration_clip where id = :id::uuid', { id: clipId });
  }

  /** Replaces the text and settings and discards the previous audio; generation always has a voice. */
  public async resetToGenerating(clipId: string, values: NarrationValues & { voice: string }): Promise<void> {
    await this.db.execute(
      `update studio.narration_clip
          set starts_at_s = :startsAtS::numeric, script = :script, voice = :voice, speed = :speed::numeric,
              status = 'generating', error_message = null, audio_key = null, speech_marks_key = null, generated_duration_s = 0
        where id = :id::uuid`,
      { id: clipId, ...values },
    );
  }

  public async markReady(clipId: string, audioKey: string, speechMarksKey: string, durationS: number): Promise<void> {
    await this.db.execute(
      `update studio.narration_clip
          set status = 'ready', audio_key = :audioKey, speech_marks_key = :speechMarksKey,
              generated_duration_s = :durationS::numeric, error_message = null
        where id = :id::uuid`,
      { id: clipId, audioKey, speechMarksKey, durationS },
    );
  }

  public async markFailed(clipId: string, message: string): Promise<void> {
    await this.db.execute(
      "update studio.narration_clip set status = 'failed', error_message = :message where id = :id::uuid",
      { id: clipId, message },
    );
  }
}
