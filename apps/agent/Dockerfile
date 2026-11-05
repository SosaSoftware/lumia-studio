# syntax=docker/dockerfile:1
#
# Image of Lumi for Amazon Bedrock AgentCore Runtime: linux/arm64, AG-UI on port 8080 (`POST /invocations`,
# `GET /ping`). Build it from the repository root, which holds the workspace and its lockfile:
#
#   docker buildx build --platform linux/arm64 -f apps/agent/Dockerfile -t lumi .
#
# The build stage bundles the agent with esbuild (`npm run build -w @lumia/agent`), so the runtime stage holds no
# `node_modules` at all: only the bundle and the files that define Lumi (prompts, skills and consent policy).

ARG NODE_IMAGE=public.ecr.aws/docker/library/node:22.23.4-bookworm-slim

# -- Build: install the workspace of the agent and bundle it ---------------------------------------------------
# The bundle is plain JavaScript, so this stage runs on the platform of the builder.
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS build
WORKDIR /repo

# Manifests first, so the dependency layer is reused while only sources change. npm checks every workspace of the
# lockfile, so all of them are copied.
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/agent/package.json apps/agent/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/package.json packages/
COPY sandbox/package.json sandbox/
# Only the agent and the root tools it builds with; no package needs install scripts.
RUN npm ci --workspace @lumia/agent --include-workspace-root --ignore-scripts --no-audit --no-fund

COPY packages/src packages/src
COPY apps/agent/tsconfig.json apps/agent/
COPY apps/agent/scripts apps/agent/scripts
COPY apps/agent/src apps/agent/src
RUN npm run build -w @lumia/agent

# -- Runtime ------------------------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime

# AgentCore Runtime runs arm64 containers only: fail here rather than at deployment.
RUN [ "$(uname -m)" = "aarch64" ] || { echo "Lumi runs on arm64 in AgentCore Runtime; build with --platform linux/arm64." >&2; exit 1; }

ENV NODE_ENV=production \
    LUMI_BIND_HOST=0.0.0.0 \
    LUMI_PORT=8080

WORKDIR /app
# Owned by root and read-only for the process: Lumi keeps its state in S3 and AgentCore Memory, not on disk.
COPY --from=build /repo/apps/agent/dist ./dist
COPY apps/agent/src/prompts ./src/prompts
COPY apps/agent/skills ./skills
COPY apps/agent/policies ./policies

# The `node` user of the official image (uid 1000).
USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.LUMI_PORT}/ping`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "--enable-source-maps", "dist/remote.mjs"]
