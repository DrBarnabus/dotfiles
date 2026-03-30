/**
 * Branch Protection Hook (PreToolUse)
 *
 * Blocks git commit and git push commands when on a protected branch.
 * Triggered by the Bash tool matcher for git commit/push commands.
 *
 * To opt out per-project, set CLAUDE_ALLOW_MAIN_COMMIT=1 in the env
 * section of .claude/settings.local.json.
 */
import { execSync } from "node:child_process";
import { stdin } from "node:process";

const PROTECTED_BRANCHES = ["main", "master"];

async function readStdin() {
  const chunks = [];
  for await (const chunk of stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf-8");
}

async function main() {
  const input = JSON.parse(await readStdin());

  if (input.tool_name !== "Bash") return;

  const command = input.tool_input?.command ?? "";
  const isCommit = /\bgit\s+commit\b/.test(command);
  const isPush = /\bgit\s+push\b/.test(command);

  if (!isCommit && !isPush) return;

  const switchesBranch = /\bgit\s+(?:switch|checkout)\b/.test(command);
  if (switchesBranch) {
    console.error(
      "Blocked: cannot combine branch switch with commit/push in a single command. Run them as separate commands.",
    );
    process.exit(2);
  }

  if (process.env.CLAUDE_ALLOW_MAIN_COMMIT) return;

  let branch;
  try {
    branch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
  } catch {
    return;
  }

  if (PROTECTED_BRANCHES.includes(branch)) {
    const action = isCommit ? "commit" : "push";
    console.error(
      `Blocked: cannot ${action} to a protected branch '${branch}'. Switch to a feature branch first.`,
    );
    process.exit(2);
  }
}

main().catch(() => {});
