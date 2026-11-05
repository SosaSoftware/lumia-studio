import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { McpClient } from '@strands-agents/sdk';
import { DEFAULT_LUMI_MCP_TOKEN_HEADER, parseLumiEnv } from '@lumia/packages/lumi-env';
import { LocalStudio, StudioFixture } from '@lumia/sandbox/testing';
import { DevTokenVerifier } from '../../src/identity/dev-token-verifier.ts';
import { LumiRuntime } from '../../src/lumi-runtime.ts';
import { JsonLogger } from '../../src/shared/logger.ts';
import { BrowserSimulator } from '../support/browser-simulator.ts';
import type { ObservedCall, TurnResult } from '../support/browser-simulator.ts';
import { STUDIO_FRONTEND_TOOLS, studioContext } from '../support/studio-screen.ts';
import type { ScreenState } from '../support/studio-screen.ts';

// Lumi with its real model on Amazon Bedrock, served over AG-UI and driven like the web, against a local Studio (the
// sandbox API and the gateway emulator) on the sandbox Postgres. The content is a fixture of its own, removed at the
// end. These tests cost model tokens and are outside `npm run verify`.

const FIXTURE = 'ftest-lumi';
const WRITE_TARGETS = ['studio-slides___', 'studio-elements___', 'studio-timeline___'];

const appRoot = fileURLToPath(new URL('../..', import.meta.url));
const stateDir = mkdtempSync(join(tmpdir(), 'lumi-functional-'));
let studio: LocalStudio;
let fixture: StudioFixture;
let lumi: LumiRuntime;
let lumiUrl: string;
const tokens = { creator: '', viewer: '' };

const SlideList = z.object({ slides: z.array(z.looseObject({ id: z.string(), title: z.string(), type: z.string() })) });
const TextResult = z.object({ content: z.array(z.looseObject({ type: z.string(), text: z.string().optional() })) });

/** The slides of a class, read through the MCP as the person. */
async function slidesOf(token: string, nodeId: string): Promise<z.infer<typeof SlideList>['slides']> {
  const client = new McpClient({ url: studio.mcpUrl, headers: { Authorization: `Bearer ${token}`, [DEFAULT_LUMI_MCP_TOKEN_HEADER]: token }, applicationName: 'lumi-functional-test' });
  try {
    const getClass = (await client.listTools()).find((tool) => tool.name === 'studio-read___get_class');
    if (getClass === undefined) throw new Error('studio-read___get_class is not listed.');
    const text = TextResult.parse(await client.callTool(getClass, { nodeId })).content.find((item) => item.type === 'text')?.text ?? '{}';
    return SlideList.parse(JSON.parse(text)).slides;
  } finally {
    await client.disconnect();
  }
}

/** What the web answers to each frontend tool when it works. */
function webAnswer(call: ObservedCall, confirmed: boolean): unknown {
  switch (call.name) {
    case 'confirm_change':
      return { confirmed };
    case 'open_class':
    case 'open_panel':
      return { opened: true };
    case 'select_slide':
    case 'select_element':
      return { selected: true };
    case 'highlight_element':
      return { highlighted: true };
    case 'filter_tree':
      return { applied: true };
    case 'start_preview':
      return { started: true };
    default:
      return { error: `Unknown tool ${call.name}` };
  }
}

function named(turn: TurnResult, name: string): ObservedCall[] {
  return turn.calls.filter((call) => call.name === name);
}

/** Actions listed in the confirmations of a turn. */
function confirmedActions(turn: TurnResult): string[] {
  const Changes = z.object({ changes: z.array(z.looseObject({ action: z.string() })) });
  return named(turn, 'confirm_change').flatMap((call) => {
    const parsed = Changes.safeParse(call.args);
    return parsed.success ? parsed.data.changes.map((change) => change.action) : [];
  });
}

