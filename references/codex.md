# codex (OpenAI Codex CLI)

OpenAI's coding agent CLI. TUI-like REPL. Model/provider configured via `~/.codex/config.toml`
+ `~/.codex/auth.json` (OAuth/API credentials). If the machine has a local proxy, codex models
can route through it via `oauth-model-alias` — verify the alias names match the discovered
upstream models.

## Paths
| Path | Controls |
|---|---|
| `~/.codex/config.toml` | model, providers, mcp_servers, permissions |
| `~/.codex/auth.json` | credentials — must be mode 0600 |
| `~/.codex/hooks.json` | codex hooks (currently `{"hooks":{}}`) |
| `~/.codex/sessions/` | session store |

## Static
`verify.sh`: config.toml TOML-valid, auth.json JSON-valid + mode 0600, hooks.json valid.

## TUI smoke (tmux)
```bash
S=verify-codex
tmux kill-session -t $S 2>/dev/null
tmux new-session -d -s $S -x 240 -y 50 "TERM=xterm-256color codex"
for i in $(seq 1 45); do tmux capture-pane -t $S -p 2>/dev/null | grep -qE '❯|>|λ|&gt;' && break; sleep 1; done
tmux capture-pane -t $S -p > /tmp/codex-boot.txt
tmux send-keys -t $S "/quit" Enter; sleep 1; tmux kill-session -t $S 2>/dev/null
```
**Assert**: pane shows a live input prompt (not an auth/login crash screen, not a stack trace).
If it lands on a login/OAuth screen, auth is the problem — check `~/.codex/auth.json` mode and
the provider/proxy alias config. If the header shows a model, note which — compare it against
`verify.sh`'s "configured model".

## Common failures
- Auth prompt at boot → `auth.json` missing/expired/mode too open.
- Model errors → proxy `oauth-model-alias` misconfiguration (upstream GPT-5.6 IDs changed).
- config.toml syntax error → codex refuses to start; `codex --version` won't catch it, read the pane.
- Codex is NOT a Claude Code settings consumer — don't check `~/.claude` for codex issues.
