import { describe, expect, it } from 'vitest';
import { actorKeyOf, sessionIdOf } from './state-keys.ts';

describe('state keys', () => {
  it('are stable, distinct per input and valid for S3, files, Strands sessions and AgentCore actors', () => {
    expect(actorKeyOf('dev:creadora@studio.test')).toBe(actorKeyOf('dev:creadora@studio.test'));
    expect(actorKeyOf('a')).not.toBe(actorKeyOf('b'));
    expect(sessionIdOf('Thread-ABC')).not.toBe(sessionIdOf('thread-abc'));
    for (const key of [actorKeyOf('dev:creadora@studio.test'), sessionIdOf('8f5c3a7e-0e1b-4d0b-9a8c-2b1f0c9d7e6a')]) {
      expect(key).toMatch(/^[a-f0-9]{32}$/);
    }
  });

  it('do not collide between people and threads with the same text', () => {
    expect(actorKeyOf('same')).not.toBe(sessionIdOf('same'));
  });
});
