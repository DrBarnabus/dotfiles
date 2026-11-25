/**
 * One-row status bar above the prompt: project, cwd and git status on the
 * left; model, effort, cost, context usage, prompt-cache hit ratio and rate
 * limits on the right.
 *
 * The snapshot is rebuilt after each main-loop step, after each main-loop
 * Bash call (git state may have moved) and every 15 seconds.
 */
import { atom, read, update } from "claude-code";
import type { EngineInterface, On } from "claude-code";

import type { GitStatus, MainStep, StatusSnapshot } from "../types";
import { formatModel } from "./format";

const snapshot = atom({ plugin: "mods", key: "snapshot" } as const, null);
const mainStep = atom({ plugin: "mods", key: "mainStep" } as const, null);

const REFRESH_INTERVAL_MS = 15_000;

const ICON_FOLDER = "\u{1F4C1}";
const ICON_JUMP = "\u{F178}";
const ICON_GIT = "\u{E0A0}";
const ICON_EFFORT = "\u{F0FD7}";
const ICON_CACHE = "\u{F0238}";
const RATE_LIMIT_ICONS: Record<string, string> = {
  five_hour: "\u{F1443}",
  seven_day: "\u{F0A33}",
};
const MODEL_ICONS = ["\u{F06A9}", "\u{F169D}", "\u{F169F}", "\u{F16A1}", "\u{F16A3}", "\u{F1719}", "\u{F16A5}"];

