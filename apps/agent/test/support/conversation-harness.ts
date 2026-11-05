import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StrandsAgent } from '@ag-ui/aws-strands';
import type { BaseEvent, Message as AguiMessage, Tool as AguiTool } from '@ag-ui/core';
import { createHarness } from '@strands-agents/harness';
import { Agent, SessionManager, tool } from '@strands-agents/sdk';
import type { InterventionHandler, JSONValue, Plugin, Tool } from '@strands-agents/sdk';
import { LocalFileStorage } from '@strands-agents/sdk/storage';
import { UnreachableModel } from '../../src/server/unreachable-model.ts';
import { ScriptedModel } from './scripted-model.ts';
import type { ScriptedStep } from './scripted-model.ts';

/** `confirm_change` as the web declares it, with the contract agreed for Lumi. */
export const CONFIRM_CHANGE_DECLARATION: AguiTool = {
  name: 'confirm_change',
  description: 'Asks the person to confirm changes before Lumi makes them.',
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'One question for the person.' },
      changes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            action: { type: 'string' },
            summary: { type: 'string' },
            arguments: { type: 'object' },
            targets: { type: 'array', items: { type: 'object', properties: { kind: { type: 'string' }, id: { type: 'string' }, label: { type: 'string' } } } },
          },
          required: ['action', 'summary', 'arguments'],
        },
      },
    },
    required: ['message', 'changes'],
  },
};

/** A screen tool the web runs without asking the person. */
export const SELECT_SLIDE_DECLARATION: AguiTool = {
  name: 'select_slide',
  description: 'Selects a slide.',
  parameters: { type: 'object', properties: { slideId: { type: 'string' } }, required: ['slideId'] },
};

/** A tool that records its calls and answers a fixed result. */
export function recordingTool(name: string, calls: JSONValue[], result: JSONValue = { ok: true }): Tool {
  return tool({
    name,
    description: `Test tool ${name}.`,
    inputSchema: { type: 'object', additionalProperties: true },
    callback: (input) => {
      // The SDK validated the input against the schema above, so it is a JSON object.
      calls.push(input as JSONValue);
      return result;
    },
  });
}

/** Temporary directory removed by `dispose`. */
export class TempDir {
  public readonly path = mkdtempSync(join(tmpdir(), 'lumi-test-'));

  public dispose(): void {
    rmSync(this.path, { recursive: true, force: true });
  }
}

export interface TestAgentOptions {
  readonly sessionDir: string;
  readonly sessionId: string;
  readonly steps: readonly ScriptedStep[];
  readonly tools?: readonly Tool[];
  readonly interventions?: readonly InterventionHandler[];
  readonly plugins?: readonly Plugin[];
}

/** An agent of one conversation, built with the harness like Lumi and restored from its session. */
export async function buildTestAgent(options: TestAgentOptions): Promise<{ agent: Agent; model: ScriptedModel }> {
  const model = new ScriptedModel(options.steps);
  const agent = await createHarness({
    id: 'lumi',
    model,
    tools: [...(options.tools ?? [])],
    plugins: [...(options.plugins ?? [])],
    session: new SessionManager({ sessionId: options.sessionId, storage: new LocalFileStorage(options.sessionDir), saveLatestOn: 'message' }),
    interventions: [...(options.interventions ?? [])],
    builtinTools: [],
    builtinPlugins: [],
    skills: false,
    memory: false,
    backgroundTasks: false,
    contextManager: false,
    printer: false,
  });
  await agent.initialize();
  return { agent, model };
}

/** Runs one request through the real AG-UI adapter, as the server does. */
export async function runThroughAdapter(
  agent: Agent,
  threadId: string,
  messages: AguiMessage[],
  tools: AguiTool[] = [CONFIRM_CHANGE_DECLARATION, SELECT_SLIDE_DECLARATION],
): Promise<BaseEvent[]> {
  const adapter = new StrandsAgent({ agent: new Agent({ model: new UnreachableModel(), printer: false }), name: 'lumi', agentsByThread: new Map([[threadId, agent]]) });
  const events: BaseEvent[] = [];
  for await (const event of adapter.run({ threadId, runId: `run-${String(Date.now())}`, state: {}, messages, tools, context: [], forwardedProps: {} })) {
    events.push(event);
  }
  return events;
}

/** Tool results of a conversation, by tool use id, as JSON. */
export function toolResults(agent: Agent): Map<string, unknown> {
  const results = new Map<string, unknown>();
  for (const message of agent.messages) {
    for (const block of message.content) {
      if (block.type === 'toolResultBlock') {
        results.set(block.toolUseId, JSON.parse(JSON.stringify(block.content)));
      }
    }
  }
  return results;
}
