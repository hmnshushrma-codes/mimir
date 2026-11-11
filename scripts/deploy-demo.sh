#!/bin/bash
# Build, check, and deploy the public demo to Cloudflare Pages.
#
#   bash scripts/deploy-demo.sh
#
# Config comes from environment variables. Locally, put them in .env.demo at
# the repo root (gitignored; copy .env.demo.example). In CI they come from
# repository secrets. Variables already set in the environment win over the file.
#
#   CLOUDFLARE_API_TOKEN    Pages:Edit token — or, locally, skip it and use
#                           your `npx wrangler login` session instead
#   CLOUDFLARE_ACCOUNT_ID   required with a token
#   DEMO_PROJECT_NAME       optional — Pages project (default: mimir-demo)
#   DEMO_BRANCH             optional — Pages branch (default: main = production)
#   VITE_*                  optional — extra build-time vars for the demo bundle
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE="${DEMO_ENV_FILE:-.env.demo}"
if [ -f "$ENV_FILE" ]; then
  echo "Loading $ENV_FILE"
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in ''|'#'*) continue ;; esac
    key="${line%%=*}"
    value="${line#*=}"
    # Strip one layer of matching quotes
    if [[ "$value" =~ ^\"(.*)\"$ || "$value" =~ ^\'(.*)\'$ ]]; then value="${BASH_REMATCH[1]}"; fi
    # Real environment wins over the file
    if [ -z "${!key+x}" ]; then export "$key=$value"; fi
  done < "$ENV_FILE"
fi

WRANGLER="npx --yes wrangler@4"

if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
  if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
    echo "✗ CLOUDFLARE_API_TOKEN is set but CLOUDFLARE_ACCOUNT_ID is missing" >&2
    echo "  Set it in $ENV_FILE (see .env.demo.example) or export it." >&2
    exit 1
  fi
  echo "Auth: CLOUDFLARE_API_TOKEN"
elif $WRANGLER whoami >/dev/null 2>&1; then
  echo "Auth: wrangler login session"
else
  echo "✗ No Cloudflare credentials." >&2
  echo "  Either run \`npx wrangler login\`, or set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID" >&2
  echo "  in $ENV_FILE (see .env.demo.example)." >&2
  exit 1
fi

PROJECT_NAME="${DEMO_PROJECT_NAME:-mimir-demo}"
BRANCH="${DEMO_BRANCH:-main}"

bash scripts/build-demo.sh

echo ""
echo "=== Deploying to Cloudflare Pages ($PROJECT_NAME, branch: $BRANCH) ==="
$WRANGLER pages deploy packages/web/dist-demo \
  --project-name="$PROJECT_NAME" \
  --branch="$BRANCH" \
  --commit-dirty=true
