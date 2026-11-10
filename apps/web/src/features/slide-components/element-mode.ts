import type { MediaRef } from '../../api/types.ts';

/** `edit` renders static content for the canvas and thumbnails; `student` adds the interactions of the preview. */
export type ElementMode = 'edit' | 'student';

/** Props every catalog component receives from `CatalogElement`. */
export interface CatalogComponentProps {
  /** Props of the element, validated by the catalog schema on the server. */
  data: Record<string, unknown>;
  mode: ElementMode;
  /** Medium of `props.mediaId`, resolved by the API. */
  media: MediaRef | null;
  /** Id of the element, to find it among its siblings in the slide context. */
  elementId: string;
  /** True while the element is selected in the editor; components may reveal content that is hidden at rest. */
  selected: boolean;
  /** True on the editor canvas only: components draw design aids, such as the space of a feedback message, that thumbnails and the preview do not show. */
  design?: boolean;
  /** True when the person hid the design aids: they keep their space, so the layout does not change, but are not drawn. */
  designHidden?: boolean;
}
