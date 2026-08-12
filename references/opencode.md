# opencode

OpenCode Zen Go terminal agent. Config `~/.config/opencode/` (JSONC, comments allowed).
Model set via `model` in `opencode.jsonc` (any provider).

## Paths
| Path | Controls |
|---|---|
| `~/.config/opencode/opencode.jsonc` | model, permission, agents, mcp (JSONC) |
| `~/.config/opencode/tui.json` | TUI plugin list |
| `~/.config/opencode/plugins/`, `~/.config/opencode/skills/` | extensions |
| `~/.config/opencode/command/` | custom slash commands |

## Static
`verify.sh`: opencode.jsonc parses (comments stripped) + tui.json valid.

## TUI smoke (tmux)
```bash
S=verify-opencode
tmux kill-session -t $S 2>/dev/null
tmux new-session -d -s $S -x 240 -y 50 "TERM=xterm-256color opencode"
for i in $(seq 1 45); do tmux capture-pane -t $S -p 2>/dev/null | grep -qE 'Ask anything|Sisyphus|Ultraworker|❯' && break; sleep 1; done
tmux capture-pane -t $S -p > /tmp/opencode-boot.txt
tmux send-keys -t $S "exit" Enter; sleep 1; tmux kill-session -t $S 2>/dev/null
```
**Assert**: header shows model `opencode-go/deepseek-v4-flash` (or the configured model), live
prompt, no plugin-load crash. Plugin errors (oh-my-openagent etc.) appear at boot — capture the
full pane, not just the last line.

## Common failures
- **Model mismatch**: the TUI header can show a different model than `opencode.jsonc`. Example
  (author's machine): config said `opencode-go/deepseek-v4-flash`, TUI showed
  `Sisyphus - Ultraworker · Kimi K3 OpenCode Go` — the oh-my-openagent plugin persona
  ("Sisyphus - Ultraworker") overrode the model at runtime. Confirm which one the user expects
  before calling it a bug — this is a runtime/config disagreement static checks can't see.
- Boot crash after config edit → opencode.jsonc comment/syntax error (verify.sh catches) or plugin
  version mismatch.
- Model unreachable → shared claudex proxy down; check `verify.sh` proxy section + `references/claude.md`.
- opencode reads JSONC (comments OK) — a tool that strict-parses as JSON will false-FAIL it.