/** Studio changes that ran: write tools whose result is not an error or a refusal of the gate. */
function writesThatRan(turn: TurnResult): ObservedCall[] {
  return turn.calls.filter(
    (call) => WRITE_TARGETS.some((target) => call.name.startsWith(target)) && call.result !== undefined && !call.result.includes('"error"') && !call.result.includes('Not done'),
  );
}

function report(label: string, turn: TurnResult): void {
  const calls = turn.calls.map((call) => call.name).join(', ');
  process.stdout.write(`\n[${label}] ${turn.prompt}\n  calls (${String(turn.rounds)} runs): ${calls === '' ? 'none' : calls}\n  Lumi: ${turn.text.replace(/\s+/g, ' ').slice(0, 400)}\n`);
}

beforeAll(async () => {
  if ((process.env.BEDROCK_API_KEY ?? '') === '' && (process.env.AWS_PROFILE ?? '') === '' && (process.env.AWS_ACCESS_KEY_ID ?? '') === '') {
    throw new Error('Functional tests call Amazon Bedrock: export BEDROCK_API_KEY or AWS credentials (AWS_PROFILE) in this shell.');
  }
  studio = await LocalStudio.start();
  fixture = await StudioFixture.create(FIXTURE, ['Las fracciones', 'Class without content']);
  tokens.creator = await studio.login(fixture.people.creator);
  tokens.viewer = await studio.login(fixture.people.viewer);
  const env = parseLumiEnv({
    ...process.env,
    LUMI_MCP_URL: studio.mcpUrl,
    LUMI_SESSION_BUCKET: '',
    LUMI_SESSION_DIR: join(stateDir, 'sessions'),
    LUMI_MEMORY_ID: '',
    LUMI_MEMORY_DIR: join(stateDir, 'memory'),
  });
  lumi = await LumiRuntime.start({
    // Any free port; the contract requires a real one, so it is set after parsing.
    env: { ...env, port: 0, bindHost: '127.0.0.1' },
    appRoot,
    identity: new DevTokenVerifier(env.devJwtSecret?.reveal() ?? ''),
    logger: new JsonLogger('warn', { service: 'lumi-functional' }),
  });
  lumiUrl = `http://127.0.0.1:${String(lumi.port)}/invocations`;
});

afterAll(async () => {
  await lumi.close();
  await fixture.remove();
  await studio.close();
  rmSync(stateDir, { recursive: true, force: true });
});

describe('Lumi with a content creator', () => {
  let confirmed = true;
  let screen: ScreenState;
  let browser: BrowserSimulator;

  beforeAll(() => {
    const [lesson] = fixture.classes;
    if (lesson === undefined) throw new Error('The fixture has no class.');
    screen = {
      user: { sub: `dev:${fixture.people.creator}`, name: 'Creadora de pruebas', role: 'Creación de contenido' },
      categoryId: fixture.categoryId,
      subcategoryId: fixture.subcategoryId,
      openClass: { nodeId: lesson.nodeId, displayName: lesson.displayName, slideCount: 0 },
    };
    browser = new BrowserSimulator({ url: lumiUrl, token: tokens.creator, tools: STUDIO_FRONTEND_TOOLS, context: () => studioContext(screen), answer: (call) => webAnswer(call, confirmed) });
  });

  function nodeId(): string {
    if (screen.openClass === null) throw new Error('No open class.');
    return screen.openClass.nodeId;
  }

  it('adds a cover after the person confirms it', async () => {
    confirmed = true;
    const turn = await browser.turn('Agrega una portada con el título «Las fracciones» y el subtítulo «Aprendamos a repartir en partes iguales».');
    report('add cover', turn);
    expect(turn.errors).toEqual([]);
    expect(confirmedActions(turn)).toContain('studio-slides___add_slides');
    const confirmation = turn.calls.findIndex((call) => call.name === 'confirm_change');
    const write = turn.calls.findIndex((call) => writesThatRan(turn).includes(call));
    expect(write).toBeGreaterThan(confirmation);
    const slides = await slidesOf(tokens.creator, nodeId());
    expect(slides).toHaveLength(1);
    expect(slides[0]?.title).toMatch(/fracciones/i);
    expect(turn.text).not.toBe('');
  });

  it('changes nothing when the person declines', async () => {
    const [cover] = await slidesOf(tokens.creator, nodeId());
    if (cover === undefined) throw new Error('The cover is missing.');
    screen = { ...screen, openClass: { nodeId: nodeId(), displayName: 'Las fracciones', slideCount: 1 }, selection: { slideId: cover.id, slidePosition: 1, slideType: cover.type, slideTitle: cover.title } };
    confirmed = false;
    const turn = await browser.turn('Borra esta diapositiva.');
    report('decline delete', turn);
    expect(turn.errors).toEqual([]);
    expect(confirmedActions(turn)).toContain('studio-slides___delete_slide');
    expect(writesThatRan(turn)).toEqual([]);
    expect(await slidesOf(tokens.creator, nodeId())).toHaveLength(1);
  });

  it('answers in the language the person writes in, without changing anything', async () => {
    confirmed = true;
    const turn = await browser.turn('How many slides does this class have now? Answer in one short sentence.');
    report('english question', turn);
    expect(turn.errors).toEqual([]);
    expect(turn.text).toMatch(/\b(slides?|one)\b/i);
    expect(turn.text).not.toMatch(/\bdiapositivas?\b/i);
    expect(named(turn, 'confirm_change')).toEqual([]);
    expect(writesThatRan(turn)).toEqual([]);
  });
});

