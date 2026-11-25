import type { On } from "claude-code";
import { expect, test } from "claude-code/testing";
import type { TestBody } from "claude-code/testing";

declare function setTimeout(callback: (value: unknown) => void, ms: number): unknown;

function textOf(node: unknown): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "children" in node) return textOf(node.children);
  return "";
}

const AGENT = {
  id: "a1",
  description: "Review the branch",
  label: "",
  type: "general-purpose",
  kind: "local_agent",
  status: "running",
  taskStatus: "running",
  startTime: Date.now() - 65_000,
  cwd: "/repo",
  model: "claude-opus-5-5",
  effort: "medium",
  contextWindowSize: 200_000,
  tokenCount: 150_000,
  tokenSamples: [],
  hasRow: true,
  rowIds: ["a1"],
  columns: 120,
  isHidden: false,
};

test("an agent row shows the description, model, effort, context and elapsed time", async ($, on) => {
  let row = "";
  on("ui.render", { component: "AgentRow" }, (_, e, next) => {
    row = e.props.body ?? "";
    return next(e);
  });

  const ui = await $.ui.mount({
    plugin: "mods",
    surface: "terminal",
    component: "AgentRow",
    props: AGENT as never,
  });

  for (const part of ["Review the branch", "Opus 5.5", "medium", "150k", "(75%)", "1m05s"]) {
    expect(row).toContain(part);
  }

  await ui.unmount();
});

function stubSession(on: On, cwd = "/home/me/repos/my-repo/src", root = "/home/me/repos/my-repo") {
  on("session.cwd", () => ({ value: cwd }));
  on("session.root", () => ({ value: root }));
  on("session.model", () => ({ value: "claude-opus-5-5" }));
  on("session.usage", () => ({
    value: {
      startedAt: 0,
      context: { tokens: 50_000, window: 200_000, percent: 25 },
      rateLimits: [{ kind: "five_hour", percentUsed: 92 }],
      cost: { usd: 1.5 },
    },
  }));
  on("env.get", () => ({ value: undefined }));
  on("process.run", (_, e) => {
    const stdout = e.argv.includes("rev-parse") ? "feature\n" : e.argv.includes("status") ? " M a\n M b\n" : "1\t2\n";
    return { value: { exitCode: 0, stdout, stderr: "", isStdoutTruncated: false, isStderrTruncated: false } };
  });
  on("tool.call", () => ({ result: "ran" as never, text: "ran" }));
}

async function drawBand($: Parameters<TestBody>[0]): Promise<string> {
  await $.tool.call({ tool: "Bash", command: "true" });

  const ui = await $.ui.mount({
    plugin: "mods",
    surface: "terminal",
    component: "AbovePrompt",
    props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 10, bodyColumns: 160 } as never,
  });

  // The snapshot is built in the background after the Bash call, so the band
  // falls back to the engine's drawing until it lands.
  let drawn = await ui.drawn();
  for (let attempt = 0; drawn.type === "engine" && attempt < 40; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    drawn = await ui.drawn();
  }

  await ui.unmount();
  return textOf(drawn);
}

test("the band above the prompt shows project, git, model, cost, context and rate limits", async ($, on) => {
  stubSession(on);

  const band = await drawBand($);
  for (const part of ["my-repo/src", "feature", "*2", "↑2", "↓1", "Opus 5.5", "$1.50 50k", "(25%)", "92%"]) {
    expect(band).toContain(part);
  }
});

test("Windows paths show the project and subfolder", async ($, on) => {
  stubSession(on, "C:\\Users\\dan\\repo\\src", "C:\\Users\\dan\\repo");

  const band = await drawBand($);
  expect(band).toContain("repo/src");
  expect(band).not.toContain("C:");
});
