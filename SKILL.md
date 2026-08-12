---
name: agent-harness-verifier
description: Verify any changes to ANY coding-agent harness on ANY machine — claude code, codex, pi, opencode, aider, gemini CLI, and custom wrappers/proxies/hooks. Use whenever the user asks to "verify my agent/claude/codex/pi/opencode setup", "did my settings change work", "claude/codex/pi/opencode won't start or errors after a config edit", "is the proxy up", "which model is X really using", "verify my hooks", or mentions editing config under ~/.claude, ~/.codex, ~/.pi, ~/.config/opencode, ~/.aider.conf.yml, ~/.gemini. Verifies with the real raw TUI inside tmux, not just static grep — it catches runtime/config disagreements (wrong model loaded, plugin overriding config, hooks not firing) that static checks can't see. Triggers for ANY harness even if the user doesn't name the skill.
---

# agent-harness-verifier

Checks that coding-agent harnesses actually work **in the real environment**: static config
sanity → secret-file hygiene → TUI launch in tmux → functional probe. Portable: works on any
macOS/Linux machine, detects only what's installed, and checks custom/local setups only when
their files exist.

Why raw TUI + tmux: settings, hooks, env, auth, and model routing only really take effect when
the agent boots. A headless probe and a TUI boot can disagree (hooks fire differently, status
bars only render in TUI, settings load order differs). tmux gives a real PTY to launch the
interactive TUI, drive it with keys, and capture the screen.

## Compatibility
- macOS / Linux. Requires: `bash`, `tmux`, `python3` (JSON/TOML/YAML checks), `jq` (discover).
- Each harness you verify must be installed (`command -v <harness>`).
- Never requires root, never sends data anywhere.

## Standard harnesses (auto-detected, existence-gated)

| Harness | Config location | Format |
|---|---|---|
| claude code | `~/.claude/settings.json` (+ `.local.json`, `hooks/`) | JSON |
| codex | `~/.codex/config.toml` + `auth.json` + `hooks.json` | TOML / JSON |
| pi | `~/.pi/agent/settings.json` + `auth.json` + `trust.json` | JSON |
| opencode | `~/.config/opencode/opencode.jsonc` + `tui.json` | JSONC |

`verify.sh` skips a harness entirely when its config dir is absent — it works on any machine
regardless of which agents are installed.

## Custom/local setups (optional, extendable)

Standard harnesses cover most machines. Some people run custom layers on top: a local model
proxy, a wrapper that pins a text-only model, env-scoped hooks. These are checked ONLY when
their files exist — see the "custom/local setup" block in `verify.sh` and edit it to match
your own machine. Example that ships in the repo (claudex proxy + a wrapper pinning a model):
- wrapper exports a scoping marker (e.g. `CLAUDE_AGENT_ID=...`) so hooks only fire for it;
- wrapper pins `ANTHROPIC_MODEL` (a text-only model can't process images — a `Read` of
  `*.png`/`*.svg` injects an `image_url` block the API rejects with `400 unknown variant
  `image_url``);
- proxy env file stays mode 0600 + loopback-only.

## Workflow

### 1. Detect what changed + discover harnesses
If the user didn't name the file, find recent edits:
```bash
find ~/.claude ~/.codex ~/.pi ~/.config/opencode ~/.aider.conf.yml ~/.gemini \
  -maxdepth 2 -type f -mtime -1 -not -name '*.bak*' -not -path '*/logs/*' -not -path '*/.pi/*/tasks/*' 2>/dev/null
```
Then enumerate what's installed:
```bash
bash ~/.claude/skills/agent-harness-verifier/scripts/discover.sh
```
Verify the named/changed harnesses, then run the full sweep regardless.

