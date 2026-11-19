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
      "The Advisor runs as a separate GPT-6 Astra Codex inference with shell, MCP, app, web-search, and multi-agent tools disabled. It returns advice only; it cannot edit files or execute work.",
      "The main agent owns the final decision and implementation. Do not call for trivial reactive steps."
    ].join(" "),
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
