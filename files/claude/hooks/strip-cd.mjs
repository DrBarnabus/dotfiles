/**
 * Strip Redundant cd Prefix Hook (PreToolUse)
 *
 * The Bash tool sometimes prepends `cd <path> &&` to commands even when
 * the shell is already in the target directory. This breaks permission
 * allow-list matching because `cd /foo && git diff` won't match `Bash(git diff *)`.
 *
 * This hook strips the cd prefix when the target resolves to the current
 * working directory, restoring correct permission matching without making
 * a permission decision itself.
 */
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { stdin } from "node:process";

const cdPrefixPattern = /^cd\s+("(?:[^"\\]|\\.)*"|'[^']*'|\S+)\s*&&\s*/;

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

async function toRealPath(path) {
  try {
    return await realpath(resolve(path));
  } catch {
    return resolve(path);
  }
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function main() {
  const input = JSON.parse(await readStdin());
  const command = input.tool_input?.command ?? "";

  const match = command.match(cdPrefixPattern);
  if (!match) return;

  const targetDir = await toRealPath(stripQuotes(match[1]));
  const workingDir = await toRealPath(input.cwd ?? process.cwd());

  if (targetDir !== workingDir) return;

  const strippedCommand = command.slice(match[0].length);
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        updatedInput: { ...input.tool_input, command: strippedCommand },
      },
    }),
  );
}

main().catch(() => {});
