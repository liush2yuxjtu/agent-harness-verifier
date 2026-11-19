import { copyFile, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const CONFIG_BEGIN = "# BEGIN CODEX ADVISOR MCP";
const CONFIG_END = "# END CODEX ADVISOR MCP";
const PROMPT_BEGIN = "<!-- CODEX_ADVISOR_BEGIN -->";
const PROMPT_END = "<!-- CODEX_ADVISOR_END -->";
const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const configPath = path.join(codexHome, "config.toml");
const overridePath = path.join(codexHome, "AGENTS.override.md");
const defaultInstructionsPath = path.join(codexHome, "AGENTS.md");
const instructionsPath = (await stat(overridePath).catch(() => null)) ? overridePath : defaultInstructionsPath;

function backupPath(file) {
  const stamp = new Date().toISOString().replaceAll(/[-:.TZ]/g, "");
  return `${file}.bak.advisor-uninstall-${stamp}`;
}

async function main() {
  const existingConfig = await readFile(configPath, "utf8").catch(() => "");
  const existingInstructions = await readFile(instructionsPath, "utf8").catch(() => "");
  const nextConfig = existingConfig.includes(CONFIG_BEGIN)
    ? existingConfig.replace(new RegExp(`\\n?${CONFIG_BEGIN}[\\s\\S]*?${CONFIG_END}\\n?`), "\n").trimEnd() + "\n"
    : existingConfig;
  const nextInstructions = existingInstructions.includes(PROMPT_BEGIN)
    ? existingInstructions.replace(new RegExp(`\\n?${PROMPT_BEGIN}[\\s\\S]*?${PROMPT_END}\\n?`), "\n").trimEnd() + "\n"
    : existingInstructions;
  if (nextConfig === existingConfig && nextInstructions === existingInstructions) {
    console.log("No installer-managed Advisor blocks found. Nothing changed.");
    return;
  }
  for (const file of [configPath, instructionsPath]) {
    const contents = file === configPath ? existingConfig : existingInstructions;
    if (contents && await stat(file).catch(() => null)) await copyFile(file, backupPath(file));
  }
  if (nextConfig !== existingConfig) await writeFile(configPath, nextConfig, {mode: 0o600});
  if (nextInstructions !== existingInstructions) await writeFile(instructionsPath, nextInstructions, {mode: 0o600});
  console.log("Removed only the installer-managed Advisor blocks. Backups were retained.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
