#!/bin/bash
set -e

echo "=== Mimir: Preparing npm package ==="

# 1. Build all packages
echo "Building..."
COREPACK_ENABLE_STRICT=0 pnpm build

# 2. Bundle CLI + server + shared + hooks into one file
echo "Bundling CLI..."
mkdir -p publish/dist

# bin.ts is the entry; --splitting keeps main.ts (and its fastify/sqlite
# imports) in a separate chunk so the Node version check runs first.
npx esbuild packages/cli/src/bin.ts \
  --bundle \
  --splitting \
  --platform=node \
  --target=node22 \
  --format=esm \
  --outdir=publish/dist \
  --entry-names=mimir \
  --out-extension:.js=.mjs \
  --external:fastify \
  --external:@fastify/websocket \
  --external:@fastify/static \
  --external:zod

# Ensure exactly one shebang at top (portable across GNU/BSD tools)
{ echo '#!/usr/bin/env node'; grep -v '^#!/usr/bin/env node$' publish/dist/mimir.mjs; } > publish/dist/mimir.tmp
mv publish/dist/mimir.tmp publish/dist/mimir.mjs
chmod +x publish/dist/mimir.mjs

# 3. Copy pre-built web app (static files served by the server)
echo "Copying web assets..."
cp -r packages/web/dist publish/dist/web

# 4. Copy hook runner script (deployed to user's ~/.claude/)
echo "Copying hook runner..."
cp packages/hooks/dist/hook-runner.js publish/dist/hook-runner.js

# 5. Create package.json
cat > publish/package.json << 'EOF'
{
  "name": "mimir-dev",
  "version": "0.1.0",
  "description": "Mimir — live animated visualization for Claude Code sessions. Watch your AI agents work in a workshop room.",
  "type": "module",
  "bin": {
    "mimir": "./dist/mimir.mjs"
  },
  "files": [
    "dist/"
  ],
  "engines": {
    "node": ">=22.13.0"
  },
  "keywords": [
    "claude", "claude-code", "agent", "visualization",
    "hooks", "developer-tools", "ai", "mimir"
  ],
  "author": "Himanshu Sharma",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/hmnshushrma-codes/mimir.git"
  },
  "homepage": "https://github.com/hmnshushrma-codes/mimir",
  "dependencies": {
    "fastify": "^5.1.0",
    "@fastify/websocket": "^11.0.1",
    "@fastify/static": "^10.1.7",
    "zod": "^3.23.8"
  }
}
EOF

# 6. Copy README
cp README.md publish/

echo ""
echo "=== Done! ==="
echo "To publish:  cd publish && npm publish"
echo "To test:     node publish/dist/mimir.mjs --help"
