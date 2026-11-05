import type { z } from 'zod';
import type { GatewaySchema, GatewayToolSchema } from './gateway-schema.ts';
import { toGatewaySchema } from './gateway-schema.ts';
import type { StudioGraphql } from './studio-graphql.ts';
import { ToolError } from './tool-error.ts';

/** One Lambda target of the gateway: its name prefixes the tool names (`<target>___<tool>`). */
export interface McpTarget {
  readonly name: string;
  readonly description: string;
  readonly tools: readonly StudioTool[];
}

/** What a tool gets for one call: the Studio API as the person who asked, and every target of the MCP. */
export interface ToolContext {
  readonly studio: StudioGraphql;
  readonly targets: readonly McpTarget[];
}

/** A tool of the Studio MCP. Studio checks the permission; `action` only documents which one applies. */
export interface StudioTool {
  readonly name: string;
  readonly description: string;
  readonly action: string;
  readonly inputSchema: GatewaySchema;
  call(args: unknown, context: ToolContext): Promise<unknown>;
}

interface ToolSpec<TSchema extends z.ZodType> {
  readonly name: string;
  readonly description: string;
  readonly action: string;
  readonly input: TSchema;
  run(args: z.output<TSchema>, context: ToolContext): Promise<unknown>;
}

export function defineTool<TSchema extends z.ZodType>(spec: ToolSpec<TSchema>): StudioTool {
  return {
    name: spec.name,
    description: spec.description,
    action: spec.action,
    inputSchema: toGatewaySchema(spec.input),
    async call(args: unknown, context: ToolContext): Promise<unknown> {
      const parsed = spec.input.safeParse(args ?? {});
      if (!parsed.success) {
        throw ToolError.invalidInput(
          parsed.error.issues.map((issue) => `${issue.path.length === 0 ? 'entrada' : issue.path.map(String).join('.')}: ${issue.message}`).join('; '),
        );
      }
      return spec.run(parsed.data, context);
    },
  };
}

export function gatewayToolSchema(tool: StudioTool): GatewayToolSchema {
  return { name: tool.name, description: tool.description, inputSchema: tool.inputSchema };
}
