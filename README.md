# agent-harness-verifier

Verify any coding-agent harness on any machine — claude code, codex, pi, opencode, aider,
gemini CLI, and custom wrappers/proxies/hooks. Catches what static greps can't: the TUI boots
and loads the config you actually expect, not just what's valid on disk.

Built in public, shared as a Claude skill. Works on macOS / Linux.

## Why

Settings, hooks, env, auth, and model routing only really take effect when an agent **boots**.
A headless probe and a real TUI boot can disagree: hooks fire differently, status bars only
render in TUI, plugins override the configured model at runtime.

This skill launches the actual interactive TUI in **tmux**, drives it, captures the screen,
and compares what the agent *really* loaded against what the config says. The same technique
multi-agent terminal managers use, minus the agent layer.

## What it verifies

Per harness, automatically (skipped when not installed):

| Harness | Config | Checks |
|---|---|---|
| claude code | `~/.claude/settings.json` + hooks/ | JSON validity, hook refs resolve, model |
| codex | `~/.codex/config.toml` + `auth.json` + `hooks.json` | TOML/JSON validity, auth mode 0600, model |
| pi | `~/.pi/agent/settings.json` + `auth.json` + `trust.json` | JSON validity, auth mode 0600 |
| opencode | `~/.config/opencode/opencode.jsonc` + `tui.json` | JSONC validity (comments OK), model |

Plus: secret-file hygiene (auth.json / credentials must be mode 0600), custom/local layers
(proxies, model-pinning wrappers, env-scoped hooks — only when their files exist), and real
TUI boot smoke tests per harness.

## Install

Copy the skill into your Claude Code skills directory:

```bash
mkdir -p ~/.claude/skills
cp -r agent-harness-verifier ~/.claude/skills/
```

Then just ask: "verify my agent setup", "claude won't start after my config edit", "which model
is opencode really using", "verify my hooks".

## Usage

```bash
# what's installed + their config anchors
bash ~/.claude/skills/agent-harness-verifier/scripts/discover.sh

# full static + hygiene sweep (exits 1 on any FAIL)
bash ~/.claude/skills/agent-harness-verifier/scripts/verify.sh
```

The TUI smoke test runs through the skill (SKILL.md) — it needs a terminal, so it's driven by
Claude in your session, not as a standalone one-liner.

## Adding a harness or custom setup

1. **Config**: add an existence-gated block to `scripts/verify.sh` using the JSON/TOML/YAML/JSONC
   helpers, mirroring the existing ones.
2. **TUI**: document the launch command, boot marker, quit keys in `references/<harness>.md`.
3. **Custom local setup** (proxy, wrapper, scoped hooks): extend the "custom/local setup" block
   in `verify.sh` — it only runs when your files exist. The shipped example (claudex proxy +
   a wrapper pinning a text-only model with env-scoped hooks) shows the pattern.

## Security / privacy

- Never prints secret values (tokens, API keys, auth contents) — only validity and modes.
- Never modifies configs, sends data to any network, or reads outside agent config dirs.
- Secret files must be mode 0600; `verify.sh` flags anything else.
- Never requires root.

## License

MIT. See [LICENSE](LICENSE).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
