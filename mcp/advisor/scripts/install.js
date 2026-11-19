import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_BEGIN = "# BEGIN CODEX ADVISOR MCP";
const CONFIG_END = "# END CODEX ADVISOR MCP";
const PROMPT_BEGIN = "<!-- CODEX_ADVISOR_BEGIN -->";
const PROMPT_END = "<!-- CODEX_ADVISOR_END -->";
const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const configPath = path.join(codexHome, "config.toml");
const overridePath = path.join(codexHome, "AGENTS.override.md");
const defaultInstructionsPath = path.join(codexHome, "AGENTS.md");
const instructionsPath = (await stat(overridePath).catch(() => null)) ? overridePath : defaultInstructionsPath;
const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(here, "../src/index.js");
const promptSourcePath = path.resolve(here, "../../../prompts/codex-advisor.md");

function backupPath(file) {
  const stamp = new Date().toISOString().replaceAll(/[-:.TZ]/g, "");
  return `${file}.bak.advisor-${stamp}`;
}

async function backupIfPresent(file) {
  if (!(await stat(file).catch(() => null))) return null;
  const backup = backupPath(file);
  await copyFile(file, backup);
  return backup;
}

function escapeTomlString(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

async function main() {
  const promptBlock = await readFile(promptSourcePath, "utf8");
  if (!promptBlock.includes(PROMPT_BEGIN) || !promptBlock.includes(PROMPT_END)) throw new Error(`Prompt source is missing required markers: ${promptSourcePath}`);
  await mkdir(codexHome, {recursive: true, mode: 0o700});
  const existingConfig = await readFile(configPath, "utf8").catch(() => "");
  const existingInstructions = await readFile(instructionsPath, "utf8").catch(() => "");
  if (existingConfig.includes("[mcp_servers.advisor]") && (!existingConfig.includes(CONFIG_BEGIN) || !existingConfig.includes(CONFIG_END))) {
    throw new Error(`${configPath} already defines mcp_servers.advisor outside the installer markers; refusing to overwrite it.`);
  }
  const configBlock = [
    CONFIG_BEGIN,
    "[mcp_servers.advisor]",
    `command = "${escapeTomlString(process.execPath)}"`,
    `args = ["${escapeTomlString(serverPath)}"]`,
    "startup_timeout_sec = 30",
    "tool_timeout_sec = 180",
    CONFIG_END
  ].join("\n");
  const nextConfig = existingConfig.includes(CONFIG_BEGIN)
    ? existingConfig.replace(new RegExp(`${CONFIG_BEGIN}[\\s\\S]*?${CONFIG_END}`), configBlock)
    : `${existingConfig.trimEnd()}${existingConfig.trim() ? "\n\n" : ""}${configBlock}\n`;
  const nextInstructions = existingInstructions.includes(PROMPT_BEGIN)
    ? existingInstructions.replace(new RegExp(`${PROMPT_BEGIN}[\\s\\S]*?${PROMPT_END}`), promptBlock)
    : `${existingInstructions.trimEnd()}${existingInstructions.trim() ? "\n\n" : ""}${promptBlock}\n`;
  const configChanged = nextConfig !== existingConfig;
  const instructionsChanged = nextInstructions !== existingInstructions;
  const configBackup = configChanged ? await backupIfPresent(configPath) : null;
  const instructionsBackup = instructionsChanged ? await backupIfPresent(instructionsPath) : null;
  try {
    if (configChanged) await writeFile(configPath, nextConfig, {mode: 0o600});
    if (instructionsChanged) await writeFile(instructionsPath, nextInstructions, {mode: 0o600});
  } catch (error) {
    if (configBackup) await copyFile(configBackup, configPath);
    if (instructionsBackup) await copyFile(instructionsBackup, instructionsPath);
    throw error;
  }
  console.log(`Advisor MCP configured: ${serverPath}`);
  console.log(`${instructionsChanged ? "Global instructions updated" : "Global instructions already current"}: ${instructionsPath}`);
  if (configBackup) console.log(`Config backup: ${configBackup}`);
  if (instructionsBackup) console.log(`Instructions backup: ${instructionsBackup}`);
  console.log("Restart Codex, then verify with: codex mcp list");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
