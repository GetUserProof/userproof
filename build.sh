#!/bin/sh
# Regenerates plugin-dist/plugin from claude-plugin/ and mcp-server/. Run from anywhere.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
P="$HERE/plugin"
mkdir -p "$P/mcp" "$P/bin" "$P/skills/setup" "$P/skills/review" "$P/skills/go"
cp "$ROOT/claude-plugin/bin/wul-locate.mjs" "$P/bin/userproof-locate.mjs"
cp "$ROOT/claude-plugin/bin/userproof-brief.mjs" "$P/bin/userproof-brief.mjs"
# the one key resolver (source: mcp-server/keys.mjs), next to the hook in both places
cp "$ROOT/mcp-server/keys.mjs" "$ROOT/claude-plugin/bin/userproof-keys.mjs"
cp "$ROOT/mcp-server/keys.mjs" "$P/bin/userproof-keys.mjs"
mkdir -p "$P/hooks" && cp "$ROOT/claude-plugin/hooks/hooks.json" "$P/hooks/hooks.json"
cp "$ROOT/claude-plugin/skills/setup/SKILL.md" "$P/skills/setup/SKILL.md"
cp "$ROOT/claude-plugin/skills/review/SKILL.md" "$P/skills/review/SKILL.md"
cp "$ROOT/claude-plugin/skills/go/SKILL.md" "$P/skills/go/SKILL.md"
(cd "$ROOT/mcp-server" && [ -d node_modules ] || npm ci --silent)
cd "$ROOT/mcp-server"
npx --yes esbuild@0.25 index.js --bundle --platform=node --format=esm --target=node18 \
  --banner:js="import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" \
  --outfile="$P/mcp/server.mjs" --log-level=warning
echo "built $P ($(wc -c < "$P/mcp/server.mjs") bytes server.mjs)"
