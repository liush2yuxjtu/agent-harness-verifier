#!/usr/bin/env node
import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = await mkdtemp(path.join(os.tmpdir(), "codex-advisor-smoke-"));
const codexHome = path.join(temp, "codex-home");
await mkdir(codexHome, {recursive: true});
const authPath = path.join(codexHome, "auth.json");
await writeFile(authPath, '{"token":"fake-auth"}', {mode: 0o600});
await chmod(authPath, 0o600);
await writeFile(path.join(codexHome, "config.toml"), [
  'model_provider = "custom"',
  "[model_providers.custom]",
  'base_url = "https://proxy.example"',
  "[mcp_servers.unrelated]",
  'command = "node"'
].join("\n"));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(root, "src", "index.js")],
  cwd: root,
  env: {
    ...process.env,
    CODEX_HOME: codexHome,
    CODEX_BIN: process.execPath,
    ADVISOR_CODEX_PREFIX_ARGS: JSON.stringify([path.join(root, "test", "fake-codex.js")]),
    ADVISOR_MODEL: "gpt-6-astra"
  }
});
const client = new Client({name: "codex-advisor-smoke", version: "0.1.0"});
try {
  await client.connect(transport);
  const tools = (await client.listTools()).tools;
  assert.ok(tools.some((tool) => tool.name === "advisor"), "advisor tool is missing");
  const result = await client.callTool({
    name: "advisor",
    arguments: {
      context: "User wants a local workflow. Main agent proposed a remote service. Existing CLI already performs the required task.",
      decision_point: "before_approach",
      focus: "Find the simplest reliable implementation."
    }
  });
  assert.equal(result.isError, undefined, result.content?.[0]?.text);
  const payload = JSON.parse(result.content?.[0]?.text ?? "{}");
  assert.equal(payload.model, "gpt-6-astra");
  assert.equal(payload.advice.verdict, "challenge");
  assert.match(payload.advice.simpler_alternative, /local CLI/);
  console.log("SMOKE PASS: advisor tool listed, invoked, and returned structured advice.");
} finally {
  await client.close().catch(() => {});
  await rm(temp, {recursive: true, force: true});
}
