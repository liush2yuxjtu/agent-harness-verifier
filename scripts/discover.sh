#!/usr/bin/env bash
# discover.sh — enumerate installed agent harnesses + their config anchors.
set -uo pipefail
say(){ printf '%s\n' "$*"; }
find_bin(){ for d in ~/.local/node/bin ~/.bun/bin ~/.local/bin /opt/homebrew/bin /usr/local/bin; do
  [ -x "$d/$1" ] && { printf '%s' "$d/$1"; return; }
done; command -v "$1" 2>/dev/null; }

say "== claude family =="
cb=$(find_bin claude); [ -n "$cb" ] && say "  claude: $cb" || say "  claude: not found"
[ -f ~/.claude/settings.json ]        && say "  user settings: ~/.claude/settings.json"
[ -f ~/.claude/settings.local.json ]  && say "  local settings: ~/.claude/settings.local.json"
nh=$(ls ~/.claude/hooks/*.sh 2>/dev/null | wc -l | tr -d ' ')
[ "$nh" -gt 0 ]                       && say "  hooks: ~/.claude/hooks/ ($nh scripts)"
if [ -f ~/.local/bin/openclaude-run ]; then
  say "  openclaude: ~/.local/bin/openclaude-run (custom wrapper)"
  grep -q 'CLAUDE_AGENT_ID="openclaude"' ~/.local/bin/openclaude-run 2>/dev/null \
    && say "    marker: CLAUDE_AGENT_ID=openclaude"
fi
for w in claudex-run claudefast claudespark claudex-image; do
  [ -x ~/.local/bin/$w ] && say "  wrapper: ~/.local/bin/$w"
done
[ -f ~/.config/claudex/env ]                && say "  claudex env: ~/.config/claudex/env"
[ -f ~/.config/claudex/cli-proxy-api.yaml ] && say "  claudex proxy: ~/.config/claudex/cli-proxy-api.yaml"

say "== codex =="
cx=$(find_bin codex); [ -n "$cx" ] && say "  codex: $cx" || say "  codex: not found"
[ -f ~/.codex/config.toml ] && say "  config: ~/.codex/config.toml"
[ -f ~/.codex/auth.json ]  && say "  auth: ~/.codex/auth.json"
[ -f ~/.codex/hooks.json ] && say "  hooks: ~/.codex/hooks.json"

say "== pi =="
pb=$(find_bin pi); [ -n "$pb" ] && say "  pi: $pb" || say "  pi: not found"
[ -f ~/.pi/agent/settings.json ] && say "  settings: ~/.pi/agent/settings.json"
[ -f ~/.pi/agent/auth.json ]     && say "  auth: ~/.pi/agent/auth.json"
[ -f ~/.pi/agent/trust.json ]    && say "  trust: ~/.pi/agent/trust.json"

say "== opencode =="
ob=$(find_bin opencode); [ -n "$ob" ] && say "  opencode: $ob" || say "  opencode: not found"
[ -f ~/.config/opencode/opencode.jsonc ] && say "  config: ~/.config/opencode/opencode.jsonc"
[ -f ~/.config/opencode/tui.json ]       && say "  tui: ~/.config/opencode/tui.json"

say "== herdr (runtime) =="
if command -v herdr >/dev/null 2>&1; then
  herdr agent list 2>/dev/null | jq -r '.result.agents[] | "  "+.pane_id+" "+.agent_status+" "+(.name // "-")+" "+(.terminal_title_stripped // "")' | head -20
else
  say "  herdr: not found"
fi
