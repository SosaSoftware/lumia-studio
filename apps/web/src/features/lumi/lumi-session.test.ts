import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventType } from '@ag-ui/client';
import { LUMI_WORKING, editLock } from '../../composables/edit-lock.ts';
import type { WorkspaceStore } from '../workspace/workspace-store.ts';
import { LumiSession, SESSION_HEADER, failureMessage } from './lumi-session.ts';

type Emit = (event: Record<string, unknown>) => void;

const fake = vi.hoisted(() => {
  const runs: ((emit: (event: Record<string, unknown>) => void) => void)[] = [];
  const agents: { threadId: string; headers: Record<string, string>; messages: Record<string, unknown>[]; runHeaders: Record<string, string>[] }[] = [];
  class FakeAgent {
    public readonly threadId: string;
    public headers: Record<string, string>;
    public readonly messages: Record<string, unknown>[] = [];
    public readonly runHeaders: Record<string, string>[] = [];
    public constructor(options: { threadId: string; headers: Record<string, string> }) {
      this.threadId = options.threadId;
      this.headers = options.headers;
      agents.push(this);
    }

    public addMessage(message: Record<string, unknown>): void {
      this.messages.push(message);
    }

    public runAgent(_input: unknown, subscriber: { onEvent: (arg: { event: Record<string, unknown> }) => void }): Promise<void> {
      this.runHeaders.push({ ...this.headers });
      const run = runs.shift();
      if (run === undefined) return Promise.resolve();
      try {
        run((event) => {
          subscriber.onEvent({ event });
        });
        return Promise.resolve();
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error('run failed'));
      }
    }
  }
  return { runs, agents, FakeAgent };
});

vi.mock('@ag-ui/client', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), HttpAgent: fake.FakeAgent }));

const URL = 'https://lumi.test/invocations';
const flush = vi.fn<() => Promise<void>>();
const reload = vi.fn<() => Promise<void>>();
const refreshNodes = vi.fn<() => Promise<void>>();
const selectSlide = vi.fn<(id: string) => void>();
const selectElement = vi.fn<(id: string) => void>();
const selectClip = vi.fn<(selection: unknown) => void>();
const SLIDES = [{ id: 'sl1', title: 'Portada', elements: [{ id: 'el1' }], narrationClips: [{ id: 'n1' }], audioClips: [], pauses: [] }];

function workspaceDouble(): WorkspaceStore {
  // Only the members the session and the screen context use; a partial double keeps the test independent of the store.
  return {
    session: { state: { classNode: null, document: null, slides: SLIDES, selectedClip: null }, currentSlide: null, selectedElement: null, flush, reload, selectSlide, selectElement, selectClip },
    category: { value: null },
    subcategory: { value: null },
    countByStatus: () => ({}),
    refreshNodes,
  } as unknown as WorkspaceStore;
}

function session(getToken: () => string | null = () => 'person-token', retryDelaysMs: readonly number[] = [0, 0]): LumiSession {
  return new LumiSession(workspaceDouble(), { url: URL, getToken: () => Promise.resolve(getToken()), retryDelaysMs });
}

function toolCall(name: string, args: Record<string, unknown> = {}): (emit: Emit) => void {
  return (emit) => {
    emit({ type: EventType.TOOL_CALL_START, toolCallId: 't1', toolCallName: name });
    emit({ type: EventType.TOOL_CALL_ARGS, toolCallId: 't1', delta: JSON.stringify(args) });
    emit({ type: EventType.TOOL_CALL_END, toolCallId: 't1' });
  };
}

function answered(name: string): (emit: Emit) => void {
  return (emit) => {
    toolCall(name)(emit);
    emit({ type: EventType.TOOL_CALL_RESULT, toolCallId: 't1', content: '{}' });
    emit({ type: EventType.TEXT_MESSAGE_START, messageId: 'm1' });
    emit({ type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'm1', delta: 'Listo.' });
    emit({ type: EventType.TEXT_MESSAGE_END, messageId: 'm1' });
  };
}

function conflict(): never {
  throw new Error('HTTP 409: RetryableConflictException');
}

const DELETE_SLIDE = { message: '¿Borro la portada?', action: 'studio-slides___delete_slide', targets: [{ kind: 'slide', id: 'sl1', label: 'Portada' }] };

function toolResults(): unknown[] {
  return (fake.agents[0]?.messages ?? []).filter((message) => message.role === 'tool').map((message): unknown => JSON.parse(String(message.content)));
}

