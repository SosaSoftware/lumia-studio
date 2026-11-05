import { randomUUID } from 'node:crypto';
import type { Database } from '../infrastructure/db/index.ts';
import { SqlParam } from '../infrastructure/db/index.ts';

export interface ElementRecord {
  id: string;
  slideId: string;
  component: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  appearsAtS: number;
  entrance: string;
  mediaId: string | null;
}

export interface ElementValues {
  component: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  appearsAtS: number;
  entrance: string;
  props: Record<string, unknown>;
  mediaId: string | null;
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
  media_id: string | null;
}

/** `slide_element`. */
export class ElementRepository {
  public constructor(private readonly db: Database) {}

  public async find(elementId: string): Promise<ElementRecord | null> {
    const rows = await this.db.query<ElementRow>(
      `select id::text as id, slide_id::text as slide_id, component, name, x, y, w, h, z, appears_at_s,
              entrance::text as entrance, media_id::text as media_id
         from studio.slide_element where id = :id::uuid`,
      { id: elementId },
    );
    const row = rows[0];
    return row === undefined
      ? null
      : {
          id: row.id, slideId: row.slide_id, component: row.component, name: row.name,
          x: row.x, y: row.y, w: row.w, h: row.h, z: row.z, appearsAtS: row.appears_at_s,
          entrance: row.entrance, mediaId: row.media_id,
        };
  }

  /** Props of an element, to merge partial updates. */
  public async propsOf(elementId: string): Promise<Record<string, unknown>> {
    const rows = await this.db.query<{ props: unknown }>('select props from studio.slide_element where id = :id::uuid', { id: elementId });
    const props = rows[0]?.props;
    const value = typeof props === 'string' ? (JSON.parse(props) as unknown) : props;
    return typeof value === 'object' && value !== null ? Object.fromEntries(Object.entries(value)) : {};
  }

  public async nextZ(slideId: string): Promise<number> {
    const rows = await this.db.query<{ next: number }>(
      'select coalesce(max(z), -1) + 1 as next from studio.slide_element where slide_id = :slideId::uuid',
      { slideId },
    );
    return rows[0]?.next ?? 0;
  }

  public async insert(slideId: string, values: ElementValues): Promise<string> {
    const id = randomUUID();
    await this.db.execute(
      `insert into studio.slide_element (id, slide_id, component, name, x, y, w, h, z, appears_at_s, entrance, props, media_id)
       values (:id::uuid, :slideId::uuid, :component, :name, :x::numeric, :y::numeric, :w::numeric, :h::numeric, :z,
               :appearsAtS::numeric, :entrance::studio.entrance, :props, :mediaId::uuid)`,
      { id, slideId, ...ElementRepository.params(values) },
    );
    return id;
  }

  public async update(elementId: string, values: ElementValues): Promise<void> {
    await this.db.execute(
      `update studio.slide_element set component = :component, name = :name, x = :x::numeric, y = :y::numeric,
              w = :w::numeric, h = :h::numeric, z = :z, appears_at_s = :appearsAtS::numeric,
              entrance = :entrance::studio.entrance, props = :props, media_id = :mediaId::uuid
        where id = :id::uuid`,
      { id: elementId, ...ElementRepository.params(values) },
    );
  }

  public async delete(elementId: string): Promise<void> {
    await this.db.execute('delete from studio.slide_element where id = :id::uuid', { id: elementId });
  }

  private static params(values: ElementValues): Record<string, string | number | boolean | null | SqlParam> {
    return {
      component: values.component,
      name: values.name,
      x: values.x,
      y: values.y,
      w: values.w,
      h: values.h,
      z: values.z,
      appearsAtS: values.appearsAtS,
      entrance: values.entrance,
      props: SqlParam.json(values.props),
      mediaId: values.mediaId,
    };
  }
}
