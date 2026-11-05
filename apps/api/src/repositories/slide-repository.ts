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
  type: string;
  title: string;
  background: string;
  durationS: number;
  transition: string;
  advance: string;
}

export interface SlideChanges {
  type?: string;
  title?: string;
  background?: string;
  durationS?: number;
  transition?: string;
  advance?: string;
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
      `insert into studio.slide (id, version_id, position, type, title, background, duration_s, transition, advance)
       values (:id::uuid, :versionId::uuid, :position, :type::studio.slide_type, :title, :background, :durationS::numeric,
               :transition::studio.transition, :advance::studio.advance_mode)`,
      { id, ...slide },
    );
    return id;
  }

  public async update(slideId: string, changes: SlideChanges): Promise<void> {
    await this.db.execute(
      `update studio.slide set
          type = coalesce(:type::studio.slide_type, type),
          title = coalesce(:title, title),
          background = coalesce(:background, background),
          duration_s = coalesce(:durationS::numeric, duration_s),
          transition = coalesce(:transition::studio.transition, transition),
          advance = coalesce(:advance::studio.advance_mode, advance)
        where id = :id::uuid`,
      {
        id: slideId,
        type: changes.type ?? null,
        title: changes.title ?? null,
        background: changes.background ?? null,
        durationS: changes.durationS ?? null,
        transition: changes.transition ?? null,
        advance: changes.advance ?? null,
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
