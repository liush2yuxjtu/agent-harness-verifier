import test from "node:test";
import assert from "node:assert/strict";
import {ADVISOR_SCHEMA, buildAdvisorPrompt, mergeDenyReadPaths, parseAdvisorResponse, stripToolServersFromConfig, validateAdvisorInput} from "../src/core.js";

const validAdvice = {
  verdict: "challenge",
  rationale: "The proposed approach adds an unnecessary service.",
  challenge: "A local process already provides the required capability.",
  simpler_alternative: "Use the existing CLI with a narrow wrapper.",
  evidence_gaps: ["Confirm the installed CLI version."],
  risks: ["The CLI may not support a zero-tool mode."],
  recommended_next_step: "Prototype the wrapper with a fake executable."
};

test("requires full context and rejects oversized context", () => {
  assert.throws(() => validateAdvisorInput({context: "short"}), /context must contain/);
  assert.throws(() => validateAdvisorInput({context: "x".repeat(120_001)}), /exceeds/);
});

test("validates decision point and normalizes optional focus", () => {
  const input = validateAdvisorInput({context: "User goal, constraints, evidence, and current implementation state.", decision_point: "stuck", focus: "Find the root cause"});
  assert.equal(input.decision_point, "stuck");
  assert.equal(input.focus, "Find the root cause");
  assert.throws(() => validateAdvisorInput({context: "A sufficiently long context string.", decision_point: "invented"}));
});

test("advisor prompt requires evidence-based challenge and no tools", () => {
  const prompt = buildAdvisorPrompt({context: "User wants X. Agent proposed Y. Test evidence shows Y is too complex.", decision_point: "before_approach", focus: "Find a simpler alternative"});
  assert.match(prompt, /Do not agree merely/);
  assert.match(prompt, /Do not call tools/);
  assert.match(prompt, /<conversation_context>/);
  assert.match(prompt, /Test evidence shows Y is too complex/);
});

test("strips MCP, plugin, and app tables but preserves provider routing", () => {
  const source = ['model_provider = "custom"', '[model_providers.custom]', 'base_url = "https://proxy.example"', '[mcp_servers.docs]', 'command = "node"', '[mcp_servers.docs.env]', 'TOKEN = "secret"', '[plugins]', 'enabled = true', '[features]', 'shell_tool = true'].join("\n");
  const result = stripToolServersFromConfig(source);
  assert.match(result, /model_provider = "custom"/);
  assert.match(result, /base_url = "https:\/\/proxy.example"/);
  assert.match(result, /\[features\]/);
  assert.doesNotMatch(result, /mcp_servers|proxy\.example.*TOKEN|\[plugins\]/);
});

test("adds deny-read rules for private paths without losing existing rules", () => {
  const config = 'model = "gpt-6-astra"\n[permissions.filesystem]\ndeny_read = ["/existing/private"]\n[features]\nshell_tool = true\n';
  const result = mergeDenyReadPaths(config, ["/tmp/advisor-home", "/Users/tester/**"]);
  assert.match(result, /\/existing\/private/);
  assert.match(result, /\/tmp\/advisor-home/);
  assert.match(result, /\/Users\/tester\/\*\*/);
  assert.match(result, /\[features\]/);
});

test("fails closed on a multiline deny-read array", () => {
  const config = '[permissions.filesystem]\ndeny_read = [\n  "/existing/private",\n]\n';
  assert.throws(() => mergeDenyReadPaths(config, ["/tmp/advisor-home"]), /single-line array/);
});

test("parses valid advisor output and rejects malformed output", () => {
  assert.deepEqual(parseAdvisorResponse(JSON.stringify(validAdvice)), validAdvice);
  assert.throws(() => parseAdvisorResponse("not JSON"), /valid JSON/);
  assert.throws(() => parseAdvisorResponse(JSON.stringify({verdict: "support"})), /rationale/);
  assert.equal(ADVISOR_SCHEMA.additionalProperties, false);
});
