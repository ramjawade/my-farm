# Claude Code Rules

## Workflow: board-first

📋 **Everything starts on the GitHub Project board, not in code.** Board: https://github.com/users/ramjawade/projects/6

**Full procedure, board ids and `gh` commands: the `board-first` skill** ([`.claude/skills/board-first/SKILL.md`](.claude/skills/board-first/SKILL.md)). Load it whenever you plan work, create or start an issue, raise a PR, or close out an issue.

Non-negotiables:

- Plans live in issue descriptions. No local PLAN/DESIGN docs.
- No code until the user approves the issue.
- Status flow: **Todo → In Progress → Done**. Done is set automatically when the issue closes.
- Big features: a parent issue plus one sub-issue per PR.
- Branch: `claude/feature-<issue>-<slug>` from `origin/main`. PR says `Fixes #<issue>`.
- Before a PR: `npm run lint` and `npm run build` (backend: ruff, mypy, pytest).
- Delete the branch right after merge. Never force-push `main`. Never delete issues.

## Usage optimization

- Keep reasoning effort at `medium` unless the architecture is genuinely complex.
- Batch independent tool calls; reuse context already in the conversation.
- Keep commit messages and PR descriptions concise; reference issue numbers.
- Check for existing code to reuse before writing new code.

## Interaction & styling

- **Don't drive the Browser** unless asked. Run `npm run build` to catch errors, but don't screenshot or navigate to verify UI unless requested.
- **Prefer Bootstrap CSS** over custom CSS. Use utility classes (`d-flex`, `btn`, `badge`) first; write custom CSS only as a last resort.
- **Angular/TypeScript coding rules:** the `angular-best-practices` skill ([`.claude/skills/angular-best-practices/SKILL.md`](.claude/skills/angular-best-practices/SKILL.md)). Load it whenever writing or reviewing frontend code.
