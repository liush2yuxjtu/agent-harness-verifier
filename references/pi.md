# pi (π agent)

Terminal agent framework. Home `~/.pi/`, per-agent config under `~/.pi/agent/`.
Managed by herdr as `--kind pi`. Runs its own TUI.

## Paths
| Path | Controls |
|---|---|
| `~/.pi/agent/settings.json` | pi agent settings (JSON) |
| `~/.pi/agent/auth.json` | credentials — mode 0600 |
| `~/.pi/agent/trust.json` | tool trust / approval rules |
| `~/.pi/agent/models-store.json` | model store |
| `~/.pi/agent/prompts/` | prompt templates |
| `~/.pi/skills/`, `~/.pi/tasks/`, `~/.pi/loops/` | skill + task state |

## Static
`verify.sh`: settings.json valid, auth.json mode 0600 (if present), trust.json valid.

## TUI smoke (tmux)
```bash
S=verify-pi
tmux kill-session -t $S 2>/dev/null
tmux new-session -d -s $S -x 240 -y 50 "TERM=xterm-256color pi"
for i in $(seq 1 45); do tmux capture-pane -t $S -p 2>/dev/null | grep -qE '❯|>|›' && break; sleep 1; done
tmux capture-pane -t $S -p > /tmp/pi-boot.txt
tmux send-keys -t $S "exit" Enter; sleep 1; tmux kill-session -t $S 2>/dev/null
```
**Assert**: live prompt, no auth crash. If it errors on auth/trust, inspect the pane tail and
`~/.pi/agent/` mode/ownership.

## Common failures
- Auth/session errors at boot → auth.json missing or trust.json malformed.
- pi spawns long-running child processes (tasks/loops) — a verify session is read-only, don't kick
  off real work; just boot + exit.
