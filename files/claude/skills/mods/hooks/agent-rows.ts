/**
 * Replaces each agent panel row with the subagent's description (truncated
 * to the usable row width), model, effort, context usage and, while it
 * runs, elapsed time.
 */
import type { AgentInfo, EngineInterface, On } from "claude-code";

import { formatModel } from "./format";

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

function truncate(text: string, width: number): string {
  const chars = [...text];
  if (chars.length <= width) return text;
  if (width <= 1) return "";

  return `${chars.slice(0, width - 1).join("")}…`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

function usageColour(percentage: number): string {
  if (percentage >= 90) return RED;
  if (percentage >= 70) return YELLOW;
  return WHITE;
}

function formatEffort(effort: string | number): string {
  if (typeof effort === "string") return effort;
  return effort >= 1000 ? `${Math.round(effort / 1000)}k budget` : `${effort} budget`;
}

function formatContext(agent: AgentInfo): string {
  const tokensK = Math.floor(agent.tokenCount / 1000);
  if (!agent.contextWindowSize) return `${WHITE}${tokensK}k${RESET}`;

  const usedPercentage = Math.round((agent.tokenCount / agent.contextWindowSize) * 100);
  return `${WHITE}${tokensK}k ${usageColour(usedPercentage)}(${usedPercentage}%)${RESET}`;
}

function formatRow(agent: AgentInfo, columns: number): string {
  const parts: string[] = [];
  if (agent.model) parts.push(`${PURPLE}${formatModel(agent.model)}${RESET}`);
  if (agent.effort !== undefined) parts.push(`${WHITE}${formatEffort(agent.effort)}${RESET}`);
  parts.push(formatContext(agent));
  if (agent.taskStatus === "running") parts.push(`${WHITE}${formatDuration(Date.now() - agent.startTime)}${RESET}`);

  const details = parts.join(SUBSEP);
  const title = (agent.label || agent.description).replace(/\s+/g, " ").trim();
  const remaining = columns - visibleLength(details) - visibleLength(SUBSEP);
  if (!title || remaining < 8) return details;

  return `${BLUE}${truncate(title, remaining)}${RESET}${SUBSEP}${details}`;
}

const NESTED_CONNECTOR_COLUMNS = 2;

async function nestingDepth($: EngineInterface, agent: AgentInfo): Promise<number> {
  if (!agent.parentId) return 0;

  const agents = await $.agent.list();
  let depth = 0;
  for (let parentId: string | undefined = agent.parentId; parentId && depth < agents.length; depth++) {
    parentId = agents.find((candidate) => candidate.id === parentId)?.parentId;
  }

  return depth;
}

export function registerAgentRows(on: On): void {
  on("ui.render", { component: "AgentRow" }, async ($, e, next) => {
    const columns = (e.props.columns ?? Infinity) - NESTED_CONNECTOR_COLUMNS * (await nestingDepth($, e.props));
    return next({ ...e, props: { ...e.props, body: formatRow(e.props, columns) } });
  });
}
