/**
 * Subagent Effort Cap Hook (PreToolUse)
 *
 * Caps the effort of subagents spawned via the Agent tool, without limiting
 * the main session or a skill's orchestrator agent. Covers both an explicit
 * `effort` on the call and effort inherited from the caller (e.g. the agents
 * a `/code-review max` orchestrator fans out to, which would otherwise run at
 * max).
 *
 * When the call omits `effort`, the agent definition's frontmatter `effort`
 * (project, user or plugin agents) takes precedence over the caller's, so an
 * agent pinned below the cap is never raised to it.
 *
 * Forks are skipped: they always run at their parent's effort and ignore the
 * `effort` parameter.
 *
 * Configure via the env section of settings:
 *   CLAUDE_SUBAGENT_MAX_EFFORT     cap level (default: medium)
 *   CLAUDE_SUBAGENT_EFFORT_EXEMPT  comma-separated subagent types left uncapped;
 *                                  plugin agents match with or without their
 *                                  `plugin:` prefix
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { readInput, writeOutput, type PreToolUseHookInput } from "./lib.mts";

const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
type EffortLevel = (typeof EFFORT_LEVELS)[number];

interface AgentToolInput {
  subagent_type?: string;
  effort?: EffortLevel;
  [key: string]: unknown;
}

type AgentPreToolUseInput = PreToolUseHookInput & {
  tool_input: AgentToolInput;
  effort?: { level: EffortLevel };
};

function isEffortLevel(value: unknown): value is EffortLevel {
  return EFFORT_LEVELS.includes(value as EffortLevel);
}

function rank(level: EffortLevel): number {
  return EFFORT_LEVELS.indexOf(level);
}

function readFrontmatter(file: string): Map<string, string> {
  const fields = new Map<string, string>();
  const block = readFileSync(file, "utf-8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!block) return fields;

  for (const line of block[1].split(/\r?\n/)) {
    const field = line.match(/^(\w+):\s*["']?(.*?)["']?\s*(?:#.*)?$/);
    if (field) fields.set(field[1], field[2]);
  }

  return fields;
}

function findAgentEffort(agentsDir: string, name: string): EffortLevel | undefined {
  if (!existsSync(agentsDir)) return undefined;

  for (const entry of readdirSync(agentsDir, { recursive: true, encoding: "utf-8" })) {
    if (!entry.endsWith(".md")) continue;

    const fields = readFrontmatter(join(agentsDir, entry));
    if (fields.get("name") !== name) continue;

    const effort = fields.get("effort")?.toLowerCase();
    return isEffortLevel(effort) ? effort : undefined;
  }

  return undefined;
}

function projectAgentDirs(cwd: string): string[] {
  const roots = new Set([cwd, process.env.CLAUDE_PROJECT_DIR ?? cwd]);
  return [...roots].map((root) => join(root, ".claude", "agents"));
}

function pluginAgentDirs(plugin: string): string[] {
  const manifest = join(homedir(), ".claude", "plugins", "installed_plugins.json");
  if (!existsSync(manifest)) return [];

  const { plugins } = JSON.parse(readFileSync(manifest, "utf-8")) as {
    plugins: Record<string, { installPath: string }[]>;
  };

  return Object.entries(plugins ?? {})
    .filter(([key]) => key.startsWith(`${plugin}@`))
    .flatMap(([, installs]) => (Array.isArray(installs) ? installs : []))
    .map((install) => join(install.installPath, "agents"));
}

function definitionEffort(subagentType: string, cwd: string): EffortLevel | undefined {
  try {
    return findDefinitionEffort(subagentType, cwd);
  } catch (error) {
    console.error(`subagent-effort-cap: agent definition lookup failed: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

function findDefinitionEffort(subagentType: string, cwd: string): EffortLevel | undefined {
  const [plugin, name] = subagentType.includes(":")
    ? subagentType.split(":", 2)
    : [undefined, subagentType];

  const dirs = plugin
    ? pluginAgentDirs(plugin)
    : [...projectAgentDirs(cwd), join(homedir(), ".claude", "agents")];

  for (const dir of dirs) {
    const effort = findAgentEffort(dir, name);
    if (effort) return effort;
  }

  return undefined;
}

async function main(): Promise<void> {
  const cap = (process.env.CLAUDE_SUBAGENT_MAX_EFFORT ?? "medium").trim().toLowerCase();
  if (!isEffortLevel(cap)) {
    console.error(`subagent-effort-cap: invalid CLAUDE_SUBAGENT_MAX_EFFORT '${cap}', expected one of ${EFFORT_LEVELS.join(", ")}`);
    return;
  }

  const exempt = (process.env.CLAUDE_SUBAGENT_EFFORT_EXEMPT ?? "")
    .split(",")
    .map((type) => type.trim())
    .filter(Boolean);

  const input = await readInput<AgentPreToolUseInput>();
  const subagentType = input.tool_input.subagent_type ?? "general-purpose";
  if (subagentType === "fork") return;

  const unprefixedType = subagentType.split(":").pop() ?? subagentType;
  if (exempt.includes(subagentType) || exempt.includes(unprefixedType)) return;

  const pinned = input.tool_input.effort ? undefined : definitionEffort(subagentType, input.cwd ?? process.cwd());
  const requested = input.tool_input.effort ?? pinned ?? input.effort?.level;
  if (!isEffortLevel(requested) || rank(requested) <= rank(cap)) return;

  const source = input.tool_input.effort ? "requested" : pinned ? "agent definition" : "inherited";

  writeOutput({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      updatedInput: { ...input.tool_input, effort: cap },
      additionalContext: `Subagent effort capped at ${cap} (${source} ${requested}).`,
    },
  });
}

main().catch((error: unknown) => {
  console.error(`subagent-effort-cap: ${error instanceof Error ? error.message : String(error)}`);
});
