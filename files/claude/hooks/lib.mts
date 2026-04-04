import { stdin } from "node:process";

import type {
  PreToolUseHookInput,
  PreToolUseHookSpecificOutput,
  SyncHookJSONOutput,
} from "@anthropic-ai/claude-agent-sdk";

export type { PreToolUseHookInput, PreToolUseHookSpecificOutput, SyncHookJSONOutput };

export interface BashToolInput {
  command: string;
  description?: string;
  timeout?: number;
  run_in_background?: boolean;
  dangerouslyDisableSandbox?: boolean;
}

export type BashPreToolUseInput = PreToolUseHookInput & {
  tool_input: BashToolInput;
};

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
  rate_limits?: {
    five_hour?: { used_percentage: number; resets_at: number };
    seven_day?: { used_percentage: number; resets_at: number };
  };
  vim?: { mode: "NORMAL" | "INSERT" };
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

export async function readInput<T = unknown>(): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(chunk as Buffer);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T;
}
