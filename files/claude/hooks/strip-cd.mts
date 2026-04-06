/**
 * Strip Redundant Directory Prefix Hook (PreToolUse)
 *
 * The Bash tool sometimes prepends `cd <path> &&` to commands or adds
 * `git -C <path>` flags even when the shell is already in the target
 * directory. This breaks permission allow-list matching because
 * `cd /foo && git diff` won't match `Bash(git diff *)`.
 *
 * This hook strips these prefixes when the target resolves to the current
 * working directory, restoring correct permission matching without making
 * a permission decision itself.
 */
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";

import { readInput, writeOutput, type BashPreToolUseInput } from "./lib.mts";

const quotedPath = String.raw`("(?:[^"\\]|\\.)*"|'[^']*'|\S+)`;
const cdPrefixPattern = new RegExp(String.raw`^cd\s+` + quotedPath + String.raw`\s*&&\s*`);
const gitFlagPattern = new RegExp(String.raw`\s+-C\s+` + quotedPath);

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

async function toRealPath(path: string): Promise<string> {
  try {
    return await realpath(resolve(path));
  } catch {
    return resolve(path);
  }
}

async function main(): Promise<void> {
  const input = await readInput<BashPreToolUseInput>();
  let command = input.tool_input.command;
  const workingDir = await toRealPath(input.cwd ?? process.cwd());
  let changed = false;

  const cdMatch = command.match(cdPrefixPattern);
  if (cdMatch && (await toRealPath(stripQuotes(cdMatch[1]))) === workingDir) {
    command = command.slice(cdMatch[0].length);
    changed = true;
  }

  let gitFlagMatch: RegExpMatchArray | null;
  while ((gitFlagMatch = command.match(gitFlagPattern))) {
    if ((await toRealPath(stripQuotes(gitFlagMatch[1]))) !== workingDir) break;
    command = command.slice(0, gitFlagMatch.index!) + command.slice(gitFlagMatch.index! + gitFlagMatch[0].length);
    changed = true;
  }

  if (!changed) return;

  writeOutput({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      updatedInput: { ...input.tool_input, command },
    },
  });
}

main().catch(() => {});
