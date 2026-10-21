---
name: trim-comments
description: Review and tighten the comments and doc comments (JSDoc, TSDoc, XML docs, docstrings) added on the current branch — delete comments the code already says, rewrite public API docs so they read as consumer documentation rather than implementation notes, and strip anything that narrates the authoring session (RFC/ticket ids, "now"/"previously", comparisons with old code, rationale for the change). Edits the working tree directly. Use whenever doing a code review, before raising or un-drafting a PR, after /code-review or /simplify, or when the user asks to tidy, trim, audit or check comments, docs or JSDoc, or mentions self-documenting code or overcommenting.
---

# Trim comments

Comments written during an agentic session tend to record the conversation that produced the code: what was tried, what changed, which decision id justified it, how it differs from the old system. That context is valuable in the session and in the commit message, but in the source it goes stale the moment the branch merges, and every future reader pays to skim it. This skill removes that residue so the code, its names and its types carry the meaning, and the few comments that survive say something the code genuinely cannot.

The standard is self-documenting code first. A comment has to earn its place.

## Scope

Review only comments **added or changed on this branch** — the diff against the merge-base with the default branch, plus uncommitted and untracked files. Pre-existing comments in untouched lines are out of scope even if they share the same smells; churning legacy code makes the diff harder to review. If the user names a different scope (a file, a PR, uncommitted only), use that.

Start by listing the candidates:

```bash
node ~/.claude/skills/trim-comments/scripts/changed-comments.mts [BASE]
```

It prints every added comment line grouped by file, with `[hints]` for patterns that often signal a problem (ephemeral ids, session narrative, status labels, comparisons, hedging). The hints are a triage aid with false positives, not verdicts — judge each comment in context by reading the surrounding code.

Before editing, read the repo's own conventions so you apply them rather than generic taste: `CLAUDE.md`, `.claude/rules/*`, and any contributing or documentation guide. They usually define which doc tags exist (`@internal`, stability tags), which members get doc comments, and how dense comments should be. Where the repo is specific, it wins over this skill.

## The questions to ask of every comment

Work through these in order; the first "yes" decides what happens.

1. **Is it false?** Check the claim against what the code actually does. A wrong comment is worse than none and may point to a real bug — if the code is wrong rather than the comment, don't silently rewrite the comment to match; report it.
2. **Does the code already say it?** The comment paraphrases the next line, the identifier, a guard, a type the compiler enforces, or a test's name. → Delete. If the code doesn't quite say it, prefer improving the code (a better name, an extracted well-named helper, a named constant) over keeping the comment.
3. **Is it about the session or the change, rather than the code as it stands?** → Delete, or rewrite to describe present behaviour. The reason for a change belongs in the commit message or PR description, which are point-in-time records; mention any rationale you remove in your summary so it can go there. Signals:
   - Time words relative to the edit: *now*, *no longer*, *previously*, *used to*, *instead of*, *rather than*, *moved*, *fixed*, *changed to*.
   - First person and dialogue: *we*, *our*, *as discussed*, *the thread*, *this chat*, *per the review*.
   - Ephemeral references: RFC/ADR/decision ids (`D10`, `UX-61`, `§6.4`), ticket keys (`ABC-123`), spike, phase or milestone names, planning documents that won't persist. The comment must stand alone for a reader who has none of those.
   - Comparisons with any other system, past, present or planned: *as DynamoDB's Put would*, *the way OpenSearch ordered it*, *matching the old store*, *legacy*. This holds even while the other system is still live (a migration, a dual-write, a port): the comment outlives that period, and a reader shouldn't need to know a second system to understand this one. Describe the behaviour on its own terms.
   - Anything that used to be or will be: status labels (*(future)*, *for now*, *temporary*, *not yet*, *until X lands*) and "while X is still Y" framing. `TODO` comments are the one exception — leave them as they are.
   - Defences of a rejected alternative: *"refusing instead would…"*, *"we considered…"*.
4. **Does a test, spec or the commit already pin this behaviour?** → Delete. Duplicated explanation drifts.
5. **Is it a genuinely hidden constraint** — a browser or platform quirk, framework timing, a third-party library's surprising behaviour, a justified lint suppression or cast — that someone would otherwise "fix" and break? → Keep, cut to the one causal clause, usually a single line.

Grouping comments that a file's conventions use (e.g. `// Components` sections in a barrel file) and licence headers are fine; leave them.

## Public API documentation

Doc comments on exported, consumer-facing API are documentation, not comments, and the bar is different: they should exist and be good. They are read in IDE hovers, generated API docs and props tables by people who will never open the source. Write them for that reader.

- **Usage, not mechanism.** Say what the consumer sets, what they observe, and what they get back. Cut how it is implemented — internal services, signals, effects, overlays, caching, which private method runs. If a sentence only makes sense to someone reading the implementation, it doesn't belong.
- **Shape.** Open with one sentence saying what it is. Follow with short paragraphs only where usage needs explaining (layout, keyboard behaviour, constraints the consumer must respect). Add an `@example` for anything non-trivial when the repo uses them. Inputs and options get one line from the consumer's point of view ("The rows to show.").
- **Present tense, declarative, impersonal.** No *we*, no *you should probably*, no hedging, no history ("Since v2…" belongs in a changelog).
- **Visibility.** Members that are public only because a framework or interface requires it, and that consumers never set, get a short description and the repo's internal marker (e.g. `@internal`) so they stay out of generated docs. Members that are private, protected or template-only don't get doc comments unless the repo says otherwise — follow the repo's rule.
- **Tags.** Keep the stability tags and tag order the repo uses. Don't invent new tags.

Doc comments on non-exported helpers follow the plain-comment rules above: usually the name and signature are enough.

## Tone and length

- Match the comment density of recently written sibling files in the repo, not older code that predates the conventions.
- One line is the norm for an inline comment; multi-sentence explanations should be rare and earn every sentence. When condensing, keep the causal clause and drop the asides.
- No em-dash chains, no "Note:" prefixes, no condescending "in plain English" framing.
- Use the language variant the user's instructions specify (e.g. British English: *behaviour*, *colour*, *initialise*).

See `references/examples.md` for before/after pairs drawn from real reviews — read it the first time you use this skill in a session, since it calibrates how aggressive to be.

## Applying the changes

Edit the files directly. Keep edits to comments and doc comments, except where renaming a local or extracting a small helper is what makes a comment unnecessary — keep those code changes minimal and behaviour-preserving, and don't rename public API. Don't reformat unrelated code.

After editing, run the repo's formatter and linter on the touched files if they're quick, since removing a comment can leave blank-line or JSDoc-format issues.

## Report

Finish with a short summary:

- Counts: comment lines before → after across the branch.
- A table of what changed: `file:line | action (deleted / rewritten / condensed / tagged internal) | why` — one row per comment or per cluster of identical fixes.
- **Rationale to carry into the commit/PR**: any reasons removed from comments that are worth recording in the commit message or PR description.
- **Possible bugs**: any comment that contradicted the code where the code looks wrong — not fixed, flagged for the user.
- Comments deliberately kept that a reviewer might question, with the one-line reason.
