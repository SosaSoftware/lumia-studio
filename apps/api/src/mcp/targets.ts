import type { GatewayToolSchema } from './gateway-schema.ts';
import type { McpTarget } from './tool-definition.ts';
import { gatewayToolSchema } from './tool-definition.ts';
import { ELEMENT_TOOLS } from './tools/element-tools.ts';
import { NARRATION_TOOLS } from './tools/narration-tools.ts';
import { READ_TOOLS } from './tools/read-tools.ts';
import { SLIDE_TOOLS } from './tools/slide-tools.ts';
import { TRACK_TOOLS } from './tools/track-tools.ts';

export type { McpTarget } from './tool-definition.ts';

/** The Studio MCP: four Lambda functions, one per group of tools. */
export const MCP_TARGETS = {
  read: { name: 'studio-read', description: 'Lectura de Studio: acceso, árbol, clases, catálogo, medios y voces.', tools: READ_TOOLS },
  slides: { name: 'studio-slides', description: 'Diapositivas de una clase: agregar, cambiar, mover, duplicar y borrar.', tools: SLIDE_TOOLS },
  elements: { name: 'studio-elements', description: 'Componentes de una diapositiva: agregar, cambiar y borrar.', tools: ELEMENT_TOOLS },
  timeline: { name: 'studio-timeline', description: 'Línea de tiempo: narraciones, audios y pausas.', tools: [...NARRATION_TOOLS, ...TRACK_TOOLS] },
} as const satisfies Record<string, McpTarget>;

export type McpTargetKey = keyof typeof MCP_TARGETS;

/** Inline tool schema of a target, as the gateway target configuration takes it. */
export function toolSchemas(target: McpTarget): GatewayToolSchema[] {
  return target.tools.map(gatewayToolSchema);
}
