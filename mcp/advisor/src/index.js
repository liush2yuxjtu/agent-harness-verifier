#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createAdvisorServer } from "./server.js";

void serveStdio(createAdvisorServer);
console.error("Codex Advisor MCP running on stdio");
