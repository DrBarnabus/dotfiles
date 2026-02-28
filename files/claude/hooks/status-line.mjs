/**
 * Status Line
 *
 * Outputs a formatted status line showing model, project, and token usage.
 */
import { stdin } from "node:process";

async function readStdin() {
  const chunks = [];
  for await (const chunk of stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf-8");
}

function formatStatusLine(data) {
  const model = data.model?.display_name ?? "unknown";
  const projectDir = data.workspace?.project_dir ?? "";
  const project = projectDir.split("/").pop() || "unknown";

  const contextWindow = data.context_window ?? {};
  const totalIn = contextWindow.total_input_tokens ?? 0;
  const totalOut = contextWindow.total_output_tokens ?? 0;
  const usedPercentage = contextWindow.used_percentage ?? 0;

  const inK = Math.floor(totalIn / 1000);
  const outK = Math.floor(totalOut / 1000);

  // Dim text: \x1b[2m, Reset: \x1b[0m
  // ↓ = input tokens, ↑ = output tokens
  return `\x1b[2m󰚩 ${model} │ 󰉋 ${project} │ ↓${inK}k ↑${outK}k (${usedPercentage}%)\x1b[0m`;
}

async function main() {
  const input = await readStdin();
  const data = JSON.parse(input);

  process.stdout.write(formatStatusLine(data));
}

main().catch(() => {
  // Fail silently - don't break status line
});
