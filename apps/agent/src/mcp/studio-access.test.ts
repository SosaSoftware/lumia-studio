import { describe, expect, it } from 'vitest';
import type { JSONValue } from '@strands-agents/sdk';
import { StudioAccess, targetOf } from './studio-access.ts';

const OPEN = ['knowledge'];

function granted(result: JSONValue): StudioAccess {
  const outcome = StudioAccess.fromToolResult(result);
  if (outcome.kind !== 'granted') throw new Error(`Expected access, got ${outcome.code}`);
  return outcome.access;
}

function answer(value: JSONValue): JSONValue {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

describe('targetOf', () => {
  it('reads the gateway target of a tool name', () => {
    expect(targetOf('studio-slides___add_slides')).toBe('studio-slides');
    expect(targetOf('confirm_change')).toBeNull();
    expect(targetOf('___tool')).toBeNull();
  });
});

describe('StudioAccess', () => {
  it('reads the tools from a text answer and from structured content', () => {
    expect(granted(answer({ tools: ['studio-read___get_class'] })).allows('studio-read___get_class', OPEN)).toBe(true);
    expect(granted({ content: [], structuredContent: { tools: ['studio-slides___add_slides'] } }).allows('studio-slides___add_slides', OPEN)).toBe(true);
  });

  it('shows Studio tools only when listed, open targets always, and nothing else', () => {
    const access = granted(answer({ tools: ['studio-read___get_class'] }));
    expect(access.allows('studio-read___get_class', OPEN)).toBe(true);
    expect(access.allows('studio-slides___delete_slide', OPEN)).toBe(false);
    expect(access.allows('knowledge___Retrieve', OPEN)).toBe(true);
    expect(access.allows('x_amz_bedrock_agentcore_search', OPEN)).toBe(false);
    expect(access.allows('other___tool', OPEN)).toBe(false);
    expect(StudioAccess.none().allows('studio-read___get_class', OPEN)).toBe(false);
  });

  it('reports the error of a failed call', () => {
    expect(StudioAccess.fromToolResult(answer({ error: { code: 'forbidden', message: 'no' } }))).toEqual({ kind: 'failed', code: 'forbidden', message: 'no' });
  });

  it('reports unexpected answers as unavailable', () => {
    const unexpected: JSONValue[] = [null, { content: 'x' }, { content: [{ type: 'text', text: 'not json' }] }, answer({ tools: 'x' }), { content: [], isError: true }];
    for (const result of unexpected) {
      expect(StudioAccess.fromToolResult(result)).toMatchObject({ kind: 'failed', code: 'unavailable' });
    }
  });
});
