import { randomUUID } from 'node:crypto';
import type { Database } from '../infrastructure/db/index.ts';
import { SqlParam } from '../infrastructure/db/index.ts';

interface IdPair {
  old_id: string;
  new_id: string;
  position?: number;
}

/**
 * Copies slides with their elements, pauses, audio clips and narration clips (comments stay behind).
 * Narration clips keep pointing to the same stored audio: stored objects are never deleted.
 */
export class SlideCopier {
  public constructor(private readonly db: Database) {}

  /** Copies each slide of `sources` into `targetVersionId` at the given 1-based position. */
  public async copy(targetVersionId: string, sources: readonly { slideId: string; position: number }[]): Promise<string[]> {
    if (sources.length === 0) {
      return [];
    }
    const slideMap: IdPair[] = sources.map((source) => ({ old_id: source.slideId, new_id: randomUUID(), position: source.position }));
    const slideIds = SqlParam.json(slideMap);
    await this.db.execute(
      `insert into studio.slide (id, version_id, position, type, title, background, duration_s, transition, advance)
       select m.new_id, :targetVersionId::uuid, m.position, s.type, s.title, s.background, s.duration_s, s.transition, s.advance
         from studio.slide s
         join jsonb_to_recordset(:slideMap) as m(old_id uuid, new_id uuid, position smallint) on m.old_id = s.id`,
      { targetVersionId, slideMap: slideIds },
    );

    const elementRows = await this.db.query<{ id: string }>(
      `select e.id::text as id from studio.slide_element e
         join jsonb_to_recordset(:slideMap) as m(old_id uuid, new_id uuid, position smallint) on m.old_id = e.slide_id`,
      { slideMap: slideIds },
    );
    const elementMap: IdPair[] = elementRows.map((row) => ({ old_id: row.id, new_id: randomUUID() }));
    const elementIds = SqlParam.json(elementMap);
    await this.db.execute(
      `insert into studio.slide_element (id, slide_id, component, name, x, y, w, h, z, appears_at_s, entrance, props, media_id)
       select em.new_id, sm.new_id, e.component, e.name, e.x, e.y, e.w, e.h, e.z, e.appears_at_s, e.entrance, e.props, e.media_id
         from studio.slide_element e
         join jsonb_to_recordset(:slideMap) as sm(old_id uuid, new_id uuid, position smallint) on sm.old_id = e.slide_id
         join jsonb_to_recordset(:elementMap) as em(old_id uuid, new_id uuid) on em.old_id = e.id`,
      { slideMap: slideIds, elementMap: elementIds },
    );
    await this.db.execute(
      `insert into studio.pause (id, slide_id, starts_at_s, duration_s, message, on_end, timer_element_id)
       select gen_random_uuid(), sm.new_id, p.starts_at_s, p.duration_s, p.message, p.on_end, em.new_id
         from studio.pause p
         join jsonb_to_recordset(:slideMap) as sm(old_id uuid, new_id uuid, position smallint) on sm.old_id = p.slide_id
         left join jsonb_to_recordset(:elementMap) as em(old_id uuid, new_id uuid) on em.old_id = p.timer_element_id`,
      { slideMap: slideIds, elementMap: elementIds },
    );
    await this.db.execute(
      `insert into studio.audio_clip (id, slide_id, media_id, starts_at_s, duration_s, name, kind, volume)
       select gen_random_uuid(), sm.new_id, a.media_id, a.starts_at_s, a.duration_s, a.name, a.kind, a.volume
         from studio.audio_clip a
         join jsonb_to_recordset(:slideMap) as sm(old_id uuid, new_id uuid, position smallint) on sm.old_id = a.slide_id`,
      { slideMap: slideIds },
    );
    await this.db.execute(
      `insert into studio.narration_clip (id, slide_id, starts_at_s, script, voice, speed, generated_duration_s, audio_key,
                                          speech_marks_key, status, error_message)
       select gen_random_uuid(), sm.new_id, n.starts_at_s, n.script, n.voice, n.speed, n.generated_duration_s, n.audio_key,
              n.speech_marks_key, n.status, n.error_message
         from studio.narration_clip n
         join jsonb_to_recordset(:slideMap) as sm(old_id uuid, new_id uuid, position smallint) on sm.old_id = n.slide_id`,
      { slideMap: slideIds },
    );
    return slideMap.map((pair) => pair.new_id);
  }
}
