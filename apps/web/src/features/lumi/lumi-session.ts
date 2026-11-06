import { reactive, ref } from 'vue';
import type { Ref } from 'vue';
import { EventType, HttpAgent } from '@ag-ui/client';
import type { BaseEvent } from '@ag-ui/client';
import { list, num, rec, str } from '../../api/decode.ts';
import { LUMI_WORKING, lockEditing, unlockEditing } from '../../composables/edit-lock.ts';
import type { WorkspaceStore } from '../workspace/workspace-store.ts';
import { TOOL_DECLARATIONS, activityLabel, buildContext, changesClass, executeSimpleTool, isFrontendTool } from './frontend-tools.ts';
import type { ContextEntry, ContextUser, ToolArgs } from './frontend-tools.ts';
import { ThinkingFilter } from './thinking-filter.ts';

/** What a confirmation can name; each kind matches the id argument of one delete tool of the Studio MCP. */
export const TARGET_KINDS = ['slide', 'element', 'narration', 'audio_clip', 'pause'] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];

/** Something a confirmed action affects, as Lumi names it. */
export interface ConfirmTarget {
  kind: TargetKind;
  id: string;
  label: string;
}

export type ConfirmState = 'pending' | 'yes' | 'no' | 'expired';

export interface ChatItem {
  id: string;
  type: 'user' | 'text' | 'confirm' | 'error';
  content: string;
  /** Second line of an error: the technical reason, when there is one. */
  detail?: string;
  confirmState?: ConfirmState;
  /** Tool Lumi runs when the person confirms, e.g. `studio-slides___delete_slide`; a deletion when any change is one. */
  action?: string;
  /** What each change of a confirmation does, in the person's language. */
  summaries?: string[];
  targets?: ConfirmTarget[];
}

export interface Conversation {
  threadId: string;
  title: string;
  createdAt: number;
  lastMessageAt: number;
}

export interface LumiState {
  items: ChatItem[];
  running: boolean;
  streamingText: string;
  /** What Lumi is doing right now, shown next to the "Pulso" animation. */
  activity: string;
  threadId: string;
  showHistory: boolean;
  /** A confirmation waits for the person; the message box stays disabled meanwhile. */
  awaitingConfirmation: boolean;
}

export interface LumiSessionOptions {
  /** AG-UI endpoint of Lumi; null while Lumi is not connected to this Studio. */
  readonly url: string | null;
  /** The current token, read again for every run so a refreshed token is used. */
  readonly getToken: () => Promise<string | null>;
  /** The signed-in person, for the context of each run. */
  readonly getUser?: () => ContextUser | null;
  /** Waits before retrying a 409 of AgentCore. */
  readonly retryDelaysMs?: readonly number[];
}

interface ToolCall {
  id: string;
  name: string;
  frontend: boolean;
  rawArgs: string;
  args: unknown;
  result?: string;
}

/** AgentCore Runtime keeps a conversation on one session when every request carries its id. */
export const SESSION_HEADER = 'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id';

const MAX_ROUNDS = 8;
/** AgentCore session ids have at least 33 characters; conversation ids are UUIDs (36). */
const THREAD_ID_PATTERN = /^[A-Za-z0-9_-]{33,128}$/;
/** Waits before retrying a 409: AgentCore answers it while it creates the session and asks to retry with backoff. */
const CONFLICT_RETRY_MS: readonly number[] = [500, 1000, 2000];
const MAX_CONVERSATIONS = 30;
const MAX_TRANSCRIPT_ITEMS = 80;
const THINKING = 'Lumi está pensando…';
const NOT_CONNECTED = 'No se pudo conectar con Lumi. Revisa que el servicio esté disponible e intenta de nuevo.';
const MAX_TARGETS = 20;
/** Same limit as `maxChangesPerConfirmation` in the confirmation policy of the agent. */
const MAX_CHANGES = 20;
const UNAVAILABLE = 'Lumi no pudo responder en este momento. Intenta de nuevo.';

function uuid(): string {
  return crypto.randomUUID();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? rec(value) : null;
}

function titleFromPrompt(prompt: string): string {
  const trimmed = prompt.trim();
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;
}

