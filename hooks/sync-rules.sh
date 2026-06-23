#!/usr/bin/env bash
# Copies plugin-shipped rules into the current project's .claude/rules/ so the
# native Claude Code rules engine (path-glob scoping) picks them up.
# Plugins cannot register rules natively yet (anthropics/claude-code#21163),
# so this hook bridges the gap.
set -euo pipefail

SRC="${CLAUDE_PLUGIN_ROOT}/rules"
DEST="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/rules/pkvillanueva-setup"

# Nothing to sync if the plugin ships no rules.
[ -d "$SRC" ] || exit 0

mkdir -p "$DEST"
# Overwrite so plugin updates propagate. Namespaced subdir keeps these
# separate from the project's own hand-written rules.
cp -f "$SRC"/*.md "$DEST"/ 2>/dev/null || true

exit 0
