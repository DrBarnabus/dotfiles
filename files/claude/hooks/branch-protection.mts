/**
 * Branch Protection Hook (PreToolUse)
 *
 * Blocks git commands that modify protected branches (main/master).
 * Covers: commit, push (including refspecs), merge, cherry-pick, revert,
 * pull, am, and rebase.
 *
 * To opt out per-project, set CLAUDE_ALLOW_MAIN_COMMIT=1 in the env
 * section of .claude/settings.local.json.
 */
import { execSync } from "node:child_process";

import { block, readInput, type BashPreToolUseInput } from "./lib.mts";

const PROTECTED_BRANCHES = ["main", "master"];

const GIT_PREFIX = String.raw`(?:^|[;&|]\s*)(?:(?:env|command|builtin)\s+)*(?:["']?[\w/.-]*\/)?["']?git["']?[^;&|]*?\s`;

function isGitCommand(command: string, ...subcommands: string[]): boolean {
  return new RegExp(GIT_PREFIX + String.raw`(?:` + subcommands.join("|") + String.raw`)\b`, "m").test(command);
}

const REFSPEC_PATTERNS = PROTECTED_BRANCHES.map(
  (branch) => new RegExp(String.raw`:["']?(?:refs/heads/)?` + branch + String.raw`["']?(?:\s|$|;|&|\|)`),
);

function pushTargetsProtectedBranch(command: string): string | null {
  if (/\s--(?:all|mirror)\b/.test(command)) {
    return "--all/--mirror pushes include protected branches";
  }

  for (let i = 0; i < PROTECTED_BRANCHES.length; i++) {
    if (REFSPEC_PATTERNS[i].test(command)) {
      return `refspec targets protected branch '${PROTECTED_BRANCHES[i]}'`;
    }
  }

  return null;
}

function getCurrentBranch(): string | null {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  if (process.env.CLAUDE_ALLOW_MAIN_COMMIT) return;

  const input = await readInput<BashPreToolUseInput>();
  const command = input.tool_input.command;

  const isCommitLike = isGitCommand(command, "commit", "merge", "cherry-pick", "revert", "pull", "am", "rebase");
  const isPush = isGitCommand(command, "push");
  if (!isCommitLike && !isPush) return;

  const isSwitchLike = isGitCommand(command, "switch", "checkout");
  if (isSwitchLike) {
    block(`cannot combine branch switch with a branch-modifying command. Run them as separate commands.`);
  }

  if (isPush) {
    const refspecIssue = pushTargetsProtectedBranch(command);
    if (refspecIssue) block(`${refspecIssue}. Switch to a feature branch and push normally.`);
  }

  const branch = getCurrentBranch();
  if (!branch) return;

  if (PROTECTED_BRANCHES.includes(branch)) {
    const action = isCommitLike ? "commit" : "push";
    block(`cannot ${action} on protected branch '${branch}'. Switch to a feature branch first.`);
  }
}

main().catch(() => {});