describe('Lumi does nothing it was not asked to', () => {
  it('only talks when the person greets it', async () => {
    const [, empty] = fixture.classes;
    if (empty === undefined) throw new Error('The fixture has no second class.');
    const screen: ScreenState = {
      user: { sub: `dev:${fixture.people.creator}`, name: 'Creadora de pruebas', role: 'Creación de contenido' },
      categoryId: fixture.categoryId,
      subcategoryId: fixture.subcategoryId,
      openClass: { nodeId: empty.nodeId, displayName: empty.displayName, slideCount: 0 },
    };
    const browser = new BrowserSimulator({ url: lumiUrl, token: tokens.creator, tools: STUDIO_FRONTEND_TOOLS, context: () => studioContext(screen), answer: (call) => webAnswer(call, true) });
    const turn = await browser.turn('Hola, Lumi.');
    report('greeting', turn);
    expect(turn.errors).toEqual([]);
    expect(named(turn, 'confirm_change')).toEqual([]);
    expect(writesThatRan(turn)).toEqual([]);
    expect(await slidesOf(tokens.creator, empty.nodeId)).toEqual([]);
  });
});

describe('Lumi with a viewer', () => {
  it('cannot change a class, even if a confirmation were accepted', async () => {
    const [lesson] = fixture.classes;
    if (lesson === undefined) throw new Error('The fixture has no class.');
    const before = await slidesOf(tokens.viewer, lesson.nodeId);
    const screen: ScreenState = {
      user: { sub: `dev:${fixture.people.viewer}`, name: 'Lectora de pruebas', role: 'Lectura' },
      categoryId: fixture.categoryId,
      subcategoryId: fixture.subcategoryId,
      openClass: { nodeId: lesson.nodeId, displayName: lesson.displayName, slideCount: before.length },
    };
    const browser = new BrowserSimulator({ url: lumiUrl, token: tokens.viewer, tools: STUDIO_FRONTEND_TOOLS, context: () => studioContext(screen), answer: (call) => webAnswer(call, true) });
    const turn = await browser.turn('Agrega una diapositiva de cierre al final de esta clase.');
    report('viewer write', turn);
    expect(turn.errors).toEqual([]);
    expect(writesThatRan(turn)).toEqual([]);
    expect(await slidesOf(tokens.viewer, lesson.nodeId)).toHaveLength(before.length);
    expect(turn.text).not.toBe('');
  });
});