function parseArgs(raw: string): unknown {
  if (raw.trim() === '') return {};
  try {
    return JSON.parse(raw);
  } catch {
    // Malformed arguments reach the tool as an empty object; the tool answers with its own error.
    return {};
  }
}

function eventField(event: BaseEvent, name: string): unknown {
  return rec(event)[name];
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException ? error.name === 'AbortError' : error instanceof Error && /abort/i.test(error.message);
}

/** HTTP status of a failed run; the AG-UI client reports it as `HTTP <status>: <body>`. */
export function httpStatus(error: unknown): number | null {
  const match = /HTTP (\d{3})\b/.exec(error instanceof Error ? error.message : '');
  return match?.[1] === undefined ? null : Number(match[1]);
}

/** Message for a failed run; network and HTTP failures read better than the raw error. */
export function failureMessage(error: unknown): { content: string; detail?: string } {
  const message = error instanceof Error ? error.message : '';
  const status = httpStatus(error);
  if (status === 403) return { content: 'Esta conversación pertenece a otra persona. Empieza una conversación nueva.' };
  if (status === 401) return { content: 'Tu sesión venció. Vuelve a iniciar sesión para hablar con Lumi.' };
  if (status === 409) return { content: 'Lumi todavía está preparando la conversación. Intenta de nuevo en unos segundos.' };
  if (/Failed to fetch|NetworkError|ECONNREFUSED/.test(message) || (status !== null && status >= 502)) {
    return { content: NOT_CONNECTED };
  }
  return message === '' ? { content: UNAVAILABLE } : { content: UNAVAILABLE, detail: message };
}

interface SlideLike {
  id: string;
  elements: readonly { id: string }[];
  narrationClips: readonly { id: string }[];
  audioClips: readonly { id: string }[];
  pauses: readonly { id: string }[];
}

/** Whether a slide is, or holds, what a confirmation names. */
function slideHolds(slide: SlideLike, target: ConfirmTarget): boolean {
  switch (target.kind) {
    case 'slide':
      return slide.id === target.id;
    case 'element':
      return slide.elements.some((element) => element.id === target.id);
    case 'narration':
      return slide.narrationClips.some((clip) => clip.id === target.id);
    case 'audio_clip':
      return slide.audioClips.some((clip) => clip.id === target.id);
    case 'pause':
      return slide.pauses.some((pause) => pause.id === target.id);
  }
}

/** Reads the targets of a confirmation; null when one of them is not valid. */
function readTargets(value: unknown): ConfirmTarget[] | null {
  const targets: ConfirmTarget[] = [];
  for (const entry of list(value)) {
    const item = rec(entry);
    const kind = TARGET_KINDS.find((candidate) => candidate === item.kind);
    const id = str(item.id).trim();
    const label = str(item.label).trim();
    if (kind === undefined || id === '' || label === '') return null;
    targets.push({ kind, id, label });
  }
  return targets;
}

/** What one change of a confirmation shows to the person. */
interface ConfirmChange {
  action: string;
  summary: string;
  targets: ConfirmTarget[];
}

/**
 * Reads the changes of a confirmation, or the reason why they are not valid. The consent gate of the agent ignores a
 * confirmation that does not hold `action`, `summary` and `arguments` in every change, so asking for it would be useless.
 */
