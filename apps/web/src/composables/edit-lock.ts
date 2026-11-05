import { reactive } from 'vue';
import { can } from './app-context.ts';

/** Why the editor is read-only right now; null when the person can edit as their role allows. */
export const editLock = reactive<{ reason: string | null }>({ reason: null });

export const LUMI_WORKING = 'Lumi está trabajando en la clase. Espera a que termine.';

/** While Lumi works on the class the editor is read-only, so autosave and Lumi do not overwrite each other. */
export function lockEditing(reason: string): void {
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
export function changeDenial(permission: string): string {
  return editLock.reason ?? permission;
}
