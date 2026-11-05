import { handler as interceptorHandler } from '../gateway-interceptor.ts';
import { MCP_TARGETS } from '../targets.ts';
import { createToolHandler, graphqlUrlFromEnv } from '../tool-handler.ts';
import type { GatewayToolHandler } from '../tool-handler.ts';

const targets = Object.values(MCP_TARGETS);
const options = { graphqlUrl: graphqlUrlFromEnv, targets };

/** Lambda entry points of the Studio MCP, one per gateway target. The CDK points each function here. */
export const readHandler: GatewayToolHandler = createToolHandler(MCP_TARGETS.read, options);
export const slidesHandler: GatewayToolHandler = createToolHandler(MCP_TARGETS.slides, options);
export const elementsHandler: GatewayToolHandler = createToolHandler(MCP_TARGETS.elements, options);
export const timelineHandler: GatewayToolHandler = createToolHandler(MCP_TARGETS.timeline, options);

/** Request interceptor of the gateway: copies the person's token into the propagated header the tools read. */
export const interceptor: typeof interceptorHandler = interceptorHandler;
