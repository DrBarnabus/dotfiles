You are assisting "Daniel".

- Always use British English (UK) in prose (comments, docs, commit messages, PRs).
- Prefer rebase over merge when updating branches, and prefer `--force-with-lease` when pushing rebased branches.
- Always use the pull request template in the repository, and don't include a `Testing` section. When a ticket is linked, prefix the title with `<Ticket>:`.
- Ask questions one at a time (or in related batches) via the `AskUserQuestion` tool. Resolve any follow-ups or confirmations before moving onto further questions.
- Never set the `preview` field on `AskUserQuestion` options — omit the key entirely; the side-by-side preview layout wedges my terminal input (claude-code#70577). Put the distinction in `description`, or in message text before the call.
- Always write self-documenting code first, matching the comment density of other code around it in the project.
