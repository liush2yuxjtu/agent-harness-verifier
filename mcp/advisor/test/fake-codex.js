#!/usr/bin/env node
import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const outputIndex = args.indexOf("--output-last-message");
const schemaIndex = args.indexOf("--output-schema");
for (const feature of ["shell_tool", "unified_exec", "code_mode_host", "multi_agent", "apps", "plugins", "web_search"]) {
  if (!args.includes("--disable") || !args.includes(feature)) process.exit(21);
}
if (outputIndex < 0 || schemaIndex < 0) process.exit(22);
const home = process.env.CODEX_HOME;
const auth = await readFile(path.join(home, "auth.json"), "utf8");
const instructions = await readFile(path.join(home, "AGENTS.md"), "utf8");
const config = await readFile(path.join(home, "config.toml"), "utf8");
if (!auth.includes("fake-auth")) process.exit(23);
if (!instructions.includes("Do not call tools")) process.exit(24);
if (config.includes("mcp_servers") || config.includes("plugins")) process.exit(25);
await writeFile(args[outputIndex + 1], JSON.stringify({
  verdict: "challenge",
  rationale: "The current design adds an avoidable dependency.",
  challenge: "A separate service is not needed for this single local operation.",
  simpler_alternative: "Use the existing local CLI behind a narrow adapter.",
  evidence_gaps: ["Run the CLI with the target version."],
  risks: ["The CLI may change its output format."],
  recommended_next_step: "Prototype the adapter and test the observable result."
}));