function toForwardSlashes(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

function homeCollapse(path: string, home: string | undefined): string {
  if (!home) return path;
  return path === home || path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}

async function git($: EngineInterface, cwd: string, ...args: string[]): Promise<string | null> {
  try {
    const { exitCode, stdout } = await $.process.run(["git", "--no-optional-locks", ...args], {
      cwd,
      timeoutMs: 3000,
    });
    return exitCode === 0 ? stdout.trim() : null;
  } catch {
    return null;
  }
}

async function readGitStatus($: EngineInterface, cwd: string): Promise<GitStatus | null> {
  const [branch, porcelain, counts] = await Promise.all([
    git($, cwd, "rev-parse", "--abbrev-ref", "HEAD"),
    git($, cwd, "status", "--porcelain"),
    git($, cwd, "rev-list", "--left-right", "--count", "@{upstream}...HEAD"),
  ]);
  if (branch === null) return null;

  const [behind = 0, ahead = 0] = counts ? counts.split(/\s+/).map(Number) : [];
  return { branch, changed: porcelain ? porcelain.split("\n").length : 0, ahead, behind };
}

async function buildSnapshot($: EngineInterface): Promise<StatusSnapshot> {
  const [sessionCwd, sessionRoot, sessionHome, model, usage, step] = await Promise.all([
    $.session.cwd(),
    $.session.root(),
    $.env.get("HOME"),
    $.session.model(),
    $.session.usage(),
    read($, mainStep),
  ]);

  const cwd = toForwardSlashes(sessionCwd);
  const projectDir = toForwardSlashes(sessionRoot);
  const home = sessionHome && toForwardSlashes(sessionHome);

  let subdir: string | undefined;
  let jump: string | undefined;
  if (cwd.startsWith(`${projectDir}/`)) subdir = cwd.slice(projectDir.length + 1);
  else if (cwd !== projectDir) jump = homeCollapse(cwd, home);

  return {
    project: basename(projectDir),
    subdir,
    jump,
    git: await readGitStatus($, sessionCwd),
    model: formatModel(model),
    effort: step?.effort,
    costUsd: usage.cost?.usd ?? 0,
    contextTokens: usage.context.tokens ?? 0,
    contextPercent: usage.context.percent ?? 0,
    cacheHitRatio: step?.cacheHitRatio,
    rateLimits: usage.rateLimits
      .filter((limit) => RATE_LIMIT_ICONS[limit.kind])
      .map((limit) => ({ kind: limit.kind, percent: Math.round(limit.percentUsed) })),
  };
}

let inFlight: Promise<void> | null = null;
let isQueued = false;

function refresh($: EngineInterface): Promise<void> {
  if (inFlight) {
    isQueued = true;
    return inFlight;
  }

  inFlight = (async () => {
    do {
      isQueued = false;
      try {
        const next = await buildSnapshot($);
        await update($, snapshot, () => next);
      } catch {
        // A failed refresh keeps the last snapshot
      }
    } while (isQueued);
    inFlight = null;
  })();

  return inFlight;
}

function usageColour(percentage: number): string {
  if (percentage >= 90) return "red";
  if (percentage >= 70) return "yellow";
  return "white";
}

export function registerStatusLine(on: On): void {
  on("session.start", async ($, e, next) => {
    const result = await next(e);
    $.clock.every(REFRESH_INTERVAL_MS, () => refresh($));
    void refresh($);
    return result;
  });

  on("turn.step", async function* ($, e, next) {
    const result = yield* next(e);
    if (e.agentId) return result;

    const usage = result.usage;
    const cacheable = usage
      ? usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens
      : 0;
    const step: MainStep = {
      effort: typeof e.effort === "string" ? e.effort : undefined,
      cacheHitRatio: usage && cacheable > 0 ? usage.cache_read_input_tokens / cacheable : undefined,
    };

    await update($, mainStep, () => step);
    void refresh($);
    return result;
  });

  on("tool.call", { tool: "Bash" }, async ($, e, next) => {
    const result = await next(e);
    if (!e.agentId) void refresh($);
    return result;
  });

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    if (e.surface !== "terminal" || e.props.hasSurvey) return next(e);

    const status = await read($, snapshot);
    if (!status) return next(e);

    const { Box, Text } = $.ui.resolve(e);
    const sep = <Text dimColor> │ </Text>;
    const subsep = <Text dimColor> · </Text>;

    return (
      <Box flexDirection="row" justifyContent="space-between" width={e.props.bodyColumns} height={1}>
        <Box flexDirection="row" flexShrink={1}>
          <Text wrap="truncate-end">
            <Text color="blue">{ICON_FOLDER}</Text>
            <Text color="white"> {status.project}</Text>
            {status.subdir && <Text color="white">/{status.subdir}</Text>}
            {status.jump && (
              <Text>
                <Text dimColor> {ICON_JUMP}</Text>
                <Text color="white"> {status.jump}</Text>
              </Text>
            )}
            {status.git && (
              <Text>
                {sep}
                <Text color="green">{ICON_GIT}</Text>
                <Text color="white"> {status.git.branch}</Text>
                {(status.git.changed > 0 || status.git.ahead > 0 || status.git.behind > 0) && subsep}
                {status.git.changed > 0 && <Text color="yellow">*{status.git.changed} </Text>}
                {status.git.ahead > 0 && <Text color="green">↑{status.git.ahead} </Text>}
                {status.git.behind > 0 && <Text color="red">↓{status.git.behind}</Text>}
              </Text>
            )}
          </Text>
        </Box>
        <Box flexDirection="row" flexShrink={0} marginLeft={2}>
          <Text>
            <Text color="magenta">{MODEL_ICONS[Math.floor(Math.random() * MODEL_ICONS.length)]}</Text>
            <Text color="white"> {status.model}</Text>
            {status.effort && (
              <Text color="white">
                {" "}
                {status.effort} {ICON_EFFORT}
              </Text>
            )}
            {subsep}
            <Text color="white">
              ${status.costUsd.toFixed(2)} {Math.floor(status.contextTokens / 1000)}k{" "}
            </Text>
            <Text color={usageColour(status.contextPercent)}>({status.contextPercent}%)</Text>
            {status.cacheHitRatio !== undefined && (
              <Text>
                {subsep}
                {status.cacheHitRatio === 0 ? (
                  <Text dimColor>{ICON_CACHE}</Text>
                ) : (
                  <Text color="green">
                    {ICON_CACHE} {Math.round(status.cacheHitRatio * 100)}%
                  </Text>
                )}
              </Text>
            )}
            {status.rateLimits.length > 0 && sep}
            {status.rateLimits.map((limit, index) => (
              <Text key={limit.kind}>
                {index > 0 && subsep}
                <Text color="white">{RATE_LIMIT_ICONS[limit.kind]} </Text>
                <Text color={usageColour(limit.percent)}>{limit.percent}%</Text>
              </Text>
            ))}
          </Text>
        </Box>
      </Box>
    );
  });
}
