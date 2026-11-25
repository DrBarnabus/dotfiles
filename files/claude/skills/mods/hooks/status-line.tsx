/**
 * One-row status bar above the prompt, drawn as Catppuccin Mocha pills:
 * project, cwd and branch on the left; model, effort, cost, context usage and
 * prompt-cache hit ratio on the right, followed by the 5-hour and weekly rate
 * limits once they reach the warning threshold.
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
const WARNING_PERCENT = 70;
const ERROR_PERCENT = 90;

const MOCHA = {
  base: "#1e1e2e",
  surface1: "#45475a",
  overlay1: "#7f849c",
  flamingo: "#f2cdcd",
  mauve: "#cba6f7",
  red: "#f38ba8",
  peach: "#fab387",
  yellow: "#f9e2af",
  green: "#a6e3a1",
  teal: "#94e2d5",
  sky: "#89dceb",
  blue: "#89b4fa",
};

const ICON_EFFORT = "\u{F0FD7}";
const ICON_CACHE = "\u{F0238}";
const RATE_LIMIT_LABELS: Record<string, string> = {
  five_hour: "5h",
  seven_day: "wk",
};

function toForwardSlashes(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

function isWithin(path: string, dir: string): boolean {
  return path === dir || path.startsWith(`${dir}/`);
}

function homeCollapse(path: string, home: string | undefined): string {
  return home && isWithin(path, home) ? `~${path.slice(home.length)}` : path;
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

type Location = Pick<StatusSnapshot, "project" | "subdir" | "jump">;

function relativeLocation(project: string, cwd: string, root: string): Location {
  return { project, subdir: cwd === root ? undefined : cwd.slice(root.length + 1) };
}

/**
 * A worktree shows as its main repository, with the cwd relative to the
 * worktree's own root.
 */
async function readLocation($: EngineInterface, sessionCwd: string, sessionRoot: string, home?: string): Promise<Location> {
  const cwd = toForwardSlashes(sessionCwd);
  const projectDir = toForwardSlashes(sessionRoot);

  const [toplevel, commonDir] = await Promise.all([
    git($, sessionCwd, "rev-parse", "--show-toplevel"),
    git($, sessionCwd, "rev-parse", "--path-format=absolute", "--git-common-dir"),
  ]);

  if (toplevel) {
    const worktreeRoot = toForwardSlashes(toplevel);
    const common = commonDir ? toForwardSlashes(commonDir) : "";
    const repoRoot = common.endsWith("/.git") ? common.slice(0, -"/.git".length) : worktreeRoot;

    if (isWithin(projectDir, worktreeRoot) || isWithin(projectDir, repoRoot)) {
      return relativeLocation(basename(repoRoot), cwd, worktreeRoot);
    }
  } else if (isWithin(cwd, projectDir)) {
    return relativeLocation(basename(projectDir), cwd, projectDir);
  }

  return { project: basename(projectDir), jump: homeCollapse(cwd, home) };
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

  const [location, gitStatus] = await Promise.all([
    readLocation($, sessionCwd, sessionRoot, sessionHome && toForwardSlashes(sessionHome)),
    readGitStatus($, sessionCwd),
  ]);

  return {
    ...location,
    git: gitStatus,
    model: formatModel(model),
    effort: step?.effort,
    costUsd: usage.cost?.usd ?? 0,
    contextPercent: usage.context.percent ?? 0,
    cacheHitRatio: step?.cacheHitRatio,
    rateLimits: usage.rateLimits
      .filter((limit) => RATE_LIMIT_LABELS[limit.kind])
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

function usageBackground(percentage: number, normal: string): string {
  if (percentage >= ERROR_PERCENT) return MOCHA.red;
  if (percentage >= WARNING_PERCENT) return MOCHA.peach;
  return normal;
}

function gitLabel(git: GitStatus): string {
  const ahead = git.ahead > 0 ? ` ↑${git.ahead}` : "";
  const behind = git.behind > 0 ? ` ↓${git.behind}` : "";
  return `${git.branch}${ahead}${behind}`;
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
    const pill = (
      key: string,
      background: string,
      label: string,
      { color = MOCHA.base, wrap = "truncate-end" as "truncate-end" | "truncate-middle" } = {},
    ) => (
      <Text key={key} backgroundColor={background} color={color} wrap={wrap}>
        {` ${label} `}
      </Text>
    );

    const location = status.jump ?? (status.subdir ? `${status.project}/${status.subdir}` : status.project);
    const cachePill =
      status.cacheHitRatio === undefined
        ? null
        : status.cacheHitRatio === 0
          ? pill("cache", MOCHA.surface1, ICON_CACHE, { color: MOCHA.overlay1 })
          : pill("cache", MOCHA.teal, `${ICON_CACHE} ${Math.round(status.cacheHitRatio * 100)}%`);
    const limitPills = status.rateLimits
      .filter((limit) => limit.percent >= WARNING_PERCENT)
      .map((limit) =>
        pill(limit.kind, usageBackground(limit.percent, MOCHA.peach), `${RATE_LIMIT_LABELS[limit.kind]} ${limit.percent}%`),
      );

    const left = [
      pill("location", status.jump ? MOCHA.flamingo : MOCHA.blue, location, { wrap: "truncate-middle" }),
      status.git && pill("git", status.git.changed > 0 ? MOCHA.yellow : MOCHA.green, gitLabel(status.git)),
    ];
    const right = [
      pill("model", MOCHA.mauve, status.effort ? `${status.model} ${status.effort} ${ICON_EFFORT}` : status.model),
      pill("cost", MOCHA.yellow, `$${status.costUsd.toFixed(2)}`),
      pill("context", usageBackground(status.contextPercent, MOCHA.sky), `${status.contextPercent}%`),
      cachePill,
      ...limitPills,
    ];

    return (
      <Box flexDirection="row" justifyContent="space-between" width={e.props.bodyColumns} height={1}>
        <Box flexDirection="row" flexShrink={1} gap={1}>
          {left.filter(Boolean)}
        </Box>
        <Box flexDirection="row" flexShrink={0} marginLeft={2} gap={1}>
          {right.filter(Boolean)}
        </Box>
      </Box>
    );
  });
}
