#!/bin/bash
set -euo pipefail

# Only needed in Claude Code on the web — local dev machines already have gh.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

if command -v gh >/dev/null 2>&1; then
  exit 0
fi

# Install GitHub CLI from Ubuntu's own (universe) repos — avoids reaching
# cli.github.com, which this sandbox's egress policy blocks.
# Note: this only installs the `gh` binary. The GH_TOKEN/GITHUB_TOKEN set in
# this environment are scoped for the MCP GitHub server / git proxy, not for
# `gh` itself (`gh auth status` reports them invalid) — `gh` still needs its
# own `gh auth login` (or a real PAT in GH_TOKEN) to do anything.
if command -v apt-get >/dev/null 2>&1; then
  # Tolerate failures from unrelated third-party repos already configured in
  # the image (e.g. PPAs blocked by this sandbox's egress policy) — we only
  # need the Ubuntu archive/universe lists that gh comes from.
  sudo apt-get update -y || true
  sudo apt-get install -y gh
fi