function readChanges(value: unknown): ConfirmChange[] | { error: string } {
  const entries = list(value);
  if (entries.length === 0 || entries.length > MAX_CHANGES) return { error: `changes: indica de 1 a ${String(MAX_CHANGES)} cambios.` };
  const changes: ConfirmChange[] = [];
  for (const entry of entries) {
    const item = rec(entry);
    const action = str(item.action).trim();
    const summary = str(item.summary).trim();
    if (action === '') return { error: 'changes: cada cambio necesita action con la herramienta que se ejecutará.' };
    if (summary === '') return { error: 'changes: cada cambio necesita summary con lo que cambia.' };
    if (asRecord(item.arguments) === null) return { error: 'changes: cada cambio necesita arguments con los argumentos exactos.' };
    if (list(item.targets).length > MAX_TARGETS) return { error: `targets: indica hasta ${String(MAX_TARGETS)} elementos por cambio.` };
    const targets = readTargets(item.targets);
    if (targets === null) return { error: 'targets: cada elemento necesita kind, id y label válidos.' };
    changes.push({ action, summary, targets });
  }
  return changes;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Lumi de Studio for the signed-in person: one AG-UI thread per conversation and the frontend tools.
 * Lumi only answers what the person asks; it changes classes through its MCP with the person's token,
 * and the editor reloads the class when a turn changed it. It lives at app level so it keeps running
 * while other panels are open.
 */
export class LumiSession {
  public readonly state: LumiState;
  public readonly conversations: Ref<Conversation[]> = ref([]);

  private agent: HttpAgent | null = null;
  private confirmResolve: ((confirmed: boolean) => void) | null = null;
  private filter = new ThinkingFilter();
  private userId = 'anonymous';
  private streamingItemId: string | null = null;
  private abortController: AbortController | null = null;

  private readonly url: string | null;
  private readonly getToken: () => Promise<string | null>;
  private readonly getUser: () => ContextUser | null;
  private readonly retryDelaysMs: readonly number[];

  public constructor(
    private readonly workspace: WorkspaceStore,
    options: LumiSessionOptions,
  ) {
    this.url = options.url;
    this.getToken = options.getToken;
    this.getUser = options.getUser ?? ((): null => null);
    this.retryDelaysMs = options.retryDelaysMs ?? CONFLICT_RETRY_MS;
    this.state = reactive<LumiState>({ items: [], running: false, streamingText: '', activity: THINKING, threadId: uuid(), showHistory: false, awaitingConfirmation: false });
  }

  /** Whether Lumi is connected to this Studio; without it the panel says so and the editor works on its own. */
  public get connected(): boolean {
    return this.url !== null;
  }

  public init(userId: string): void {
    this.userId = userId;
    this.loadConversations();
  }

  // -- Conversations ---------------------------------------------------------

  public newConversation(): void {
    this.abortRun();
    this.agent = null;
    this.state.threadId = uuid();
    this.state.items = [];
    this.state.streamingText = '';
    this.state.showHistory = false;
  }

  public switchConversation(threadId: string): void {
    if (threadId === this.state.threadId) {
      this.state.showHistory = false;
      return;
    }
    this.abortRun();
    this.agent = null;
    this.state.threadId = threadId;
    this.state.items = this.loadTranscript(threadId);
    this.state.streamingText = '';
    this.state.showHistory = false;
  }

  public deleteConversation(threadId: string): void {
    this.conversations.value = this.conversations.value.filter((conversation) => conversation.threadId !== threadId);
    this.saveConversations();
    this.removeTranscript(threadId);
    if (this.state.threadId === threadId) this.newConversation();
  }

  private conversationsKey(): string {
    return `lumia.studio.lumi.${this.userId}`;
  }

  private transcriptKey(threadId: string): string {
    return `lumia.studio.lumi.${this.userId}.thread.${threadId}`;
  }

  private loadConversations(): void {
    try {
      const raw = localStorage.getItem(this.conversationsKey());
      const parsed: unknown = raw === null ? [] : JSON.parse(raw);
      this.conversations.value = list(parsed).flatMap((item) => {
        const value = rec(item);
        return typeof value.threadId === 'string' && THREAD_ID_PATTERN.test(value.threadId)
          ? [{ threadId: value.threadId, title: str(value.title, 'Conversación'), createdAt: num(value.createdAt), lastMessageAt: num(value.lastMessageAt) }]
          : [];
      });
    } catch {
      // A corrupted history starts empty; the conversations stay on the server.
      this.conversations.value = [];
    }
  }

  private saveConversations(): void {
    try {
      localStorage.setItem(this.conversationsKey(), JSON.stringify(this.conversations.value.slice(0, MAX_CONVERSATIONS)));
    } catch {
      // Not persisting the history is harmless.
    }
  }

  private loadTranscript(threadId: string): ChatItem[] {
    try {
      const raw = localStorage.getItem(this.transcriptKey(threadId));
      const parsed: unknown = raw === null ? [] : JSON.parse(raw);
      return list(parsed).flatMap((item): ChatItem[] => {
        const value = rec(item);
        const type = value.type;
        // Items of other kinds (the drafts of earlier versions) are not shown anymore.
        if (type !== 'user' && type !== 'text' && type !== 'confirm' && type !== 'error') return [];
        const restored: ChatItem = { id: str(value.id, uuid()), type, content: str(value.content) };
        if (typeof value.detail === 'string') restored.detail = value.detail;
        // A confirmation that was never answered cannot be answered anymore: its tool call ended with the page.
        if (type === 'confirm') {
          restored.confirmState = value.confirmState === 'yes' || value.confirmState === 'no' ? value.confirmState : 'expired';
          if (typeof value.action === 'string') restored.action = value.action;
          const summaries = list(value.summaries).filter((summary) => typeof summary === 'string');
          if (summaries.length > 0) restored.summaries = summaries;
          const targets = readTargets(value.targets);
          if (targets !== null && targets.length > 0) restored.targets = targets;
        }
        return [restored];
      });
    } catch {
      // A corrupted transcript shows an empty conversation; Lumi still remembers it on the server.
      return [];
    }
  }

  private saveTranscript(): void {
    try {
      localStorage.setItem(this.transcriptKey(this.state.threadId), JSON.stringify(this.state.items.slice(-MAX_TRANSCRIPT_ITEMS)));
    } catch {
      // Not persisting the transcript is harmless.
    }
  }

  private removeTranscript(threadId: string): void {
    try {
      localStorage.removeItem(this.transcriptKey(threadId));
    } catch {
      // Nothing to clean up when storage is blocked.
    }
  }

  private recordConversation(prompt: string): void {
    const existing = this.conversations.value.find((conversation) => conversation.threadId === this.state.threadId);
    const now = Date.now();
    if (existing !== undefined) {
      existing.lastMessageAt = now;
      this.conversations.value = [existing, ...this.conversations.value.filter((conversation) => conversation !== existing)];
    } else {
      this.conversations.value = [{ threadId: this.state.threadId, title: titleFromPrompt(prompt), createdAt: now, lastMessageAt: now }, ...this.conversations.value];
    }
    this.saveConversations();
  }

  // -- Messages --------------------------------------------------------------

  /**
   * One turn: the person's message and every round of frontend tools until Lumi finishes. Pending edits are saved
   * first and the editor stays read-only during the turn, so autosave and Lumi do not overwrite each other.
   */
  public async sendMessage(prompt: string): Promise<void> {
    const text = prompt.trim();
    if (this.state.running || text === '') return;
    this.state.items.push({ id: uuid(), type: 'user', content: text });
    this.recordConversation(text);
    if (!this.connected) {
      this.state.items.push({ id: uuid(), type: 'error', content: NOT_CONNECTED });
      this.saveTranscript();
      return;
    }
    this.state.running = true;
    this.state.activity = THINKING;
    this.saveTranscript();
    const calls: ToolCall[] = [];
    try {
      await this.workspace.session.flush();
      lockEditing(LUMI_WORKING);
      const agent = this.ensureAgent();
      agent.addMessage({ id: uuid(), role: 'user', content: text });
      await this.runTurnLoop(agent, calls);
    } catch (error) {
      if (!isAbort(error)) this.state.items.push({ id: uuid(), type: 'error', ...failureMessage(error) });
    } finally {
      this.finalizeStreaming();
      this.state.running = false;
      this.state.streamingText = '';
      this.streamingItemId = null;
      this.saveTranscript();
    }
    try {
      // Lumi changed the class through its MCP: the editor shows the saved state, also when the turn failed later.
      if (calls.some((call) => !call.frontend && changesClass(call.name))) await this.refreshClass();
    } finally {
      unlockEditing();
    }
  }

  /** Stops the turn; a confirmation still waiting is answered as "no". */
  public abortRun(): void {
    this.abortController?.abort();
    this.abortController = null;
    if (this.confirmResolve !== null) this.answerConfirm(false);
    this.state.running = false;
    this.state.streamingText = '';
    this.streamingItemId = null;
  }

  // -- Confirmations ---------------------------------------------------------

  public answerConfirm(confirmed: boolean): void {
    const item = [...this.state.items].reverse().find((candidate) => candidate.type === 'confirm' && candidate.confirmState === 'pending');
    if (item !== undefined) item.confirmState = confirmed ? 'yes' : 'no';
    this.confirmResolve?.(confirmed);
    this.confirmResolve = null;
    this.state.awaitingConfirmation = false;
    this.saveTranscript();
  }

  /** Selects in the editor what a confirmation names, so the person sees what would change. */
  public showTarget(target: ConfirmTarget): void {
    const session = this.workspace.session;
    if (target.kind === 'slide') {
      session.selectSlide(target.id);
      return;
    }
    const slide = session.state.slides.find((candidate) => slideHolds(candidate, target));
    if (slide === undefined) return;
    session.selectSlide(slide.id);
    if (target.kind === 'element') session.selectElement(target.id);
    else session.selectClip({ kind: target.kind === 'audio_clip' ? 'audio' : target.kind, id: target.id });
  }

  // -- Agent -----------------------------------------------------------------

  private ensureAgent(): HttpAgent {
    if (this.agent !== null && this.agent.threadId === this.state.threadId) return this.agent;
    if (this.url === null) throw new Error('Lumi no está conectado.');
    if (!THREAD_ID_PATTERN.test(this.state.threadId)) this.state.threadId = uuid();
    // The headers are set before each run, with the token of that moment.
    this.agent = new HttpAgent({ url: this.url, threadId: this.state.threadId, headers: {} });
    return this.agent;
  }

  /** Headers of one run, with the token as it is now: tokens are refreshed while a conversation goes on. */
  private async requestHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    if (token === null) throw new Error('HTTP 401: no hay una sesión activa.');
    return { Authorization: `Bearer ${token}`, [SESSION_HEADER]: this.state.threadId };
  }

  private async runTurnLoop(agent: HttpAgent, calls: ToolCall[]): Promise<void> {
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const roundCalls = await this.runWithRetry(agent);
      calls.push(...roundCalls);
      const pending = roundCalls.filter((call) => call.frontend && call.result === undefined);
      if (pending.length === 0 || !this.state.running) return;
      for (const call of pending) {
        const result = await this.executeFrontendTool(call);
        call.result = JSON.stringify(result);
        agent.addMessage({ id: uuid(), role: 'tool', toolCallId: call.id, content: call.result });
      }
      this.state.activity = THINKING;
    }
  }

  /** One run; a 409 of AgentCore while it creates the session is retried with backoff. */
  private async runWithRetry(agent: HttpAgent): Promise<ToolCall[]> {
    let attempt = 0;
    for (;;) {
      try {
        return await this.runOnce(agent, buildContext(this.workspace, this.getUser()));
      } catch (error) {
        const delay = this.retryDelaysMs[attempt];
        if (httpStatus(error) !== 409 || delay === undefined || !this.state.running) throw error;
        attempt += 1;
        await wait(delay);
      }
    }
  }

  private async runOnce(agent: HttpAgent, context: ContextEntry[]): Promise<ToolCall[]> {
    const calls: ToolCall[] = [];
    // Set inside the event callback, so it lives in an object the compiler does not narrow.
    const outcome: { error: string | null } = { error: null };
    this.filter = new ThinkingFilter();
    this.state.streamingText = '';
    this.streamingItemId = null;
    this.abortController = new AbortController();
    agent.headers = await this.requestHeaders();
    await agent.runAgent(
      { tools: TOOL_DECLARATIONS.map((declaration) => ({ ...declaration })), context: context.map((entry) => ({ ...entry })), abortController: this.abortController },
      {
        onEvent: ({ event }) => {
          const message = this.processEvent(event, calls);
          if (message !== null) outcome.error = message;
        },
      },
    );
    this.finalizeStreaming();
    if (outcome.error !== null) this.state.items.push({ id: uuid(), type: 'error', content: UNAVAILABLE, detail: outcome.error });
    return calls;
  }

  /** Applies one AG-UI event; returns the message of a run error. */
  private processEvent(event: BaseEvent, calls: ToolCall[]): string | null {
    switch (event.type) {
      case EventType.TEXT_MESSAGE_START:
        this.finalizeStreaming();
        this.filter = new ThinkingFilter();
        this.streamingItemId = uuid();
        break;
      case EventType.TEXT_MESSAGE_CONTENT: {
        const visible = this.filter.push(str(eventField(event, 'delta')));
        if (visible !== '') this.state.streamingText += visible;
        break;
      }
      case EventType.TEXT_MESSAGE_END:
        this.finalizeStreaming();
        break;
      case EventType.TOOL_CALL_START: {
        const name = str(eventField(event, 'toolCallName'));
        calls.push({ id: str(eventField(event, 'toolCallId')), name, frontend: isFrontendTool(name), rawArgs: '', args: undefined });
        this.state.activity = activityLabel(name);
        break;
      }
      case EventType.TOOL_CALL_ARGS: {
        const call = calls.find((candidate) => candidate.id === str(eventField(event, 'toolCallId')));
        if (call !== undefined) call.rawArgs += str(eventField(event, 'delta'));
        break;
      }
      case EventType.TOOL_CALL_END: {
        const call = calls.find((candidate) => candidate.id === str(eventField(event, 'toolCallId')));
        if (call !== undefined) call.args = parseArgs(call.rawArgs);
        break;
      }
      case EventType.TOOL_CALL_RESULT: {
        const call = calls.find((candidate) => candidate.id === str(eventField(event, 'toolCallId')));
        if (call !== undefined) call.result = str(eventField(event, 'content'));
        break;
      }
      case EventType.RUN_ERROR:
        return str(eventField(event, 'message'), 'Error desconocido.');
      default:
        break;
    }
    return null;
  }

  private finalizeStreaming(): void {
    const text = (this.state.streamingText + this.filter.flush()).trim();
    if (text !== '') this.state.items.push({ id: this.streamingItemId ?? uuid(), type: 'text', content: text });
    this.state.streamingText = '';
    this.streamingItemId = null;
  }

  private async refreshClass(): Promise<void> {
    try {
      await this.workspace.session.flush();
      await this.workspace.session.reload();
      await this.workspace.refreshNodes();
    } catch {
      // The editor keeps what it shows; opening the class again loads the saved state.
    }
  }

  private executeFrontendTool(call: ToolCall): Promise<unknown> {
    const args: ToolArgs = asRecord(call.args) ?? {};
    if (call.name === 'confirm_change') return this.confirmChange(args);
    return executeSimpleTool(call.name, args, this.workspace);
  }

  /**
   * Shows a confirmation card and answers with the person's decision. Invalid arguments, or a target that is not in
   * the open class, answer at once with `confirmed: false` and the reason, without showing anything.
   */
  private confirmChange(args: ToolArgs): Promise<{ confirmed: boolean; error?: string }> {
    const request = this.confirmRequest(args);
    if ('error' in request) return Promise.resolve({ confirmed: false, error: request.error });
    this.state.items.push({ id: uuid(), type: 'confirm', content: request.message, confirmState: 'pending', action: request.action, summaries: request.summaries, targets: request.targets });
    this.state.activity = 'Esperando tu confirmación…';
    this.state.awaitingConfirmation = true;
    this.saveTranscript();
    return new Promise<{ confirmed: boolean }>((resolve) => {
      this.confirmResolve = (confirmed: boolean) => {
        resolve({ confirmed });
      };
    });
  }

  private confirmRequest(args: ToolArgs): { message: string; action: string; summaries: string[]; targets: ConfirmTarget[] } | { error: string } {
    const message = str(args.message).trim();
    if (message === '') return { error: 'message: escribe la pregunta de confirmación.' };
    const changes = readChanges(args.changes);
    if ('error' in changes) return changes;
    // Several changes can name the same item; the card lists it once.
    const targets = [...new Map(changes.flatMap((change) => change.targets).map((target) => [`${target.kind}:${target.id}`, target])).values()];
    const slides = this.workspace.session.state.slides;
    const missing = targets.find((target) => !slides.some((slide) => slideHolds(slide, target)));
    if (missing !== undefined) return { error: `targets: ${missing.kind} ${missing.id} no está en la clase abierta.` };
    const deletion = changes.find((change) => change.action.includes('___delete_'));
    return { message, action: (deletion ?? changes[0])?.action ?? '', summaries: changes.map((change) => change.summary), targets };
  }
}
