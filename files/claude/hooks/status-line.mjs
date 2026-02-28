/**
 * Status Line
 *
 * Outputs a formatted status line showing project, git status, model, and token usage.
 */
import { execSync } from "node:child_process";
import { stdin } from "node:process";

async function readStdin() {
  const chunks = [];
  for await (const chunk of stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf-8");
}

function getGitInfo(cwd) {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd,
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const porcelain = execSync("git status --porcelain", {
      cwd,
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const dirty = porcelain.length > 0;
    return ` ${branch}${dirty ? "*" : ""}`;
  } catch {
    return null;
  }
}

function formatStatusLine(data) {
  const projectDir = data.workspace?.project_dir ?? "";
  const cwd = data.cwd ?? projectDir;
  const project = projectDir.split("/").pop() || "unknown";

  const model = data.model?.display_name ?? "unknown";

  const contextWindow = data.context_window ?? {};
  const totalIn = contextWindow.total_input_tokens ?? 0;
  const totalOut = contextWindow.total_output_tokens ?? 0;
  const usedPercentage = contextWindow.used_percentage ?? 0;

  const inK = Math.floor(totalIn / 1000);
  const outK = Math.floor(totalOut / 1000);

  // Build segments
  const segments = [];

  // Project (and cwd if different)
  let projectSegment = `󰉋 ${project}`;
  if (cwd && cwd !== projectDir) {
    const cwdName = cwd.split("/").pop() || cwd;
    projectSegment += ` (${cwdName})`;
  }
  segments.push(projectSegment);

  // Git branch and dirty state
  const gitInfo = getGitInfo(cwd || projectDir);
  if (gitInfo) {
    segments.push(gitInfo);
  }

  // Model, tokens, and cost
  const cost = data.cost?.total_cost_usd ?? 0;
  const costStr = `$${cost.toFixed(2)}`;
  segments.push(`󰚩 ${model} ↓${inK}k ↑${outK}k ${costStr} (${usedPercentage}%)`);

  // Dim text: \x1b[2m, Reset: \x1b[0m
  return `\x1b[2m${segments.join(" │ ")}\x1b[0m`;
}

async function main() {
  const input = await readStdin();
  const data = JSON.parse(input);

  process.stdout.write(formatStatusLine(data));
}

main().catch(() => {
  // Fail silently - don't break status line
});
