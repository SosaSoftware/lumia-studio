#!/usr/bin/env bash
#
# Copies a published class's .lumia file into the demo bucket, so /demo plays it.
# The class must be published first (that creates the .lumia in the published bucket).
#
# Usage:
#   scripts/publish-demo.sh <class-path>
# Example (the default):
#   scripts/publish-demo.sh aws-builder-center/hackathon-strands-sdk-workshop-to-ship/demo/demo-video.lumia
#
# Credentials and region come from the environment (the same ones used to deploy).
set -euo pipefail

CLASS_KEY="${1:-aws-builder-center/hackathon-strands-sdk-workshop-to-ship/demo/demo-video.lumia}"
STACK_REGION="${LUMIA_AWS_REGION:-${AWS_REGION:-us-east-1}}"

output() {
  aws cloudformation describe-stacks --region "$STACK_REGION" --stack-name "$1" \
    --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue | [0]" --output text
}

published=$(output LumiaStudioDataStack PublishedBucketName)
demo=$(output LumiaStudioWebStack DemoBucketName)
demo_key=$(output LumiaStudioWebStack DemoFileKey)

if [ "$published" = "None" ] || [ "$demo" = "None" ] || [ "$demo_key" = "None" ]; then
  echo "Could not read the stack outputs. Check the credentials and the region ($STACK_REGION)." >&2
  exit 1
fi

if ! aws s3api head-object --region "$STACK_REGION" --bucket "$published" --key "$CLASS_KEY" >/dev/null 2>&1; then
  echo "The class is not published yet: s3://$published/$CLASS_KEY" >&2
  echo "Open the class in Studio and press Publicar, then run this again." >&2
  exit 1
fi

aws s3 cp --region "$STACK_REGION" "s3://$published/$CLASS_KEY" "s3://$demo/$demo_key" --only-show-errors
echo "Copied $CLASS_KEY to the demo bucket. The demo shows it within a minute (CloudFront cache)."
