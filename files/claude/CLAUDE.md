# General Information

My name is "Daniel".

- Always use British English (UK) in prose (comments, docs, commit messages, PRs). In code identifiers, follow the ecosystem's spelling (e.g. `color`, `initialize`) to avoid clashing with APIs

## Code

- Never use temporal qualifiers in names (new, improved, enhanced, v2, legacy, old, deprecated). Code is evergreen; what is new today will be old someday
- No blank lines with whitespace unless required by the file format
- Prefer early returns over deep nesting of code
- Prefer a blank line after a nested block that returns (e.g. a guard clause), separating it from the code that follows — only where the file's formatting rules allow

## Comments

- Code must be self-documenting: express intent through naming and structure, not comments. Default to no comments
- Only comment when stating something the code cannot express: a non-obvious constraint, a workaround's reason, or documentation for a public API
- This applies equally to templates and markup (HTML, Razor, YAML, config files, etc.): no comments narrating sections or structure
- Comments should be evergreen, avoid referring to temporal context about recent changes. Describe as is, not how it evolved to be or how it previously was

## Working Style

- For informational or how-to questions, answer only — explain or give steps, make no file changes until I explicitly ask
- Ask questions one at a time (or up to four together via the AskUserQuestion tool), and resolve any follow-ups or confirmations before moving on to further questions
- Do only what I asked; flag adjacent issues (bugs, refactors) for me to decide rather than fixing them unprompted
- Ask before adding a new third-party dependency; prefer the standard library or existing dependencies
- Prefer editing existing files over creating new ones; never create documentation files unless asked
- Don't claim a task is done without running the relevant tests, build, or lint and reporting the result

## Subagents

- Delegate to protect the main context's token budget: route read-heavy or high-volume work (codebase search, log/test output, bulk file processing) to a subagent and keep only its summary in the main thread
- Don't over-delegate — a multi-agent fan-out costs several times the tokens of a single thread; reserve it for work that is genuinely parallel or would otherwise bloat the main context
- Run independent paths in parallel, not serially; don't spawn agents for work with dependencies between the parts
- Match the model to the job for cost: cheapest capable model for simple reads and bulk work, the most capable only for genuinely hard reasoning

## Tools

- When using Bash for searching, prefer `rg` over `grep` or `find`

## Git

- Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, etc.); keep the subject short and concise
- Keep commits atomic: one logical change per commit, self-contained and reviewable
- Run the relevant tests, build, or lint before committing
- Don't add the GitHub issue number to commits yourself, this is done on PR merge
- Don't include a testing section at the end of pull requests
- Prefer rebase over merge when updating branches; use `git commit --fixup` + `rebase --autosquash` where the branch allows
- Only rewrite history on branches not yet relied on by others; never rewrite published/shared history
- When force-pushing after a rebase, use `--force-with-lease`, never plain `--force`
