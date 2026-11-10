import { reactive } from 'vue';
import { t } from '../i18n/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import { can } from './app-context.ts';

/** Message key of why the editor is read-only right now; null when the person can edit as their role allows. */
export const editLock = reactive<{ reason: MessageKey | null }>({ reason: null });

export const LUMI_WORKING: MessageKey = 'lumi.working';

/** While Lumi works on the class the editor is read-only, so autosave and Lumi do not overwrite each other. */
export function lockEditing(reason: MessageKey): void {
  editLock.reason = reason;
}

export function unlockEditing(): void {
  editLock.reason = null;
}

/** Whether the person may make this change now: their role allows it and the editor is not locked. */
export function canChange(action: string): boolean {
  return editLock.reason === null && can(action);
}

/** What a disabled control says: the lock first, otherwise the permission it lacks. */
export function changeDenial(permission: MessageKey): string {
  return t(editLock.reason ?? permission);
}
