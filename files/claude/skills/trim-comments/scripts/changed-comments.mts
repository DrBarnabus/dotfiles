/**
 * Lists comment lines added on the current branch, with hints for likely smells.
 *
 * Usage: node changed-comments.mts [BASE]
 *
 * BASE defaults to the merge-base with origin's default branch, falling back to
 * main/master. Uncommitted and untracked changes are included, so the output
 * reflects the working tree as it would be reviewed.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

interface AddedLine {
  path: string;
  line: number;
  text: string;
}

const SKIP_SUFFIXES = [".md", ".mdx", ".json", ".lock", ".snap", ".svg"];
const SKIP_NAMES = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"];

const COMMENT_START = /^\s*(\/\/|\/\*|\*|\*\/|#(?!!)|<!--|--\s|'''|"""|\{\/\*)/;
const TRAILING_COMMENT = /\S.*?\s(\/\/|\/\*|<!--)\s/;

const HINTS: [name: string, pattern: RegExp][] = [
  ["ephemeral-id", /\b(RFC|ADR)\b|\b(D|S|Q|UX|R)-?\d{1,3}\b|\b[A-Z]{2,}-\d+\b|§|\bspike\b|\bphase[ -]?\d/i],
  [
    "session-narrative",
    /\b(now|no longer|previously|used to|instead of|rather than|any ?more|as discussed|this (session|chat|thread|PR|change|fix)|we|our|let's|fixed|fix for|workaround for)\b/i,
  ],
  ["status-label", /\(future\)|\bfor now\b|\btemporar(y|ily)\b|\bnot yet\b|\buntil\b|\b(TODO|FIXME|XXX|HACK)\b/i],
  ["comparison", /\b(legacy|the old|the way \w+ (did|does)|as \w+('s)? (\w+ )?(did|does|would|writes|ordered)|matching the)\b/i],
  ["hedge", /\b(should|might|probably|presumably|I think|seems?)\b/i],
];

function git(...args: string[]): string {
  return spawnSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }).stdout.trim();
}

function defaultBase(): string {
  const originHead = git("symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD");
  const candidates = [originHead, "origin/main", "origin/master", "main", "master"].filter(Boolean);
  for (const candidate of candidates) {
    const base = git("merge-base", "HEAD", candidate);
    if (base) return base;
  }
  console.error("Could not determine a base; pass one explicitly.");
  process.exit(1);
}

function isSkipped(path: string): boolean {
  const name = path.split("/").at(-1) ?? path;
  return SKIP_SUFFIXES.some((suffix) => path.endsWith(suffix)) || SKIP_NAMES.includes(name);
}

function* addedLines(base: string): Generator<AddedLine> {
  // Explicit prefixes, because a user's diff.mnemonicPrefix setting would otherwise change them.
  const diff = git("diff", "-U0", "--no-color", "--no-ext-diff", "--src-prefix=a/", "--dst-prefix=b/", base);
  let path: string | undefined;
  let line = 0;
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("+++ ")) {
      path = raw.startsWith("+++ b/") ? raw.slice(6) : undefined;
    } else if (raw.startsWith("@@")) {
      line = Number(/\+(\d+)/.exec(raw)?.[1] ?? 0);
    } else if (raw.startsWith("+") && path) {
      yield { path, line: line++, text: raw.slice(1) };
    }
  }

  for (const untracked of git("ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean)) {
    let content: string;
    try {
      content = readFileSync(untracked, "utf8");
    } catch {
      continue;
    }
    for (const [index, text] of content.split("\n").entries()) {
      yield { path: untracked, line: index + 1, text };
    }
  }
}

const base = process.argv[2] ?? defaultBase();
const byFile = new Map<string, { line: number; text: string; hints: string[] }[]>();

for (const { path, line, text } of addedLines(base)) {
  if (isSkipped(path)) continue;
  if (!COMMENT_START.test(text) && !TRAILING_COMMENT.test(text)) continue;
  const hints = HINTS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  const entries = byFile.get(path) ?? [];
  entries.push({ line, text: text.trim(), hints });
  byFile.set(path, entries);
}

const total = [...byFile.values()].reduce((sum, entries) => sum + entries.length, 0);
const output = [`base ${base.slice(0, 10)}: ${total} added comment lines across ${byFile.size} files`, ""];
for (const path of [...byFile.keys()].sort()) {
  output.push(path);
  for (const { line, text, hints } of byFile.get(path)!) {
    const tag = hints.length ? `  [${hints.join(", ")}]` : "";
    output.push(`  ${String(line).padStart(5)}: ${text.slice(0, 160)}${tag}`);
  }
  output.push("");
}
process.stdout.write(output.join("\n"));
