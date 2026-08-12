# claude code + text-only model pitfalls

Generic guidance for Claude Code verification, plus the image-read pitfall that bites any
text-only model.

## Standard config
| Path | Controls |
|---|---|
| `~/.claude/settings.json` | hooks, permissions, statusLine, model, env |
| `~/.claude/settings.local.json` | permission allow/deny, skillOverrides |
| `~/.claude/hooks/*.sh` | PreToolUse/PostToolUse/SessionStart logic |

## TUI smoke (tmux)
```bash
S=verify-claude
tmux kill-session -t $S 2>/dev/null
tmux new-session -d -s $S -x 240 -y 60 "TERM=xterm-256color claude"
for i in $(seq 1 90); do tmux capture-pane -t $S -p 2>/dev/null | grep -qE '❯|>|›' && break; sleep 1; done
tmux send-keys -t $S "/status" Enter; sleep 6
tmux capture-pane -t $S -p > /tmp/claude-status.txt
tmux send-keys -t $S "/exit" Enter; sleep 1; tmux kill-session -t $S 2>/dev/null
```
**Assert**: Model line matches the configured model (compare `verify.sh` "configured model"),
Setting sources include the expected ones, no `400`/provider error.

## The image-read pitfall (any text-only model)
A text-only model that `Read`s a `*.png`/`*.svg` injects an `image_url` message block, which
the API rejects: `400 unknown variant image_url, expected text`. If you get this error, some
hook/guard that should block image reads isn't firing. A scoped PreToolUse hook is the fix:
block `Read` of `*.png|*.svg` ONLY for the text-only harness (env marker), so vision-capable
harnesses stay unaffected.

Probe the hook directly:
```bash
printf '{"tool_input":{"file_path":"/tmp/probe.png"}}' \
  | CLAUDE_AGENT_ID=<text-only-harness> bash <hook-script>; echo "exit=$?"   # want 2 (block)
printf '{"tool_input":{"file_path":"/tmp/probe.png"}}' | bash <hook-script>; echo "exit=$?"  # want 0 (pass)
```

## Common failures
- Boot-to-shell instead of prompt: env/proxy/auth load-order problem; capture pane tail.
- `400 image_url`: image got Read; hook not wired (marker missing, settings hook dropped, script
  not executable).
- Text-only models are slow (multi-minute thought): boot ≥90s, probe ≥180s or you get false FAILs.
- A wrapper may be a shell alias, not a binary — use the full path in tmux/scripts.
