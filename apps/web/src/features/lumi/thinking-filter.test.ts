import { describe, expect, it } from 'vitest';
import { ThinkingFilter } from './thinking-filter.ts';

describe('ThinkingFilter', () => {
  it('passes through text without thinking tags', () => {
    const filter = new ThinkingFilter();
    expect(filter.push('Hello world')).toBe('Hello world');
    expect(filter.flush()).toBe('');
  });

  it('strips a complete thinking block', () => {
    const filter = new ThinkingFilter();
    expect(filter.push('Before <thinking>hidden</thinking> After')).toBe('Before  After');
    expect(filter.flush()).toBe('');
  });

  it('strips thinking blocks split across chunks', () => {
    const filter = new ThinkingFilter();
    expect(filter.push('Before <think')).toBe('Before ');
    expect(filter.push('ing>hidden</thi')).toBe('');
    expect(filter.push('nking> After')).toBe(' After');
    expect(filter.flush()).toBe('');
  });

  it('strips multiple thinking blocks', () => {
    const filter = new ThinkingFilter();
    const visible = filter.push('A <thinking>x</thinking> B <thinking>y</thinking> C');
    expect(visible).toBe('A  B  C');
  });

  it('holds back a partial tag at the end of a chunk', () => {
    const filter = new ThinkingFilter();
    expect(filter.push('Text <thin')).toBe('Text ');
    expect(filter.push('king>inside</thinking>rest')).toBe('rest');
  });

  it('flushes a false positive partial tag', () => {
    const filter = new ThinkingFilter();
    expect(filter.push('Hello <thi')).toBe('Hello ');
    expect(filter.push('s is fine')).toBe('<this is fine');
    expect(filter.flush()).toBe('');
  });
});
