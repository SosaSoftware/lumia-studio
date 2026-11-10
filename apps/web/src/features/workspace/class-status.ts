import type { ClassDocument, DocumentStatus } from '../../api/types.ts';
import { t } from '../../i18n/index.ts';

/** Label of a document status in the current language. */
export function statusLabel(status: DocumentStatus): string {
  return t(`workspace.status.${status}`);
}

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
          ? t('workspace.version.draft', { number })
          : t('workspace.version.draftWithPublished', { number, published })
        : t('workspace.version.published', { number });
  }

  let previewTip = t('workspace.previewTip.ready');
  if (!input.hasClass) previewTip = t('workspace.previewTip.noClass');
  else if (!hasContent) previewTip = t('workspace.previewTip.noContent');

  let publishTip = t('workspace.publishTip.ready', { number });
  if (!input.hasClass) publishTip = t('workspace.publishTip.noClass');
  else if (!input.canPublish) publishTip = t('workspace.publishTip.noPermission');
  else if (input.lockedReason) publishTip = input.lockedReason;
  else if (status === 'published') publishTip = t('workspace.publishTip.nothingToPublish');
  else if (!hasContent) publishTip = t('workspace.publishTip.noContent');

  return {
    status,
    statusLabel: statusLabel(status),
    versionLabel: version === null ? null : `v${String(number)}`,
    versionTip,
    previewDisabled: !input.hasClass || !hasContent,
    previewTip,
    publishDisabled: !input.hasClass || !input.canPublish || Boolean(input.lockedReason) || status !== 'draft' || !hasContent,
    publishTip,
  };
}
