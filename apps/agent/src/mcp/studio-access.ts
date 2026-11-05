import { z } from 'zod';
import type { JSONValue } from '@strands-agents/sdk';

/** Gateway separator between the target and the tool: `<target>___<tool>`. */
export const TARGET_SEPARATOR = '___';

/** Prefix of the targets of the Studio MCP; their tools are shown only when `get_my_access` lists them. */
export const STUDIO_TARGET_PREFIX = 'studio-';

/** The tool that tells which Studio tools the person may use. */
export const ACCESS_TOOL = 'studio-read___get_my_access';

/** The gateway target of a tool name, or null for a name without one (frontend and harness tools). */
export function targetOf(toolName: string): string | null {
  const cut = toolName.indexOf(TARGET_SEPARATOR);
  return cut <= 0 ? null : toolName.slice(0, cut);
}

const CallToolResult = z.object({
  content: z.array(z.looseObject({ type: z.string(), text: z.string().optional() })).default([]),
  structuredContent: z.unknown().optional(),
  isError: z.boolean().optional(),
});

const AccessAnswer = z.object({ tools: z.array(z.string()) });
const FailureAnswer = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

/** Outcome of reading `get_my_access`. */
export type AccessOutcome =
  | { readonly kind: 'granted'; readonly access: StudioAccess }
  | { readonly kind: 'failed'; readonly code: string; readonly message: string };

/**
 * The Studio tools one person may use, as `get_my_access` lists them.
 *
 * Tools of other targets that Lumi trusts for everyone (the knowledge base) stay visible; any other tool of the
 * gateway is hidden, so a target added to the gateway reaches the model only once Lumi is told about it.
 */
export class StudioAccess {
  private constructor(private readonly granted: ReadonlySet<string>) {}

  /** No Studio tool: the person may not even read. */
  public static none(): StudioAccess {
    return new StudioAccess(new Set());
  }

  /** Reads the answer of `get_my_access`: the raw MCP result of the call. */
  public static fromToolResult(result: JSONValue): AccessOutcome {
    const parsed = CallToolResult.safeParse(result);
    if (!parsed.success) {
      return { kind: 'failed', code: 'unavailable', message: 'get_my_access answered with an unexpected shape.' };
    }
    const body = StudioAccess.body(parsed.data);
    const failure = FailureAnswer.safeParse(body);
    if (failure.success) {
      return { kind: 'failed', code: failure.data.error.code, message: failure.data.error.message };
    }
    const answer = AccessAnswer.safeParse(body);
    if (!answer.success || parsed.data.isError === true) {
      return { kind: 'failed', code: 'unavailable', message: 'get_my_access did not list the tools of the person.' };
    }
    return { kind: 'granted', access: new StudioAccess(new Set(answer.data.tools)) };
  }

  /**
   * Whether the model may see a tool.
   *
   * @param toolName - Name as the gateway lists it.
   * @param openTargets - Targets visible to everyone.
   */
  public allows(toolName: string, openTargets: readonly string[]): boolean {
    const target = targetOf(toolName);
    if (target === null) {
      return false;
    }
    if (target.startsWith(STUDIO_TARGET_PREFIX)) {
      return this.granted.has(toolName);
    }
    return openTargets.includes(target);
  }

  /** The JSON the tool answered: the structured content, or the first text block parsed as JSON. */
  private static body(result: z.infer<typeof CallToolResult>): unknown {
    if (result.structuredContent !== undefined) {
      return result.structuredContent;
    }
    const text = result.content.find((item) => item.type === 'text')?.text;
    if (text === undefined) {
      return undefined;
    }
    try {
      return JSON.parse(text);
    } catch {
      // Not JSON: the caller reports it as an unexpected answer.
      return undefined;
    }
  }
}
