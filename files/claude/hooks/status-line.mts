/**
 * Status Line
 *
 * Outputs a formatted status line showing project, git status, model, and token usage.
 * Colours use ANSI codes mapped to Catppuccin Mocha via terminal colour scheme.
 */
import { execSync } from "node:child_process";
import { basename } from "node:path";

import { readInput, type StatusLineInput } from "./lib.mts";

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

function buildProjectSegment(data: StatusLineInput): string {
  const projectDir = data.workspace.project_dir;
  const project = projectDir ? basename(projectDir) : "unknown";

  let segment = `${BLUE}${ICON_FOLDER}${WHITE} ${project}`;
  if (data.cwd !== projectDir) {
    segment += ` (${data.cwd})`;
  }

  return segment;
}

function buildGitSegment(data: StatusLineInput): string | null {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: data.cwd,
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const porcelain = execSync("git status --porcelain", {
      cwd: data.cwd,
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

function buildModelSegment(data: StatusLineInput): string {
  const model = data.model.display_name.replace(/\s*\(.*?\)/, "");
  const modelIcon = MODEL_ICONS[Math.floor(Math.random() * MODEL_ICONS.length)];

  const usedPercentage = data.context_window.used_percentage ?? 0;
  const inK = Math.floor(data.context_window.total_input_tokens / 1000);
  const outK = Math.floor(data.context_window.total_output_tokens / 1000);

  const costStr = `$${data.cost.total_cost_usd.toFixed(2)}`;

  let contextColour = "";
  if (usedPercentage >= 90) {
    contextColour = RED;
  } else if (usedPercentage >= 70) {
    contextColour = YELLOW;
  }
  const contextStr = `${contextColour}(${usedPercentage}%)${contextColour ? RESET : ""}`;

  return `${PURPLE}${modelIcon}${WHITE} ${model} ${costStr} \u2193${inK}k \u2191${outK}k ${contextStr}`;
}

function formatStatusLine(data: StatusLineInput): string {
  const parts = [buildProjectSegment(data)];

  const gitSegment = buildGitSegment(data);
  if (gitSegment) parts.push(gitSegment);

  parts.push(buildModelSegment(data));

  return parts.join(SEP);
}

async function main(): Promise<void> {
  const input = await readInput<StatusLineInput>();
  process.stdout.write(formatStatusLine(input));
}

main().catch(() => {
  // Fail silently - don't break status line
});