### 2. Static + hygiene sweep
```bash
bash ~/.claude/skills/agent-harness-verifier/scripts/verify.sh
```
Covers: config validity (JSON / TOML / JSONC-with-comments), secret-file mode 0600, hook scripts
referenced in settings exist + executable, configured model per harness (informational — compare
against what the TUI actually loads), and any custom/local proxy health. `RESULT: ALL PASS`
(exit 0) or a numbered FAIL list. **Never prints secret contents** — only validity and modes.

### 3. Raw TUI smoke test (tmux)
Launch the actual interactive TUI and read the screen — catches runtime breakage static checks
can't. Per harness, the key asserts differ:
- boot marker: each TUI shows a different "ready" screen (claude `❯`, opencode welcome, codex/pi prompt).
- model line: compare the TUI's shown model against the configured model (step 2) — a mismatch
  means a plugin/preset is overriding config at runtime (opencode's oh-my-openagent personas do
  this; verify which one the user expects before calling it a bug).
- no provider/auth error, no crash-to-shell.

Generic recipe:
```bash
S=verify-<harness>
tmux kill-session -t $S 2>/dev/null
tmux new-session -d -s $S -x 240 -y 50 "TERM=xterm-256color <launch-cmd>"
for i in $(seq 1 90); do
  tmux capture-pane -t $S -p 2>/dev/null | grep -qE '<boot-marker>' && break; sleep 1
done
tmux capture-pane -t $S -p > /tmp/<harness>-boot.txt
tmux send-keys -t $S "<quit-keys>" Enter; sleep 1
tmux kill-session -t $S 2>/dev/null
```
If boot never reaches a prompt, capture the pane to a file and show the user the last 10-15
lines — that's the real startup error. Kill every `verify-*` session when done.

### 4. Functional probes
Test the behavior that matters for the change under test. Canonical example: a text-only model
harness must NOT be able to `Read` an image file (injects `image_url`, API rejects). Probe a
pre-tool hook directly:
```bash
printf '{"tool_input":{"file_path":"/tmp/probe.png"}}' \
  | CLAUDE_AGENT_ID=<harness> bash <hook-script>; echo "exit=$?"   # want block (2)
printf '{"tool_input":{"file_path":"/tmp/probe.png"}}' | bash <hook-script>; echo "exit=$?"  # want pass (0)
```

### 5. Report
Verdict table — one row per harness checked: PASS/FAIL + one-line evidence + raw FAIL lines.
Say explicitly which harnesses were skipped (not installed). If a shared proxy was the failing
piece, report it first (it cascades to every harness routed through it). Call out any
runtime-vs-config model mismatch.

## Extending: add a harness or custom check
1. Config: add the config path + format to `verify.sh` (JSON/TOML/YAML/JSONC helper) in an
   existence-gated block, mirroring the existing ones.
2. TUI: note the launch command, boot marker, quit keys in a `references/<harness>.md` file and
   point to it from here.
3. Custom local setup: extend the "custom/local setup" block — it only runs when your files exist.

## Security / privacy (important)
- The skill never prints secret values (tokens, API keys, auth contents) — only validity + modes.
- It never modifies configs, never sends data to any network, never reads outside `$HOME` agent
  config dirs.
- Secret files (auth.json, credentials, env with tokens) should be mode 0600; `verify.sh` flags
  anything else.
- If a harness binary is invoked during a probe, it runs as your user — don't point probes at
  untrusted workdirs.

## Gotchas
- Harness binaries may live in non-PATH locations (`~/.local/bin`, `~/.bun/bin`, npm prefix).
  `discover.sh` searches common ones; a custom wrapper may be a shell alias, not a binary — use
  the full path in tmux/scripts.
- Some wrappers reject CLI `--model`/`--settings` overrides by design — that's a feature, not a
  FAIL.
- Text-only models are slow (multi-minute thought): boot ≥90s, probe ≥180s or you get false FAILs.
- opencode.jsonc allows comments — use the comment-stripping check, not strict JSON.
- Don't kick off real work in a verify TUI (esp. pi tasks/loops, opencode sessions) — boot + read
  status + exit only.
