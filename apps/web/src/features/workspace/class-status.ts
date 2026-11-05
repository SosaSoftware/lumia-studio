import type { ClassDocument, DocumentStatus } from '../../api/types.ts';

export const STATUS_LABELS: Readonly<Record<DocumentStatus, string>> = {
  no_content: 'Sin contenido',
  draft: 'Borrador',
  published: 'Publicada',
};

export interface ClassStatusInput {
  hasClass: boolean;
  document: ClassDocument | null;
  slideCount: number;
  canPublish: boolean;
  /** Why the editor is read-only now (Lumi is working on the class); publishing waits too. */
  lockedReason?: string | null;
}

/** What the top bar shows for the open class: status, version and the state of Vista previa and Publicar. */
export interface ClassStatusView {
  status: DocumentStatus;
  statusLabel: string;
  versionLabel: string | null;
  versionTip: string;
  previewDisabled: boolean;
  previewTip: string;
  publishDisabled: boolean;
  publishTip: string;
}

/** Applies the states and texts of the class editor spec. */
export function describeClass(input: ClassStatusInput): ClassStatusView {
  const version = input.document?.editingVersion ?? null;
  const status: DocumentStatus = version === null ? 'no_content' : version.status === 'published' ? 'published' : 'draft';
  const number = version?.number ?? 0;
  const published = input.document?.publishedVersion ?? null;
  const hasContent = input.slideCount > 0;

  let versionTip = '';
  if (version !== null) {
    versionTip =
      status === 'draft'
        ? published === null
          ? `Versión ${String(number)} en borrador`
          : `Versión ${String(number)} en borrador · la versión ${String(published)} está publicada`
        : `Versión ${String(number)} publicada`;
  }

  let previewTip = 'Ver la clase como la verán los estudiantes';
  if (!input.hasClass) previewTip = 'Abre una clase para ver su vista previa';
  else if (!hasContent) previewTip = 'La clase todavía no tiene contenido';

  let publishTip = `Publicar la versión ${String(number)}`;
  if (!input.hasClass) publishTip = 'Abre una clase para publicarla';
  else if (!input.canPublish) publishTip = 'No tienes permiso para publicar';
  else if (input.lockedReason) publishTip = input.lockedReason;
  else if (status === 'published') publishTip = 'No hay cambios por publicar';
  else if (!hasContent) publishTip = 'La clase todavía no tiene contenido';

  return {
    status,
    statusLabel: STATUS_LABELS[status],
    versionLabel: version === null ? null : `v${String(number)}`,
    versionTip,
    previewDisabled: !input.hasClass || !hasContent,
    previewTip,
    publishDisabled: !input.hasClass || !input.canPublish || Boolean(input.lockedReason) || status !== 'draft' || !hasContent,
    publishTip,
  };
}