describe('Lumi session', () => {
  beforeEach(() => {
    fake.runs.length = 0;
    fake.agents.length = 0;
    localStorage.clear();
    for (const mock of [flush, reload, refreshNodes]) mock.mockReset().mockResolvedValue(undefined);
    for (const mock of [selectSlide, selectElement, selectClip]) mock.mockReset();
  });

  it('keeps the conversation on one AgentCore session, retries the 409 and reloads the class Lumi changed', async () => {
    const lumi = session();
    fake.runs.push(conflict, answered('studio-elements___update_element'));
    await lumi.sendMessage('Cambia el título');
    expect(fake.agents[0]?.runHeaders.at(-1)).toEqual({ Authorization: 'Bearer person-token', [SESSION_HEADER]: lumi.state.threadId });
    expect(lumi.state.threadId).toHaveLength(36);
    expect(lumi.state.items.map((item) => item.type)).toEqual(['user', 'text']);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(refreshNodes).toHaveBeenCalledTimes(1);
  });

  it('saves pending edits first, keeps the editor read-only during the turn and uses the current token on each run', async () => {
    let token = 'first-token';
    const lumi = session(() => token);
    const during: (string | null)[] = [];
    fake.runs.push((emit) => {
      during.push(editLock.reason);
      answered('studio-read___get_class')(emit);
    });
    await lumi.sendMessage('¿Qué tiene la clase?');
    expect(flush).toHaveBeenCalledTimes(1);
    expect(during).toEqual([LUMI_WORKING]);
    expect(editLock.reason).toBeNull();
    expect(reload).not.toHaveBeenCalled();
    token = 'refreshed-token';
    fake.runs.push(answered('studio-read___get_slide'));
    await lumi.sendMessage('¿Y la primera diapositiva?');
    expect(fake.agents[0]?.runHeaders.map((headers) => headers.Authorization)).toEqual(['Bearer first-token', 'Bearer refreshed-token']);
  });

  it('answers after the person writes when Lumi is not connected', async () => {
    const lumi = new LumiSession(workspaceDouble(), { url: null, getToken: () => Promise.resolve('person-token') });
    await lumi.sendMessage('Hola');
    expect(lumi.state.items).toMatchObject([{ type: 'user' }, { type: 'error', content: expect.stringMatching(/No se pudo conectar con Lumi/) as string }]);
    expect(fake.agents).toHaveLength(0);
  });

  it('tells a conversation of another person apart from an expired session and a session that is starting', () => {
    expect(failureMessage(new Error('HTTP 403: Forbidden')).content).toMatch(/pertenece a otra persona/);
    expect(failureMessage(new Error('HTTP 401: Unauthorized')).content).toMatch(/sesión venció/);
    expect(failureMessage(new Error('HTTP 409: RetryableConflictException')).content).toMatch(/preparando la conversación/);
    expect(failureMessage(new Error('Failed to fetch')).content).toMatch(/No se pudo conectar/);
  });

  it('gives up after the retries of a 409 and shows why', async () => {
    const lumi = session(() => 'person-token', [0]);
    fake.runs.push(conflict, conflict);
    await lumi.sendMessage('Hola');
    expect(lumi.state.items.at(-1)).toMatchObject({ type: 'error', content: expect.stringMatching(/preparando la conversación/) as string });
  });

  describe('confirmations', () => {
    it('answers { confirmed: true } when the person confirms, and keeps the decision', async () => {
      const lumi = session();
      fake.runs.push(toolCall('confirm_change', DELETE_SLIDE));
      const turn = lumi.sendMessage('Borra la portada');
      await vi.waitFor(() => {
        expect(lumi.state.awaitingConfirmation).toBe(true);
      });
      expect(lumi.state.items.at(-1)).toMatchObject({ type: 'confirm', confirmState: 'pending', action: DELETE_SLIDE.action, targets: DELETE_SLIDE.targets });
      lumi.answerConfirm(true);
      await turn;
      expect(toolResults()).toEqual([{ confirmed: true }]);
      expect(lumi.state.items.find((item) => item.type === 'confirm')?.confirmState).toBe('yes');
    });

    it('answers { confirmed: false } for "Cancelar" and for "Detener"', async () => {
      const lumi = session();
      fake.runs.push(toolCall('confirm_change', DELETE_SLIDE));
      const cancelled = lumi.sendMessage('Borra la portada');
      await vi.waitFor(() => {
        expect(lumi.state.awaitingConfirmation).toBe(true);
      });
      lumi.answerConfirm(false);
      await cancelled;
      fake.runs.push(toolCall('confirm_change', DELETE_SLIDE));
      const stopped = lumi.sendMessage('Bórrala otra vez');
      await vi.waitFor(() => {
        expect(lumi.state.awaitingConfirmation).toBe(true);
      });
      lumi.abortRun();
      await stopped;
      expect(toolResults()).toEqual([{ confirmed: false }, { confirmed: false }]);
    });

    it('does not show a card for invalid arguments or a target that is not in the class, and says why', async () => {
      const lumi = session();
      fake.runs.push(toolCall('confirm_change', { ...DELETE_SLIDE, targets: [{ kind: 'slide', id: 'otra', label: 'Otra' }] }));
      await lumi.sendMessage('Borra otra diapositiva');
      fake.runs.push(toolCall('confirm_change', { message: '¿Borro?', targets: DELETE_SLIDE.targets }));
      await lumi.sendMessage('Borra la portada');
      expect(lumi.state.items.some((item) => item.type === 'confirm')).toBe(false);
      expect(toolResults()).toEqual([
        { confirmed: false, error: 'targets: slide otra no está en la clase abierta.' },
        { confirmed: false, error: 'action: indica la herramienta que se ejecutará al confirmar.' },
      ]);
    });

    it('selects a target in the editor so the person sees what would change', () => {
      const lumi = session();
      lumi.showTarget({ kind: 'element', id: 'el1', label: 'Título' });
      expect(selectSlide).toHaveBeenLastCalledWith('sl1');
      expect(selectElement).toHaveBeenCalledWith('el1');
      lumi.showTarget({ kind: 'narration', id: 'n1', label: 'Narración' });
      expect(selectClip).toHaveBeenCalledWith({ kind: 'narration', id: 'n1' });
    });

    it('shows a card that was open when the page reloaded as expired, without answering it', () => {
      const lumi = session();
      lumi.init('u1');
      const threadId = '11111111-2222-3333-4444-555555555555';
      localStorage.setItem(`lumia.studio.lumi.u1.thread.${threadId}`, JSON.stringify([{ id: 'c1', type: 'confirm', content: '¿Borro la portada?', confirmState: 'pending', ...DELETE_SLIDE }]));
      lumi.switchConversation(threadId);
      expect(lumi.state.items).toMatchObject([{ type: 'confirm', confirmState: 'expired', targets: DELETE_SLIDE.targets }]);
      expect(lumi.state.awaitingConfirmation).toBe(false);
    });
  });
});
