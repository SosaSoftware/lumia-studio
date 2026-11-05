import { describe, expect, it } from 'vitest';
import type { GatewaySchema } from './gateway-schema.ts';
import { STUDIO_TOKEN_ARGUMENT, STUDIO_TOKEN_HEADER, readInvocation } from './gateway-invocation.ts';
import { MCP_TARGETS, toolSchemas } from './targets.ts';

const ALLOWED_KEYS = new Set(['type', 'description', 'properties', 'required', 'items']);
const ALLOWED_TYPES = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean']);

function problems(schema: GatewaySchema, path: string): string[] {
  const found: string[] = [];
  for (const key of Object.keys(schema)) if (!ALLOWED_KEYS.has(key)) found.push(`${path}: key ${key}`);
  if (!ALLOWED_TYPES.has(schema.type)) found.push(`${path}: type ${schema.type}`);
  const names = Object.keys(schema.properties ?? {});
  for (const name of schema.required ?? []) if (!names.includes(name)) found.push(`${path}: required ${name} is not a property`);
  for (const [name, child] of Object.entries(schema.properties ?? {})) found.push(...problems(child, `${path}.${name}`));
  if (schema.items !== undefined) found.push(...problems(schema.items, `${path}[]`));
  return found;
}

describe('gateway invocation', () => {
  it('reads the tool name without the target prefix, the arguments and the token of the person', () => {
    const invocation = readInvocation(
      { nodeId: 'n-1' },
      { clientContext: { custom: { bedrockAgentCoreToolName: 'studio-read___get_class', bedrockAgentCorePropagatedHeaders: { [STUDIO_TOKEN_HEADER.toLowerCase()]: 'Bearer abc.def.ghi' } } } },
    );
    expect(invocation).toEqual({ toolName: 'get_class', args: { nodeId: 'n-1' }, token: 'abc.def.ghi' });
  });

  it('has no token when the gateway does not send the header, and accepts the capitalized client context', () => {
    expect(readInvocation({}, { clientContext: { Custom: { bedrockAgentCoreToolName: 'get_slide' } } })).toEqual({ toolName: 'get_slide', args: {}, token: null });
    expect(readInvocation(null, {})).toEqual({ toolName: '', args: {}, token: null });
  });

  it('takes the token from the reserved argument when no header arrives, and removes it from the arguments', () => {
    const invocation = readInvocation({ nodeId: 'n-1', [STUDIO_TOKEN_ARGUMENT]: 'abc.def.ghi' }, { clientContext: { custom: { bedrockAgentCoreToolName: 'studio-read___get_class' } } });
    expect(invocation).toEqual({ toolName: 'get_class', args: { nodeId: 'n-1' }, token: 'abc.def.ghi' });
  });
});

describe('gateway tool schemas', () => {
  const targets = Object.values(MCP_TARGETS);

  it('exposes the agreed 23 tools in four targets, with unique snake_case names', () => {
    const names = targets.flatMap((target) => target.tools.map((tool) => tool.name));
    expect(targets.map((target) => target.name)).toEqual(['studio-read', 'studio-slides', 'studio-elements', 'studio-timeline']);
    expect(names).toHaveLength(23);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z]+(_[a-z]+)*$/);
  });

  it('uses only the JSON Schema subset of Lambda targets and never asks the model for a token', () => {
    for (const target of targets) {
      for (const tool of toolSchemas(target)) {
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.description.length).toBeGreaterThan(20);
        expect(problems(tool.inputSchema, `${target.name}.${tool.name}`)).toEqual([]);
        expect(JSON.stringify(tool.inputSchema)).not.toMatch(/"(authorization|token|accessToken|idToken)"/i);
      }
    }
  });

  it('asks for confirm_change before every delete', () => {
    const deletes = targets.flatMap((target) => target.tools).filter((tool) => tool.name.startsWith('delete_'));
    expect(deletes.map((tool) => tool.name).sort()).toEqual(['delete_audio_clip', 'delete_element', 'delete_narration', 'delete_pause', 'delete_slide']);
    for (const tool of deletes) expect(tool.description).toContain('confirm_change');
  });

  it('writes the allowed values and the defaults in the descriptions', () => {
    const update = toolSchemas(MCP_TARGETS.slides).find((tool) => tool.name === 'update_slide');
    expect(update?.inputSchema.properties?.transition?.description).toContain('Valores: "none", "fade", "slide", "zoom".');
    expect(update?.inputSchema.required).toEqual(['nodeId', 'slideId']);
    const voices = toolSchemas(MCP_TARGETS.timeline).find((tool) => tool.name === 'save_narration');
    expect(voices?.inputSchema.properties?.voice?.type).toBe('string');
  });
});
