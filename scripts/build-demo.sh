#!/bin/bash
# Build and check the public demo. Deploying is scripts/deploy-demo.sh.
#
#   bash scripts/build-demo.sh            Build + check
#   bash scripts/build-demo.sh --preview  Build + check, then serve locally
#
# Output goes to packages/web/dist-demo — NOT packages/web/dist, which the npm
# package ships. A demo build there would leak into the next npm release.
set -euo pipefail

cd "$(dirname "$0")/.."

OUT_DIR="packages/web/dist-demo"
MODE="${1:-check}"

echo "=== Mimir: Building demo ==="

pnpm --filter @agent-workshop/shared run build
pnpm --filter @agent-workshop/web exec tsc -b
VITE_DEMO=true pnpm --filter @agent-workshop/web exec vite build --outDir dist-demo --emptyOutDir

echo ""
echo "=== Checking demo build ==="

fail() { echo "✗ $1" >&2; exit 1; }

[ -f "$OUT_DIR/index.html" ] || fail "$OUT_DIR/index.html is missing"
ls "$OUT_DIR"/assets/*.js >/dev/null 2>&1 || fail "no JS assets in $OUT_DIR/assets"
echo "✓ index.html and assets present"

# The demo is public: it must never talk to a visitor's local collector.
if grep -lE "localhost|127\.0\.0\.1" "$OUT_DIR"/assets/*.js; then
  fail "demo bundle references localhost (files above) — it would reach visitors' local Mimir"
fi
echo "✓ no localhost / 127.0.0.1 references in the bundle"

SIZE=$(du -sh "$OUT_DIR" | cut -f1)
echo "✓ build size: $SIZE"

case "$MODE" in
  check)
    echo ""
    echo "Demo build OK: $OUT_DIR"
    echo "Preview:  bash scripts/build-demo.sh --preview"
    echo "Deploy:   bash scripts/deploy-demo.sh"
    ;;
  --preview)
    echo ""
    echo "=== Serving demo at http://localhost:4173 (Ctrl+C to stop) ==="
    pnpm --filter @agent-workshop/web exec vite preview --outDir dist-demo --port 4173
    ;;
  *)
    fail "unknown option: $MODE (use --preview)"
    ;;
esac
