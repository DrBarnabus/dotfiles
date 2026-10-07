/**
 * Subagent Status Line
 *
 * Replaces each agent panel row with the subagent's description (truncated
 * to the usable row width), model, effort, context usage and, while it
 * runs, elapsed time.
 * Colours match the main status line.
 */
import { formatDuration, readInput, type SubagentStatusLineInput, type SubagentStatusLineTask } from "./lib.mts";

const RESET = "\x1b[0m";
const WHITE = "\x1b[37m";
const BLUE = "\x1b[34m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const PURPLE = "\x1b[35m";
const DIM = "\x1b[2m";

const SUBSEP = `${DIM} · ${RESET}`;
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

function visibleLength(text: string): number {
  return [...text.replace(ANSI_PATTERN, "")].length;
}

function formatModel(modelId: string): string {
  const match = modelId.match(/^claude-([a-z]+)-(\d{1,2})(?:-(\d{1,2}))?(?:[-[]|$)/);
  if (!match) return modelId;

  const [, family, major, minor] = match;
  const name = family.charAt(0).toUpperCase() + family.slice(1);
  return minor ? `${name} ${major}.${minor}` : `${name} ${major}`;
}

function formatEffort(effort: string | number): string {
  if (typeof effort === "string") return effort;
  return effort >= 1000 ? `${Math.round(effort / 1000)}k budget` : `${effort} budget`;
}

function formatContext(task: SubagentStatusLineTask): string {
  const tokensK = Math.floor(task.tokenCount / 1000);
  if (!task.contextWindowSize) return `${WHITE}${tokensK}k${RESET}`;

  const usedPercentage = Math.round((task.tokenCount / task.contextWindowSize) * 100);

  let colour = WHITE;
  if (usedPercentage >= 90) {
    colour = RED;
  } else if (usedPercentage >= 70) {
    colour = YELLOW;
  }

  return `${WHITE}${tokensK}k ${colour}(${usedPercentage}%)${RESET}`;
}

function truncate(text: string, width: number): string {
  const chars = [...text];
  if (chars.length <= width) return text;
  if (width <= 1) return "";

  return `${chars.slice(0, width - 1).join("")}…`;
}

function formatRow(task: SubagentStatusLineTask, columns: number): string {
  const parts: string[] = [];
  if (task.model) parts.push(`${PURPLE}${formatModel(task.model)}${RESET}`);
  if (task.effort !== undefined) parts.push(`${WHITE}${formatEffort(task.effort)}${RESET}`);
  parts.push(formatContext(task));
  if (task.status === "running") parts.push(`${WHITE}${formatDuration(Date.now() - task.startTime)}${RESET}`);

  const details = parts.join(SUBSEP);
  const title = (task.label || task.description).replace(/\s+/g, " ").trim();
  const remaining = columns - visibleLength(details) - visibleLength(SUBSEP);
  if (!title || remaining < 8) return details;

  return `${BLUE}${truncate(title, remaining)}${RESET}${SUBSEP}${details}`;
}

async function main(): Promise<void> {
  const input = await readInput<SubagentStatusLineInput>();

  for (const task of input.tasks) {
    process.stdout.write(`${JSON.stringify({ id: task.id, content: formatRow(task, input.columns) })}\n`);
  }
}

main().catch(() => {
  // Fail silently - fall back to the default agent panel rows
});
