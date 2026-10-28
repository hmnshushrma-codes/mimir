#!/bin/bash
set -e

echo "=== Mimir: Preparing npm package ==="

# 1. Build all packages
echo "Building..."
COREPACK_ENABLE_STRICT=0 pnpm build

# 2. Bundle CLI + server + shared + hooks into one file
echo "Bundling CLI..."
mkdir -p publish/dist

npx esbuild packages/cli/src/main.ts \
  --bundle \
  --platform=node \
  --target=node22 \
  --format=esm \
  --outfile=publish/dist/mimir.mjs \
  --external:fastify \
  --external:@fastify/websocket \
  --external:@fastify/static \
  --external:zod

# Ensure single shebang at top
sed -i '1{/^#!\/usr\/bin\/env node$/!i\#!/usr/bin/env node
}' publish/dist/mimir.mjs
# Remove any duplicate shebangs
awk 'NR==1{print;next} !/^#!\/usr\/bin\/env node$/' publish/dist/mimir.mjs > /tmp/mimir-clean.mjs
mv /tmp/mimir-clean.mjs publish/dist/mimir.mjs
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
    "node": ">=22.5.0"
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
