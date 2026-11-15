import { randomUUID } from 'node:crypto';
import type { Database } from '../infrastructure/db/index.ts';

export interface SlideRecord {
  id: string;
  versionId: string;
  position: number;
}

export interface NewSlide {
  versionId: string;
  position: number;
  title: string;
  background: string;
  durationS: number;
  transition: string;
  unlock: string;
  startMode: string;
}

/** How a slide moves on and starts, and the buttons it uses for that. */
export interface SlideBehavior {
  unlock: string;
  startMode: string;
  startElementId: string | null;
  unlockElementId: string | null;
}

/** Changes of a slide. An absent field keeps its value; a null button reference clears it. */
export interface SlideChanges {
  title?: string;
  background?: string;
  durationS?: number;
  transition?: string;
  unlock?: string;
  startMode?: string;
  startElementId?: string | null;
  unlockElementId?: string | null;
}

/** `slide`. Positions are 1-based and consecutive inside a version; the unique constraint is deferred to the commit. */
export class SlideRepository {
  public constructor(private readonly db: Database) {}

  public async find(slideId: string): Promise<SlideRecord | null> {
    const rows = await this.db.query<{ id: string; version_id: string; position: number }>(
      'select id::text as id, version_id::text as version_id, position from studio.slide where id = :id::uuid',
      { id: slideId },
    );
    const row = rows[0];
    return row === undefined ? null : { id: row.id, versionId: row.version_id, position: row.position };
  }

  /** Rule of the Next button, way of starting and buttons of the slide, as stored. */
  public async behavior(slideId: string): Promise<SlideBehavior> {
    const rows = await this.db.query<{ unlock: string; start_mode: string; start_element_id: string | null; unlock_element_id: string | null }>(
      `select unlock::text as unlock, start_mode::text as start_mode, start_element_id::text as start_element_id,
              unlock_element_id::text as unlock_element_id
         from studio.slide where id = :id::uuid`,
      { id: slideId },
    );
    const row = rows[0];
    return {
      unlock: row?.unlock ?? 'always',
      startMode: row?.start_mode ?? 'auto',
      startElementId: row?.start_element_id ?? null,
      unlockElementId: row?.unlock_element_id ?? null,
    };
  }

  /** Slide ids of a version in position order. */
  public async orderedIds(versionId: string): Promise<string[]> {
    const rows = await this.db.query<{ id: string }>(
      'select id::text as id from studio.slide where version_id = :versionId::uuid order by position',
      { versionId },
    );
    return rows.map((row) => row.id);
  }

  public async insert(slide: NewSlide): Promise<string> {
    const id = randomUUID();
    await this.db.execute(
      `insert into studio.slide (id, version_id, position, title, background, duration_s, transition, unlock, start_mode)
       values (:id::uuid, :versionId::uuid, :position, :title, :background, :durationS::numeric,
               :transition::studio.transition, :unlock::studio.next_unlock, :startMode::studio.start_mode)`,
      { id, ...slide },
    );
    return id;
  }

  public async update(slideId: string, changes: SlideChanges): Promise<void> {
    await this.db.execute(
      `update studio.slide set
          title = coalesce(:title, title),
          background = coalesce(:background, background),
          duration_s = coalesce(:durationS::numeric, duration_s),
          transition = coalesce(:transition::studio.transition, transition),
          unlock = coalesce(:unlock::studio.next_unlock, unlock),
          start_mode = coalesce(:startMode::studio.start_mode, start_mode),
          start_element_id = case when :setStartElement::boolean then :startElementId::uuid else start_element_id end,
          unlock_element_id = case when :setUnlockElement::boolean then :unlockElementId::uuid else unlock_element_id end
        where id = :id::uuid`,
      {
        id: slideId,
        title: changes.title ?? null,
        background: changes.background ?? null,
        durationS: changes.durationS ?? null,
        transition: changes.transition ?? null,
        unlock: changes.unlock ?? null,
        startMode: changes.startMode ?? null,
        setStartElement: changes.startElementId !== undefined,
        startElementId: changes.startElementId ?? null,
        setUnlockElement: changes.unlockElementId !== undefined,
        unlockElementId: changes.unlockElementId ?? null,
      },
    );
  }

  /** Opens a gap of `size` positions after `afterPosition`. */
  public async openGap(versionId: string, afterPosition: number, size: number): Promise<void> {
    await this.db.execute(
      `update studio.slide set position = position + :size
        where version_id = :versionId::uuid and position > :afterPosition`,
      { versionId, afterPosition, size },
    );
  }

  /** Applies the given order: position `n` goes to the n-th id. */
  public async applyOrder(slideIds: readonly string[]): Promise<void> {
    for (const [index, id] of slideIds.entries()) {
      await this.db.execute('update studio.slide set position = :position where id = :id::uuid', {
        id,
        position: index + 1,
      });
    }
  }

  public async delete(slideId: string): Promise<void> {
    await this.db.execute('delete from studio.slide where id = :id::uuid', { id: slideId });
  }
}
