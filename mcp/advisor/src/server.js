import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import { validateAdvisorInput } from "./core.js";
import { runCodexAdvisor } from "./codex-runner.js";

export function createAdvisorServer() {
  const server = new McpServer({name: "codex-advisor", version: "0.1.0"});
  server.registerTool("advisor", {
    description: [
      "Read-only independent strategic review. Call before committing to a non-trivial approach, when stuck or changing approach, and before declaring completion.",
      "Pass the full relevant conversation context, not a one-line summary: user goal and constraints, proposed approach, key tool calls and results, evidence, failed attempts, and current state. Exclude credentials and unrelated private data.",
      "The Advisor runs in a separate ephemeral Codex session. User MCP servers, apps, and plugins are removed. Shell and code tools are disabled where supported; the child uses a read-only sandbox and deny-read rules for the user home and temporary credential/config files. The reviewer is instructed not to call tools.",
      "The main agent owns the final decision and implementation. Do not call for trivial reactive steps."
    ].join(" "),
    outputSchema: z.object({
      model: z.string(),
      decision_point: z.string(),
      advice: z.object({
        verdict: z.enum(["support", "challenge", "insufficient_evidence"]),
        rationale: z.string(),
        challenge: z.string(),
        simpler_alternative: z.string(),
        evidence_gaps: z.array(z.string()),
        risks: z.array(z.string()),
        recommended_next_step: z.string()
      })
    }),
    inputSchema: z.object({
      context: z.string().min(20).max(120_000).describe("Full relevant transcript: task, constraints, proposed solution, key tool calls/results, evidence, failures, and current state."),
      decision_point: z.enum(["before_approach", "stuck", "approach_change", "before_completion", "user_challenge", "other"]).default("before_approach"),
      focus: z.string().max(4_000).optional().describe("Optional specific question. The full context remains required.")
    })
  }, async (input) => {
    try {
      const validated = validateAdvisorInput(input);
      const result = await runCodexAdvisor(validated);
      return {content: [{type: "text", text: JSON.stringify(result, null, 2)}], structuredContent: result};
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {isError: true, content: [{type: "text", text: JSON.stringify({ok: false, error: message})}]};
    }
  });
  return server;
}
