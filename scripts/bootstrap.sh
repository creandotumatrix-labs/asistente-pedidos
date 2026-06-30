#!/usr/bin/env bash
# One-command setup. Verifies Node, installs deps, creates .env, runs checks.
set -euo pipefail
cd "$(dirname "$0")/.."

node -e 'const m=+process.versions.node.split(".")[0]; if(m<22){console.error("✗ Node >=22 required (got "+process.version+"). The test/demo/validate scripts use native TS type-stripping.");process.exit(1)}'
echo "✓ $(node -v)"

if [ ! -f .env ]; then cp .env.example .env; echo "✓ created .env  → add ANTHROPIC_API_KEY"; else echo "✓ .env exists"; fi

npm install
npm run validate
npm test

echo
echo "Bootstrap OK."
echo "Next:"
echo "  1) put ANTHROPIC_API_KEY in .env (or a Codespaces secret)"
echo "  2) npm run preflight        # proves the live Claude loop end-to-end"
echo "  3) npm start                # webhook + board on :8080  (see CODESPACES.md to wire WhatsApp)"
