/**
 * Refuses Agent calls that ask for more effort than CLAUDE_CODE_SUBAGENT_EFFORT,
 * so the model re-issues them within the cap. That variable already sets the
 * effort of subagents whose call and definition name none; unset, `inherit` or
 * any other non-level value lifts the cap.
 *
 * Forks are skipped, as they always run at their parent's effort, and so are
 * calls that name no effort, including agents whose definition pins one.
 */
import type { On } from "claude-code";

const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
type EffortLevel = (typeof EFFORT_LEVELS)[number];

function isEffortLevel(value: unknown): value is EffortLevel {
  return EFFORT_LEVELS.includes(value as EffortLevel);
}

function rank(level: EffortLevel): number {
  return EFFORT_LEVELS.indexOf(level);
}

export function registerEffortCap(on: On): void {
  on("tool.call", { tool: "Agent" }, async ($, e, next) => {
    if (e.subagent_type === "fork" || !e.effort) return next(e);

    const cap = (await $.env.get("CLAUDE_CODE_SUBAGENT_EFFORT"))?.trim().toLowerCase();
    if (!isEffortLevel(cap) || rank(e.effort) <= rank(cap)) return next(e);

    return {
      deny: `Subagent effort is capped at ${cap}. Re-issue the call with effort at or below ${cap}, or omit effort.`,
    };
  });
}
