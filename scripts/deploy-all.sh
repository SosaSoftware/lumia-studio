#!/usr/bin/env bash
#
# Deploys all of Lumia Studio (and Lumi) in order. Lumi needs two passes because the public entry gateway needs the
# runtime's ARN, and the web needs the entry gateway's URL. This script chains them, reading the outputs between passes.
#
#   1. Data, Identity, API, MCP, Agent gateways (MCP only), AgentRuntime.
#   2. Agent gateways again, now with the runtime ARN, to create the entry gateway.
#   3. Web, with the Lumi URL from pass 2.
#
# Credentials and region come from the environment. First time in an account: `npx cdk bootstrap` once.
#
#   LUMIA_AWS_REGION=us-east-1 scripts/deploy-all.sh
set -euo pipefail
cd "$(dirname "$0")/.."

REGION="${LUMIA_AWS_REGION:-${AWS_REGION:-us-east-1}}"
export LUMIA_AWS_REGION="$REGION" AWS_REGION="$REGION" AWS_DEFAULT_REGION="$REGION"
OUTPUTS=".sandbox/deploy-all-outputs.json"
mkdir -p .sandbox

cdk() { npx cdk "$@" --require-approval never --outputs-file "$OUTPUTS" --no-notices; }
output() {
  aws cloudformation describe-stacks --region "$REGION" --stack-name "$1" \
    --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue | [0]" --output text
}

echo "== Pass 1: the data and compute stacks, and the Lumi runtime"
cdk deploy LumiaStudioDataStack LumiaStudioIdentityStack LumiaStudioStack LumiaStudioMcpStack LumiaStudioAgentStack LumiaStudioAgentRuntimeStack

RUNTIME_ARN=$(output LumiaStudioAgentRuntimeStack RuntimeArn)
if [ -z "$RUNTIME_ARN" ] || [ "$RUNTIME_ARN" = "None" ]; then
  echo "Could not read the Lumi runtime ARN; stopping before the entry gateway." >&2
  exit 1
fi

echo "== Pass 2: the Lumi entry gateway, now that the runtime ARN is known"
LUMIA_LUMI_RUNTIME_ARN="$RUNTIME_ARN" cdk deploy LumiaStudioAgentStack --exclusively

LUMI_URL=$(output LumiaStudioAgentStack LumiUrl)
if [ -z "$LUMI_URL" ] || [ "$LUMI_URL" = "None" ]; then
  echo "Could not read the Lumi URL; stopping before the web." >&2
  exit 1
fi

echo "== Pass 3: the web, pointing at Lumi"
LUMIA_LUMI_URL="$LUMI_URL" cdk deploy LumiaStudioWebStack --exclusively

echo
echo "Done."
echo "  Web:  $(output LumiaStudioWebStack WebUrl)"
echo "  Demo: $(output LumiaStudioWebStack DemoUrl)"
echo "  Lumi: $LUMI_URL"
