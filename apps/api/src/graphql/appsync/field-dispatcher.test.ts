import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../shared/errors/index.ts';
import type { AppSyncResolverEvent } from './appsync-event.ts';
import { FieldDispatcher } from './field-dispatcher.ts';
import type { FieldCommand } from './field-command.ts';

const event = (type: string, field: string): AppSyncResolverEvent => ({
  arguments: { id: '1' },
  identity: null,
  source: null,
  info: { fieldName: field, parentTypeName: type },
  request: { headers: {} },
});

describe('FieldDispatcher', () => {
  it('dispatches by Type.field', async () => {
    const command: FieldCommand = { execute: vi.fn().mockResolvedValue({ ok: true }) };
    const dispatcher = new FieldDispatcher(new Map([['Query.document', command]]));
    await expect(dispatcher.dispatch(event('Query', 'document'))).resolves.toEqual({ ok: true });
  });

  it('passes AppError through unchanged', async () => {
    const error = AppError.conflict('x');
    const dispatcher = new FieldDispatcher(new Map([['Mutation.a', { execute: () => Promise.reject(error) }]]));
    await expect(dispatcher.dispatch(event('Mutation', 'a'))).rejects.toBe(error);
  });

  it('hides internal error details', async () => {
    const dispatcher = new FieldDispatcher(
      new Map([['Mutation.a', { execute: () => Promise.reject(new Error('password=secret')) }]]),
    );
    const failure = await dispatcher.dispatch(event('Mutation', 'a')).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(AppError);
    expect((failure as Error).message).not.toContain('secret');
  });

  it('rejects unknown fields with a generic error', async () => {
    const dispatcher = new FieldDispatcher(new Map());
    await expect(dispatcher.dispatch(event('Query', 'nope'))).rejects.toBeInstanceOf(AppError);
  });
});
