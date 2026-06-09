/**
 * Status Line
 *
 * Outputs a formatted status line showing project, git status, model, and token usage.
 * Colours use ANSI codes mapped to Catppuccin Mocha via terminal colour scheme.
 */
import { execSync } from "node:child_process";
import { homedir } from "node:os";
import { basename, isAbsolute, relative } from "node:path";

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
const SUBSEP = `${DIM} \u00b7 ${RESET}`;

const ICON_FOLDER = "\u{1F4C1}";
const ICON_JUMP = "\u{F178}";
const ICON_GIT = "\u{E0A0}";
const ICON_EFFORT = "\u{F0FD7}";
const MODEL_ICONS = ["\u{F06A9}", "\u{F169D}", "\u{F169F}", "\u{F16A1}", "\u{F16A3}", "\u{F1719}", "\u{F16A5}"];

const VIM_COLOURS: Record<string, string> = {
  NORMAL: BLUE,
  INSERT: GREEN,
  VISUAL: PURPLE,
  "VISUAL LINE": PURPLE,
};

function buildVimSegment(data: StatusLineInput): string | null {
  const mode = data.vim?.mode;
  if (!mode) return null;

  const colour = VIM_COLOURS[mode] ?? BLUE;
  return `${colour}${mode}${RESET}`;
}

function homeCollapse(path: string): string {
  const home = homedir();
  return path === home || path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}

function buildProjectSegment(data: StatusLineInput): string {
  const projectDir = data.workspace.project_dir;
  const project = projectDir ? basename(projectDir) : "unknown";

  let segment = `${BLUE}${ICON_FOLDER}${WHITE} ${project}`;
  if (!projectDir || data.cwd === projectDir) return segment;

  const rel = relative(projectDir, data.cwd);
  if (rel && !rel.startsWith("..") && !isAbsolute(rel)) {
    segment += `${WHITE}/${rel}`;
  } else {
    segment += ` ${DIM}${ICON_JUMP}${RESET} ${WHITE}${homeCollapse(data.cwd)}`;
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

    const markers: string[] = [];
    const changed = porcelain.length > 0 ? porcelain.split("\n").length : 0;
    if (changed > 0) markers.push(`${YELLOW}*${changed}${RESET}`);
    markers.push(...buildTrackingMarkers(data.cwd));

    const suffix = markers.length > 0 ? `${SUBSEP}${markers.join(" ")}` : "";
    return `${GREEN}${ICON_GIT}${WHITE} ${branch}${suffix}`;
  } catch {
    return null;
  }
}

function buildTrackingMarkers(cwd: string): string[] {
  try {
    const counts = execSync("git rev-list --left-right --count @{upstream}...HEAD", {
      cwd,
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const [behind, ahead] = counts.split(/\s+/).map(Number);

    const markers: string[] = [];
    if (ahead > 0) markers.push(`${GREEN}↑${ahead}${RESET}`);
    if (behind > 0) markers.push(`${RED}↓${behind}${RESET}`);
    return markers;
  } catch {
    return [];
  }
}

function buildModelSegment(data: StatusLineInput): string {
  const model = data.model.display_name.replace(/\s*\(.*?\)/, "");
  const modelIcon = MODEL_ICONS[Math.floor(Math.random() * MODEL_ICONS.length)];

  const usedPercentage = data.context_window.used_percentage ?? 0;
  const inK = Math.floor(data.context_window.total_input_tokens / 1000);
  const outK = Math.floor(data.context_window.total_output_tokens / 1000);

  const costStr = `$${data.cost.total_cost_usd.toFixed(2)}`;

  const effort = data.effort?.level;
  const effortStr = effort ? ` ${WHITE}${effort} ${ICON_EFFORT}${SUBSEP}${WHITE}` : " ";

  let contextColour = "";
  if (usedPercentage >= 90) {
    contextColour = RED;
  } else if (usedPercentage >= 70) {
    contextColour = YELLOW;
  }
  const contextStr = `${contextColour}(${usedPercentage}%)${contextColour ? RESET : ""}`;

  return `${PURPLE}${modelIcon}${WHITE} ${model}${effortStr}${costStr} \u2193${inK}k \u2191${outK}k ${contextStr}`;
}

function formatStatusLine(data: StatusLineInput): string {
  const firstLine: string[] = [buildProjectSegment(data)];

  const gitSegment = buildGitSegment(data);
  if (gitSegment) firstLine.push(gitSegment);

  const secondLine: string[] = [];

  const vimSegment = buildVimSegment(data);
  if (vimSegment) secondLine.push(vimSegment);

  secondLine.push(buildModelSegment(data));

  return [firstLine.join(SEP), secondLine.join(SEP)].join("\n");
}

async function main(): Promise<void> {
  const input = await readInput<StatusLineInput>();
  process.stdout.write(formatStatusLine(input));
}

main().catch(() => {
  // Fail silently - don't break status line
});
