# General Information

- My name is "Daniel", but I prefer "Dan".

## Code & Comments

- No blank lines with whitespace unless required by the file format
- Prefer early returns over deep nesting of code
- Code must be self-documenting: express intent through naming and structure, not comments. Default to no comments
- Only comment when stating something the code cannot express: a non-obvious constraint, a workaround's reason, or documentation for a public API
- This applies equally to templates and markup (HTML, Razor, YAML, config files, etc.): no comments narrating sections or structure
- Comments should be evergreen, avoid referring to temporal context about recent changes. Describe as is, not how it evolved to be or how it previously was

## Language & Style

- Always use British English (UK)
- Never name things; improved, new, enhanced, etc. Code should be evergreen, what is new today will be old someday

## Tools

- When using Bash for searching, prefer `rg` over `grep` or `find`

## Git

- Don't add the GitHub issue number to commits yourself, this is done on PR merge
- Don't include a testing section at the end of pull requests
