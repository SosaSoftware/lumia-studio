import { describe, expect, it } from 'vitest';
import { Agent } from '@strands-agents/sdk';
import type { Caller } from '../identity/caller.ts';
import { JsonLogger } from '../shared/logger.ts';
import { ScriptedModel } from '../../test/support/scripted-model.ts';
import type { ThreadAgent, ThreadAgentFactory } from './thread-registry.ts';
import { ThreadCapacityError, ThreadRegistry } from './thread-registry.ts';

const quiet = new JsonLogger('error', {}, () => undefined);
const ana: Caller = { sub: 'ana', token: 'ana-token-1' };
const beto: Caller = { sub: 'beto', token: 'beto-token-1' };

class Factory {
  public readonly built: { caller: Caller; threadId: string }[] = [];
  public readonly disposed: string[] = [];
  public failNext: Error | null = null;

  public readonly create: ThreadAgentFactory = async (request) => {
    await Promise.resolve();
    if (this.failNext !== null) {
      const failure = this.failNext;
      this.failNext = null;
      throw failure;
    }
    this.built.push(request);
    const label = `${request.caller.token}/${request.threadId}`;
    const thread: ThreadAgent = {
      agent: new Agent({ model: new ScriptedModel([]), printer: false }),
      pendingFrontendCalls: () => [],
      dispose: () => {
        this.disposed.push(label);
        return Promise.resolve();
      },
    };
    return thread;
  };
}

function registry(factory: Factory, options: { maxThreads?: number; now?: () => number } = {}): ThreadRegistry {
  return new ThreadRegistry(factory.create, quiet, { idleMinutes: 30, maxThreads: options.maxThreads ?? 10, ...(options.now === undefined ? {} : { now: options.now }) });
}

describe('ThreadRegistry', () => {
  it('builds one agent per conversation and reuses it', async () => {
    const factory = new Factory();
    const threads = registry(factory);
    const first = await threads.acquire(ana, 'thread-1');
    first.release();
    const again = await threads.acquire(ana, 'thread-1');
    expect(again.thread).toBe(first.thread);
    expect(factory.built).toHaveLength(1);
    expect(threads.agentsByThread.get(first.threadKey)).toBe(first.thread.agent);
    await threads.close();
  });

  it('keeps people apart when they send the same thread id', async () => {
    const factory = new Factory();
    const threads = registry(factory);
    const forAna = await threads.acquire(ana, 'same-thread');
    const forBeto = await threads.acquire(beto, 'same-thread');
    expect(forAna.threadKey).not.toBe(forBeto.threadKey);
    expect(forAna.threadKey.endsWith('.same-thread')).toBe(true);
    expect(forAna.thread).not.toBe(forBeto.thread);
    await threads.close();
  });

  it('shares one creation between concurrent requests', async () => {
    const factory = new Factory();
    const threads = registry(factory);
    const [one, two] = await Promise.all([threads.acquire(ana, 'thread-1'), threads.acquire(ana, 'thread-1')]);
    expect(one.thread).toBe(two.thread);
    expect(factory.built).toHaveLength(1);
    await threads.close();
  });

  it('rebuilds the agent when the token changes and releases the old one', async () => {
    const factory = new Factory();
    const threads = registry(factory);
    (await threads.acquire(ana, 'thread-1')).release();
    const renewed = await threads.acquire({ ...ana, token: 'ana-token-2' }, 'thread-1');
    expect(factory.built.map((request) => request.caller.token)).toEqual(['ana-token-1', 'ana-token-2']);
    expect(factory.disposed).toEqual(['ana-token-1/thread-1']);
    expect(threads.agentsByThread.get(renewed.threadKey)).toBe(renewed.thread.agent);
    await threads.close();
  });

  it('keeps an agent that is lent to a request even if the token changes', async () => {
    const factory = new Factory();
    const threads = registry(factory);
    const lent = await threads.acquire(ana, 'thread-1');
    const other = await threads.acquire({ ...ana, token: 'ana-token-2' }, 'thread-1');
    expect(other.thread).toBe(lent.thread);
    expect(factory.built).toHaveLength(1);
    await threads.close();
  });

  it('retries the creation after a failure', async () => {
    const factory = new Factory();
    const threads = registry(factory);
    factory.failNext = new Error('MCP down');
    await expect(threads.acquire(ana, 'thread-1')).rejects.toThrow('MCP down');
    expect(threads.agentsByThread.size).toBe(0);
    await threads.acquire(ana, 'thread-1');
    expect(factory.built).toHaveLength(1);
    await threads.close();
  });

  it('releases idle agents that are not lent', async () => {
    let now = 0;
    const factory = new Factory();
    const threads = registry(factory, { now: () => now });
    (await threads.acquire(ana, 'idle')).release();
    await threads.acquire(ana, 'busy');
    now = 31 * 60_000;
    await threads.evictIdle();
    expect(factory.disposed).toEqual(['ana-token-1/idle']);
    expect([...threads.agentsByThread.keys()].some((key) => key.endsWith('.busy'))).toBe(true);
    await threads.close();
  });

  it('frees the least recently used slot when full, and refuses when every slot is lent', async () => {
    let now = 0;
    const factory = new Factory();
    const threads = registry(factory, { maxThreads: 2, now: () => now });
    (await threads.acquire(ana, 'a')).release();
    now = 1;
    const b = await threads.acquire(ana, 'b');
    now = 2;
    const c = await threads.acquire(ana, 'c');
    expect(factory.disposed).toEqual(['ana-token-1/a']);
    await expect(threads.acquire(ana, 'd')).rejects.toBeInstanceOf(ThreadCapacityError);
    b.release();
    c.release();
    await threads.close();
    expect(factory.disposed).toHaveLength(3);
  });
});
