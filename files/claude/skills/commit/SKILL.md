---
name: commit
description: Create git commits — Conventional Commits prefix, short British-English subject, atomic one-change-per-commit splits, and lint/test run before committing. Use whenever asked to commit, to stage and commit, to save or check in work, or to split changes into commits.
---

# Commit

Turn the current working changes into one or more clean, atomic commits.

## Procedure

1. **Survey** the working tree before doing anything: `git status` and `git diff` (both staged and unstaged). Never assume what changed.
2. **Group** changes into atomic commits — one logical change each. If the tree mixes unrelated concerns, propose a commit plan (which files → which message) and confirm it before staging anything.
3. **Verify** before each commit: run the tests, build, or lint relevant to the changed area. If anything fails, stop and report — do not commit broken work.
4. **Stage** only the files belonging to the current logical commit with explicit paths (`git add <paths>`). Never `git add -A` blindly when the tree holds more than one concern.
5. **Commit** with a message that follows the rules below.
6. **Report** the resulting commit(s). Offer to push; never push without being asked.

## Message rules

- Conventional Commits: `type(scope): subject`. Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`. Scope optional.
- Subject: short and concise, British English. Imperative reads best but is not enforced; do not force lowercase or a trailing full stop.
- Add a body only when the change needs explaining — say _why_, not _what_. Omit it for self-evident changes.
- Never add a GitHub issue number; it is applied on PR merge.

## Constraints

- Never amend or rewrite a commit that has already been pushed.
- To correct a local, unpushed commit, prefer `git commit --fixup <sha>`.
- If there is nothing to commit, say so and stop.
