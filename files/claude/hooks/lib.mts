import { stdin } from "node:process";

import type {
  PreToolUseHookInput,
  PreToolUseHookSpecificOutput,
  SyncHookJSONOutput,
} from "@anthropic-ai/claude-agent-sdk";
import type { AgentInput, BashInput } from "@anthropic-ai/claude-agent-sdk/sdk-tools";

export type { AgentInput, BashInput, PreToolUseHookInput, PreToolUseHookSpecificOutput, SyncHookJSONOutput };

export type BashPreToolUseInput = PreToolUseHookInput & {
  tool_input: BashInput;
};

export interface RateLimitWindow {
  used_percentage: number;
  resets_at: number;
}

export interface StatusLineInput {
  cwd: string;
  session_id: string;
  session_name?: string;
  transcript_path: string;
  version: string;
  model: { id: string; display_name: string };
  workspace: { current_dir: string; project_dir: string; added_dirs: string[] };
  output_style: { name: string };
  cost: {
    total_cost_usd: number;
    total_duration_ms: number;
    total_api_duration_ms: number;
    total_lines_added: number;
    total_lines_removed: number;
  };
  context_window: {
    total_input_tokens: number;
    total_output_tokens: number;
    context_window_size: number;
    used_percentage: number | null;
    remaining_percentage: number | null;
    current_usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
    } | null;
  };
  exceeds_200k_tokens: boolean;
  fast_mode?: boolean;
  prompt_cache?: {
    warm: boolean;
    caching_observed: boolean;
    ttl: "5m" | "1h";
    expires_at: number | null;
    hit_ratio: number | null;
  };
  rate_limits?: {
    five_hour?: RateLimitWindow;
    seven_day?: RateLimitWindow;
  };
  effort?: { level: "low" | "medium" | "high" | "xhigh" | "max" };
  vim?: { mode: "NORMAL" | "INSERT" | "VISUAL" | "VISUAL LINE" };
  agent?: { name: string };
  worktree?: {
    name: string;
    path: string;
    branch?: string;
    original_cwd: string;
    original_branch?: string;
  };
}

export function writeOutput(output: SyncHookJSONOutput): void {
  console.log(JSON.stringify(output));
}

export function block(message: string): never {
  console.error(`Blocked: ${message}`);
  process.exit(2);
}

export async function readInput<T = unknown>(): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(chunk as Buffer);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T;
}
