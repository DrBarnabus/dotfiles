/**
 * Blocks git commands that modify protected branches (main/master).
 * Covers: commit, push (including refspecs), merge, cherry-pick, revert,
 * am, and rebase. A fast-forward merge or rebase onto the upstream or a
 * remote-tracking branch is allowed, so the branch can still be updated.
 *
 * To opt out per-project, set CLAUDE_ALLOW_MAIN_COMMIT=1 in the env
 * section of .claude/settings.local.json.
 *
 * The current branch is read from the command's target directory (leading
 * `cd` and `git -C`), not the session's own cwd, so cross-repo commands are
 * checked against the repo they actually touch.
 */
import type { EngineInterface, On } from "claude-code";

const PROTECTED_BRANCHES = ["main", "master"];
const COMMIT_LIKE = ["commit", "merge", "cherry-pick", "revert", "am", "rebase"];
const SWITCH_LIKE = ["switch", "checkout"];

const QUOTED = String.raw`(?:"(?:[^"\\]|\\.)*"|'[^']*'|\S+)`;
const CD_PREFIX = new RegExp(String.raw`^\s*cd\s+(` + QUOTED + String.raw`)\s*&&`);
const GIT_C_FLAG = new RegExp(String.raw`(?:^|\s)-C\s+(` + QUOTED + String.raw`)`, "g");

const GIT_OPT = String.raw`(?:-[cC]\s+` + QUOTED + String.raw`|--?[^\s=]+(?:=\S+)?)`;
const GIT_INVOCATION = new RegExp(
  String.raw`(?:^|[;&|]\s*)(?:(?:env|command|builtin)\s+)*(?:["']?[\w/.-]*\/)?["']?git["']?((?:\s+` +
    GIT_OPT +
    String.raw`)*)\s+([a-z][\w-]*)([^;&|\n]*)`,
  "gm",
);

const UPSTREAM_REF = /^(?:@\{(?:u|upstream)\}|FETCH_HEAD|refs\/remotes\/\S+)$/;

interface GitInvocation {
  options: string;
  subcommand: string;
  args: string;
}

function parseGitInvocations(command: string): GitInvocation[] {
  return [...command.matchAll(GIT_INVOCATION)].map(([, options = "", subcommand = "", args = ""]) => ({
    options,
    subcommand,
    args,
  }));
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function resolvePath(base: string, path: string, home: string | undefined): string {
  let target = path.replace(/\\/g, "/");
  if (home && (target === "~" || target.startsWith("~/"))) target = home.replace(/\\/g, "/") + target.slice(1);
  if (/^([A-Za-z]:)?\//.test(target)) return target;

  const [, drive = "", rest = ""] = base.replace(/\\/g, "/").match(/^([A-Za-z]:)?(.*)$/) ?? [];
  const parts: string[] = [];
  for (const part of `${rest}/${target}`.split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }

  return `${drive}/${parts.join("/")}`;
}

function targetGitDir(command: string, invocation: GitInvocation, base: string, home: string | undefined): string {
  let dir = base;

  const cd = command.match(CD_PREFIX)?.[1];
  if (cd) dir = resolvePath(dir, stripQuotes(cd), home);

  for (const [, path] of invocation.options.matchAll(GIT_C_FLAG)) {
    if (path) dir = resolvePath(dir, stripQuotes(path), home);
  }

  return dir;
}

const REFSPEC_PATTERNS = PROTECTED_BRANCHES.map((branch) => ({
  branch,
  pattern: new RegExp(String.raw`:["']?(?:refs/heads/)?` + branch + String.raw`["']?(?:\s|$|;|&|\|)`),
}));

function pushTargetsProtectedBranch(command: string): string | null {
  if (/\s--(?:all|mirror)\b/.test(command)) {
    return "--all/--mirror pushes include protected branches";
  }

  const target = REFSPEC_PATTERNS.find(({ pattern }) => pattern.test(command));
  return target ? `refspec targets protected branch '${target.branch}'` : null;
}

async function getCurrentBranch($: EngineInterface, cwd: string): Promise<string | null> {
  try {
    const { exitCode, stdout } = await $.process.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], {
      cwd,
      timeoutMs: 5000,
    });
    return exitCode === 0 ? stdout.trim() : null;
  } catch {
    return null;
  }
}

async function gitRemotes($: EngineInterface, cwd: string): Promise<string[]> {
  try {
    const { exitCode, stdout } = await $.process.run(["git", "remote"], { cwd, timeoutMs: 5000 });
    return exitCode === 0 ? stdout.split("\n").filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function isUpdateFromRemote($: EngineInterface, invocation: GitInvocation, cwd: string): Promise<boolean> {
  const isFastForwardMerge = invocation.subcommand === "merge" && /(?:^|\s)--ff-only\b/.test(invocation.args);
  if (!isFastForwardMerge && invocation.subcommand !== "rebase") return false;

  const targets = invocation.args
    .trim()
    .split(/\s+/)
    .filter((arg) => arg && !arg.startsWith("-"))
    .map(stripQuotes);
  if (targets.every((target) => UPSTREAM_REF.test(target))) return true;

  const remotes = await gitRemotes($, cwd);
  return targets.every(
    (target) => UPSTREAM_REF.test(target) || remotes.some((remote) => target.startsWith(`${remote}/`)),
  );
}

async function findViolation($: EngineInterface, command: string): Promise<string | null> {
  const invocations = parseGitInvocations(command);
  const modifying = invocations.filter(
    ({ subcommand }) => COMMIT_LIKE.includes(subcommand) || subcommand === "push",
  );
  if (modifying.length === 0) return null;

  if (invocations.some(({ subcommand }) => SWITCH_LIKE.includes(subcommand))) {
    return "cannot combine branch switch with a branch-modifying command. Run them as separate commands.";
  }

  if (modifying.some(({ subcommand }) => subcommand === "push")) {
    const refspecIssue = pushTargetsProtectedBranch(command);
    if (refspecIssue) return `${refspecIssue}. Switch to a feature branch and push normally.`;
  }

  const [cwd, home] = await Promise.all([$.session.cwd(), $.env.get("HOME")]);
  for (const invocation of modifying) {
    const dir = targetGitDir(command, invocation, cwd, home);
    const branch = await getCurrentBranch($, dir);
    if (!branch || !PROTECTED_BRANCHES.includes(branch)) continue;
    if (await isUpdateFromRemote($, invocation, dir)) continue;

    const action = invocation.subcommand === "push" ? "push" : "commit";
    return `cannot ${action} on protected branch '${branch}'. Switch to a feature branch first.`;
  }

  return null;
}

export function registerBranchProtection(on: On): void {
  on("tool.call", { tool: "Bash" }, async ($, e, next) => {
    if (await $.env.get("CLAUDE_ALLOW_MAIN_COMMIT")) return next(e);

    const violation = await findViolation($, e.command);
    return violation ? { deny: `Blocked: ${violation}` } : next(e);
  });
}
