import { reactive, watch } from 'vue';

export const PROPERTY_SECTIONS_KEY = 'lumia.studio.property-sections';

function readSections(storage: Storage = localStorage): Record<string, boolean> {
  try {
    const value: unknown = JSON.parse(storage.getItem(PROPERTY_SECTIONS_KEY) ?? '{}');
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'));
  } catch {
    // An unreadable value means every section opens as the layout says.
    return {};
  }
}

/**
 * Sections of the Properties panel that the person opened or closed, by section key, remembered in `localStorage`: a
 * preference of the person. A section without an entry opens as the layout says.
 */
export const propertySections = reactive<{ open: Record<string, boolean> }>({ open: readSections() });

watch(
  () => ({ ...propertySections.open }),
  (open) => {
    try {
      localStorage.setItem(PROPERTY_SECTIONS_KEY, JSON.stringify(open));
    } catch {
      // Not persisting the sections is harmless.
    }
  },
);
