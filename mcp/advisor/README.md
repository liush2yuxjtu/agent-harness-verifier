# Codex Advisor MCP

A local MCP server that exposes one `advisor` tool to Codex. The parent agent passes the full relevant conversation context. The server starts a separate, ephemeral Codex inference using the existing Codex login and returns structured advice.

## Architecture

```text
Codex main agent
  └─ MCP tool: advisor(context, decision_point, focus)
       └─ isolated `codex exec` session (GPT-6 Astra by default)
            ├─ temporary CODEX_HOME
            ├─ same existing auth.json (symlinked; never printed)
            ├─ copied config with MCP / apps / plugin tables removed
            ├─ temporary advisor-only AGENTS.md
            ├─ read-only sandbox
            ├─ shell / unified exec / code mode / multi-agent / apps / plugins / web search disabled
            └─ JSON advice only
```

The MCP tool call is the parent-facing interface. Internally, this implementation uses a separate Codex CLI inference because a normal MCP server cannot automatically read its caller's transcript. The parent must therefore pass the complete relevant transcript in `context`.

This is not Anthropic's server-side Advisor implementation. Anthropic forwards the conversation internally and exposes no tools to its Advisor inference. Codex currently does not provide a stable `--no-tools` switch for `codex exec`; this server disables the available execution and delegation surfaces, runs in a read-only temporary workspace, and instructs the reviewer not to call tools. Treat this as a constrained, tool-less-by-policy fallback, not a cryptographic guarantee that the model receives zero tool declarations.

## Requirements

- Node.js 20+
- Codex CLI installed and logged in
- `~/.codex/auth.json` (or `$CODEX_HOME/auth.json`) with mode `0600`
- The Codex model `gpt-6-astra` available, or set `ADVISOR_MODEL`

The caller's `config.toml` is copied to a temporary Codex home with `mcp_servers`, `plugins`, and `apps` tables removed. Other model-provider routing settings are preserved. Temporary files are deleted after each call. The existing auth file is symlinked so Codex can use its current login; the server never reads or logs credential contents.

## Install into Codex

From the repository root:

```bash
npm --prefix mcp/advisor install
npm --prefix mcp/advisor test
npm --prefix mcp/advisor run install:codex
codex mcp list
```

The installer appends a clearly marked block to the active global Codex instructions file (`~/.codex/AGENTS.override.md` when present, otherwise `~/.codex/AGENTS.md`) and adds `[mcp_servers.advisor]` to `~/.codex/config.toml`. It backs up both files before editing and is idempotent.

Restart Codex after installation. The tool is named `advisor` on the MCP server `advisor`.

## Call contract

```json
{
  "context": "Full relevant conversation transcript, user goal and constraints, proposal, key tool calls/results, evidence, failures, and current state.",
  "decision_point": "before_approach",
  "focus": "Is there a simpler way to achieve the same goal?"
}
```

Decision points: `before_approach`, `stuck`, `approach_change`, `before_completion`, `user_challenge`, `other`.

The Advisor returns:

- `verdict`: `support`, `challenge`, or `insufficient_evidence`
- `rationale`
- `challenge`
- `simpler_alternative`
- `evidence_gaps`
- `risks`
- `recommended_next_step`

It does not ask the user questions or perform implementation. The parent agent owns the final decision and all work.

## Runtime environment

Optional environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `CODEX_BIN` | `codex` | Codex CLI executable |
| `CODEX_HOME` | `~/.codex` | Source Codex home for auth and provider config |
| `ADVISOR_MODEL` | `gpt-6-astra` | Independent reviewer model |
| `ADVISOR_TIMEOUT_MS` | `120000` | Maximum advisor call duration |

## Uninstall

```bash
npm --prefix mcp/advisor run uninstall:codex
```

The uninstaller removes only the marked Advisor blocks. It leaves all unrelated global instructions and Codex configuration intact. Backups remain available alongside the original files.

## Verify

```bash
npm --prefix mcp/advisor test
npm --prefix mcp/advisor run smoke
```

The tests use a fake Codex executable and do not spend model tokens. The smoke test verifies the MCP tool inventory and end-to-end tool call. A live call after installation also requires a working Codex login and model access.
