import { reactive } from 'vue';

/** Element fields whose inputs carry a `prop-<name>` test id, by that name. */
const ELEMENT_FIELD_IDS: Readonly<Record<string, string>> = { name: 'name', x: 'x', y: 'y', w: 'w', h: 'h', entrance: 'entrance', appears: 'appearsAtS' };

/**
 * Last field of the Properties panel that the person focused, with its section and element. Lumi reads it from the
 * screen context, so "change this" can refer to the field the person was editing before writing to Lumi.
 */
export const propertiesFocus = reactive<{ elementId: string | null; field: string | null; section: string | null }>({ elementId: null, field: null, section: null });

/** Field path of a focused control: `options.0.text` for a prop, `x` or `entrance` for an element field. */
function fieldOf(target: Element): string | null {
  const schemaField = target.closest('[data-testid^="schema-field-"]')?.getAttribute('data-testid');
  if (schemaField !== undefined && schemaField !== null) return schemaField.slice('schema-field-'.length);
  const testId = target.closest('[data-testid^="prop-"]')?.getAttribute('data-testid') ?? '';
  const name = /^prop-([a-z]+)$/.exec(testId)?.[1];
  return name === undefined ? null : (ELEMENT_FIELD_IDS[name] ?? null);
}

/** Records the field that received focus inside the panel of `elementId`. */
export function trackPropertiesFocus(event: FocusEvent, elementId: string | null): void {
  const target = event.target;
  if (!(target instanceof Element) || elementId === null) return;
  const field = fieldOf(target);
  if (field === null) return;
  const section = target.closest('[data-testid^="prop-section-"]')?.getAttribute('data-testid')?.slice('prop-section-'.length) ?? null;
  propertiesFocus.elementId = elementId;
  propertiesFocus.field = field;
  propertiesFocus.section = section;
}
