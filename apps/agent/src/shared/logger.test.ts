import { describe, expect, it } from 'vitest';
import { LibraryLogBridge } from './library-log-bridge.ts';
import { JsonLogger } from './logger.ts';

function capture(): { lines: Record<string, unknown>[]; sink: (line: string) => void } {
  const lines: Record<string, unknown>[] = [];
  return {
    lines,
    sink: (line) => {
      const parsed: unknown = JSON.parse(line);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) lines.push(Object.fromEntries(Object.entries(parsed)));
    },
  };
}

describe('JsonLogger', () => {
  it('writes one JSON object per line with the fields of the logger and of the line', () => {
    const { lines, sink } = capture();
    new JsonLogger('info', { service: 'lumi' }, sink).child({ component: 'threads' }).info('Ready', { threadKey: 'k' });
    expect(lines).toEqual([expect.objectContaining({ level: 'info', message: 'Ready', service: 'lumi', component: 'threads', threadKey: 'k' })]);
    expect(typeof lines[0]?.time).toBe('string');
  });

  it('drops lines below its level', () => {
    const { lines, sink } = capture();
    const logger = new JsonLogger('warn', {}, sink);
    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');
    expect(lines.map((line) => line.message)).toEqual(['c', 'd']);
  });

  it('serializes errors and survives circular fields', () => {
    const { lines, sink } = capture();
    const logger = new JsonLogger('info', {}, sink);
    logger.error('Failed', { error: new TypeError('boom') });
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    logger.info('Circular', { circular });
    expect(lines[0]?.error).toMatchObject({ name: 'TypeError', message: 'boom' });
    expect(lines[1]?.message).toBe('Circular');
    expect(typeof lines[1]?.logError).toBe('string');
  });
});

describe('LibraryLogBridge', () => {
  it('keeps the message and moves the other values to details', () => {
    const { lines, sink } = capture();
    const bridge = new LibraryLogBridge(new JsonLogger('debug', {}, sink));
    bridge.warn('tool failed', 'tool-x', 3);
    bridge.info({ odd: true });
    expect(lines[0]).toMatchObject({ level: 'warn', message: 'tool failed', details: ['tool-x', 3] });
    expect(lines[1]).toMatchObject({ level: 'info', message: 'library log', details: [{ odd: true }] });
  });
});
