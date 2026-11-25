import type { On } from "claude-code";
import { expect, test } from "claude-code/testing";

function outcome(result: { deny?: string; text?: string }): string | undefined {
  return result.deny ?? result.text;
}

function stubEngine(
  on: On,
  env: Record<string, string>,
  branch: string,
  gitDirs: (string | undefined)[] = [],
  cwd = "/repo",
) {
  on("env.get", (_, e) => ({ value: env[e.name] }));
  on("session.cwd", () => ({ value: cwd }));
  on("process.run", (_, e) => {
    gitDirs.push(e.init?.cwd);
    if (e.argv.includes("remote")) {
      return { value: { exitCode: 0, stdout: "origin\n", stderr: "", isStdoutTruncated: false, isStderrTruncated: false } };
    }
    return {
      value: { exitCode: 0, stdout: `${branch}\n`, stderr: "", isStdoutTruncated: false, isStderrTruncated: false },
    };
  });
  on("tool.call", () => ({ result: "ran" as never, text: "ran" }));
}

test("an Agent call above the cap is refused with the cap", async ($, on) => {
  stubEngine(on, { CLAUDE_CODE_SUBAGENT_EFFORT: "medium" }, "feature");

  const refused = await $.tool.call({ tool: "Agent", description: "d", prompt: "p", effort: "max" });
  expect(outcome(refused)).toContain("capped at medium");

  const allowed = await $.tool.call({ tool: "Agent", description: "d", prompt: "p", effort: "low" });
  expect(outcome(allowed)).toBe("ran");

  const fork = await $.tool.call({ tool: "Agent", description: "d", prompt: "p", subagent_type: "fork", effort: "max" });
  expect(outcome(fork)).toBe("ran");
});

test("a commit on main is refused unless opted out", async ($, on) => {
  stubEngine(on, {}, "main");

  const refused = await $.tool.call({ tool: "Bash", command: 'git commit -m "x"' });
  expect(outcome(refused)).toContain("protected branch 'main'");

  const read = await $.tool.call({ tool: "Bash", command: "git status" });
  expect(outcome(read)).toBe("ran");

  const push = await $.tool.call({ tool: "Bash", command: "git push origin HEAD:main" });
  expect(outcome(push)).toContain("refspec targets protected branch 'main'");
});

test("a commit through cd or git -C is checked against that repo", async ($, on) => {
  const dirs: (string | undefined)[] = [];
  stubEngine(on, {}, "main", dirs);

  await $.tool.call({ tool: "Bash", command: 'cd ../other && git commit -m "x"' });
  await $.tool.call({ tool: "Bash", command: 'git -C "/abs/repo" commit -m "x"' });

  expect(dirs).toContain("/other");
  expect(dirs).toContain("/abs/repo");
});

test("a Windows cwd resolves relative cd targets on the same drive", async ($, on) => {
  const dirs: (string | undefined)[] = [];
  stubEngine(on, {}, "main", dirs, "C:\\Users\\dan\\repo-a");

  const refused = await $.tool.call({ tool: "Bash", command: 'cd ../repo-b && git commit -m "x"' });

  expect(dirs).toContain("C:/Users/dan/repo-b");
  expect(outcome(refused)).toContain("protected branch 'main'");
});

test("a -C after the subcommand is not taken as git's directory", async ($, on) => {
  const dirs: (string | undefined)[] = [];
  stubEngine(on, {}, "main", dirs);

  const refused = await $.tool.call({ tool: "Bash", command: "git commit --amend -C HEAD" });

  expect(dirs).toContain("/repo");
  expect(outcome(refused)).toContain("protected branch 'main'");
});

test("only the modifying git invocation's -C decides the repo checked", async ($, on) => {
  const dirs: (string | undefined)[] = [];
  stubEngine(on, {}, "main", dirs);

  await $.tool.call({ tool: "Bash", command: 'git commit -m x && git -C ../other log' });
  await $.tool.call({ tool: "Bash", command: 'git -C /a status && git commit -m x' });

  expect(dirs).not.toContain("/other");
  expect(dirs).not.toContain("/a");
});

test("a quoted -C path with a space is still checked", async ($, on) => {
  const dirs: (string | undefined)[] = [];
  stubEngine(on, {}, "main", dirs);

  const refused = await $.tool.call({ tool: "Bash", command: 'git -C "/abs/my repo" commit -m x' });

  expect(dirs).toContain("/abs/my repo");
  expect(outcome(refused)).toContain("protected branch 'main'");
});

test("a cd to a home-relative path is expanded", async ($, on) => {
  const dirs: (string | undefined)[] = [];
  stubEngine(on, { HOME: "/home/me" }, "main", dirs);

  await $.tool.call({ tool: "Bash", command: "cd ~/other-repo && git commit -m x" });

  expect(dirs).toContain("/home/me/other-repo");
});

test("an unset effort cap allows any effort", async ($, on) => {
  stubEngine(on, {}, "feature");

  const ran = await $.tool.call({ tool: "Agent", description: "d", prompt: "p", effort: "max" });
  expect(outcome(ran)).toBe("ran");
});

test("pulling into main runs", async ($, on) => {
  stubEngine(on, {}, "main");

  for (const command of [
    "git pull --ff-only",
    "git pull --ff-only origin main",
    "git pull --rebase",
    "git -C /repo pull --ff-only",
    "git fetch && git pull --ff-only",
  ]) {
    expect(outcome(await $.tool.call({ tool: "Bash", command }))).toBe("ran");
  }
});

test("main can be fast-forwarded from the remote", async ($, on) => {
  stubEngine(on, {}, "main");

  for (const command of [
    "git merge --ff-only origin/main",
    "git merge --ff-only @{u}",
    "git merge --ff-only",
    "git rebase origin/main",
    "git rebase @{upstream}",
    "git fetch && git merge --ff-only FETCH_HEAD",
  ]) {
    expect(outcome(await $.tool.call({ tool: "Bash", command }))).toBe("ran");
  }
});

test("merging or rebasing a local branch into main is refused", async ($, on) => {
  stubEngine(on, {}, "main");

  for (const command of [
    "git merge --ff-only feature/x",
    "git merge origin/main",
    "git rebase feature/x",
    "git merge --ff-only origin/main && git commit -m x",
  ]) {
    expect(outcome(await $.tool.call({ tool: "Bash", command }))).toContain("protected branch 'main'");
  }
});

test("a commit on a feature branch runs", async ($, on) => {
  stubEngine(on, {}, "feature");

  const ran = await $.tool.call({ tool: "Bash", command: 'git commit -m "x"' });
  expect(outcome(ran)).toBe("ran");
});

test("the opt-out lets a commit on main run", async ($, on) => {
  stubEngine(on, { CLAUDE_ALLOW_MAIN_COMMIT: "1" }, "main");

  const ran = await $.tool.call({ tool: "Bash", command: 'git commit -m "x"' });
  expect(outcome(ran)).toBe("ran");
});
