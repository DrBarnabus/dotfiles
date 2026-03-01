/**
 * Status Line
 *
 * Outputs a formatted status line showing project, git status, model, and token usage.
 * Colours use ANSI codes mapped to Catppuccin Mocha via terminal colour scheme.
 */
import { execSync } from "node:child_process";
import { basename } from "node:path";
import { stdin } from "node:process";

const RESET = "\x1b[0m";
const WHITE = "\x1b[37m";
const BLUE = "\x1b[34m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const PURPLE = "\x1b[35m";
const DIM = "\x1b[2m";

const SEP = `${DIM} \u2502 ${RESET}`;

const ICON_FOLDER = "\u{F024B}";
const ICON_GIT = "\u{E0A0}";
const MODEL_ICONS = ["\u{F06A9}", "\u{F169D}", "\u{F169F}", "\u{F16A1}", "\u{F16A3}", "\u{F1719}", "\u{F16A5}"];

async function readStdin() {
  const chunks = [];
  for await (const chunk of stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf-8");
}

function buildProjectSegment(data) {
  const projectDir = data.workspace?.project_dir ?? "";
  const cwd = data.cwd ?? projectDir;

  const project = projectDir ? basename(projectDir) : "unknown";

  let segment = `${BLUE}${ICON_FOLDER}${WHITE} ${project}`;
  if (cwd && cwd !== projectDir) {
    segment += ` (${cwd})`;
  }

  return segment;
}

function buildGitSegment(data) {
  const cwd = data.cwd ?? data.workspace?.project_dir ?? "";
  if (!cwd) return null;

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

    const dirtyMarker = porcelain.length > 0 ? `${YELLOW}*${RESET}` : "";
    return `${GREEN}${ICON_GIT}${WHITE} ${branch}${dirtyMarker}`;
  } catch {
    return null;
  }
}

function buildModelSegment(data) {
  const model = data.model?.display_name ?? "unknown";
  const modelIcon = MODEL_ICONS[Math.floor(Math.random() * MODEL_ICONS.length)];

  const contextWindow = data.context_window ?? {};
  const totalIn = contextWindow.total_input_tokens ?? 0;
  const totalOut = contextWindow.total_output_tokens ?? 0;
  const usedPercentage = contextWindow.used_percentage ?? 0;

  const inK = Math.floor(totalIn / 1000);
  const outK = Math.floor(totalOut / 1000);

  const cost = data.cost?.total_cost_usd ?? 0;
  const costStr = `$${cost.toFixed(2)}`;

  let contextColour = "";
  if (usedPercentage >= 90) {
    contextColour = RED;
  } else if (usedPercentage >= 70) {
    contextColour = YELLOW;
  }
  const contextStr = `${contextColour}(${usedPercentage}%)${contextColour ? RESET : ""}`;

  return `${PURPLE}${modelIcon}${WHITE} ${model} ${costStr} \u2193${inK}k \u2191${outK}k ${contextStr}`;
}

function formatStatusLine(data) {
  const parts = [buildProjectSegment(data)];

  const gitSegment = buildGitSegment(data);
  if (gitSegment) parts.push(gitSegment);

  parts.push(buildModelSegment(data));

  return parts.join(SEP);
}

async function main() {
  const input = await readStdin();
  const data = JSON.parse(input);

  process.stdout.write(formatStatusLine(data));
}

main().catch(() => {
  // Fail silently - don't break status line
});
