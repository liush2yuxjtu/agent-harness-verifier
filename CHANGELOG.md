# Changelog

All notable changes to agent-harness-verifier.

## [0.3.0] - 2026-08-12
### Changed
- **Portable / any-machine.** Removed machine-specific assumptions (model names, custom wrapper
  internals, proxy details) from the core flow.
- Standard harness checks are now generic + existence-gated; custom/local setups (claudex proxy,
  model-pinning wrappers, env-scoped hooks) moved to an optional block that only runs when their
  files exist.
- Added secret-file hygiene sweep (auth.json / credentials must be mode 0600).
- Added informational "configured model" report so the TUI smoke test can compare what the agent
  *actually* loaded against config.

### Added
- README.md (public-facing), LICENSE (MIT), this changelog.

## [0.2.0] - 2026-08-12
### Added
- Multi-harness: codex, pi, opencode in addition to claude/openclaude/claudex.
- `scripts/discover.sh` enumerates installed harnesses.
- Per-harness references (references/claude.md, codex.md, pi.md, opencode.md).
- TOML parser fallback chain (tomllib → tomli → node js-toml) for machines without tomllib.
- JSONC-with-comments check for opencode.

### Fixed
- YAML config was parsed with the TOML parser (wrong) — added a dedicated YAML check.

## [0.1.0] - 2026-08-12
### Added
- Initial `openclaude-verifier`: static checks + claudex proxy health + raw TUI smoke test in
  tmux + block-image hook scoping probe for the openclaude text-only agent.
