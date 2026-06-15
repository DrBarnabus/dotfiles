# General

My name is "Daniel".

- Always use British English (UK) in prose (comments, docs, commit messages, PRs). In code identifiers, follow the ecosystem's spelling (e.g. `color`, `initialize`) to avoid clashing with APIs

## Code

- Never use temporal qualifiers in names (new, improved, enhanced, v2, legacy, old, deprecated). Code is evergreen; what is new today will be old someday
- Prefer early returns over deep nesting; after a returning nested block (e.g. a guard clause) leave a blank line separating it from what follows, where the file's formatting rules allow

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

## Git

- Don't include a testing section at the end of pull requests
- Prefer rebase over merge when updating branches
- Only rewrite history on branches not yet relied on by others; never rewrite published/shared history
- When force-pushing after a rebase, use `--force-with-lease`, never plain `--force`

# Workflow

## Subagent Routing Rules

- Delegate to protect token budget: route read-heavy or bulk processing to a subagent and keep only its summary in the main thread
- Take care not to over-delegate — multi-agent fan-out can cost several times the tokens. Reserve it for where it's genuinely needed to prevent bloat of the main context

**Parallel Dispatch** (ALL conditions must be met):

- 2+ unrelated tasks or independent domains
- No shared state between tasks
- Clear file boundaries with no overlap

**Sequential Dispatch** (ANY condition triggers):

- Tasks have dependencies (B needs output from A)
- Shared files or state (merge conflict risk)
- Unclear scope (need to understand before proceeding)

**Background Dispatch** (ANY condition triggers)

- Research, Exploration or Analysis tasks (not file modifications)
- Results aren't blocking your current work
