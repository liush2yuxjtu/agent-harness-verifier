import test from "node:test";
import assert from "node:assert/strict";
import {chmod, mkdtemp, mkdir, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {runCodexAdvisor} from "../src/codex-runner.js";

const here = path.dirname(fileURLToPath(import.meta.url));

test("runs an isolated read-only advisor process and returns structured advice", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "advisor-runner-test-"));
  const codexHome = path.join(root, "codex-home");
  await mkdir(codexHome, {recursive: true});
  const authPath = path.join(codexHome, "auth.json");
  await writeFile(authPath, '{"token":"fake-auth"}', {mode: 0o600});
  await chmod(authPath, 0o600);
  await writeFile(path.join(codexHome, "config.toml"), ['model_provider = "custom"', '[model_providers.custom]', 'base_url = "https://proxy.example"', '[mcp_servers.unrelated]', 'command = "node"', '[plugins]', 'enabled = true'].join("\n"));

  const previousHome = process.env.CODEX_HOME;
  const previousBin = process.env.CODEX_BIN;
  const previousModel = process.env.ADVISOR_MODEL;
  const previousPrefixArgs = process.env.ADVISOR_CODEX_PREFIX_ARGS;
  const previousApiKey = process.env.OPENAI_API_KEY;
  const previousAnthropicKey = process.env.ANTHROPIC_API_KEY;
  process.env.CODEX_HOME = codexHome;
  process.env.CODEX_BIN = process.execPath;
  process.env.ADVISOR_CODEX_PREFIX_ARGS = JSON.stringify([path.join(here, "fake-codex.js")]);
  process.env.ADVISOR_MODEL = "gpt-6-astra";
  process.env.OPENAI_API_KEY = "must-not-pass";
  process.env.ANTHROPIC_API_KEY = "must-not-pass";
  try {
    const result = await runCodexAdvisor({context: "User wants a local tool. Main agent proposed a remote service. Existing CLI already provides the required function.", decision_point: "before_approach", focus: "Find the simplest viable architecture."});
    assert.equal(result.model, "gpt-6-astra");
    assert.equal(result.advice.verdict, "challenge");
    assert.match(result.advice.simpler_alternative, /local CLI/);
  } finally {
    if (previousHome === undefined) delete process.env.CODEX_HOME; else process.env.CODEX_HOME = previousHome;
    if (previousBin === undefined) delete process.env.CODEX_BIN; else process.env.CODEX_BIN = previousBin;
    if (previousModel === undefined) delete process.env.ADVISOR_MODEL; else process.env.ADVISOR_MODEL = previousModel;
    if (previousPrefixArgs === undefined) delete process.env.ADVISOR_CODEX_PREFIX_ARGS; else process.env.ADVISOR_CODEX_PREFIX_ARGS = previousPrefixArgs;
    if (previousApiKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousApiKey;
    if (previousAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = previousAnthropicKey;
    await rm(root, {recursive: true, force: true});
  }
});
