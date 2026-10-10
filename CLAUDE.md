# Claude Code Rules

## Workflow: OpenSpec-first

📐 **Everything starts as an OpenSpec change, not in code.** The GitHub Project board is set aside for now: no issues are needed.

Flow: `/opsx:explore` (optional) → `/opsx:propose` → user approves → `/opsx:apply` → PR → merge → `/opsx:archive` (updates `openspec/specs/`).

Non-negotiables:

- The plan lives in `openspec/changes/<name>/` (proposal, specs, design, tasks). No other local PLAN/DESIGN docs.
- A change is required for user-visible or API behaviour. Small bugs and chores can go straight to a PR with the plan in its description.
- No code until the user approves the change.
- Big features: one change per PR-sized slice.
- Branch: `claude/feature-<change-name>` from `origin/main`. The PR names the change.
- Before a PR: `npm run lint` and `npm run build` (backend: ruff, mypy, pytest).
- Delete the branch right after merge. Never force-push `main`.
- UX source of truth: `design/prototype/myfarm-prototype.html` and `design/prototype/myfarm-design-system.html`.

## Usage optimization

- Keep reasoning effort at `medium` unless the architecture is genuinely complex.
- Batch independent tool calls; reuse context already in the conversation.
- Keep commit messages and PR descriptions concise; name the OpenSpec change.
- Check for existing code to reuse before writing new code.

## Interaction & styling

- **Don't drive the Browser** unless asked. Run `npm run build` to catch errors, but don't screenshot or navigate to verify UI unless requested.
- **Prefer Bootstrap CSS** over custom CSS. Use utility classes (`d-flex`, `btn`, `badge`) first; write custom CSS only as a last resort.
- **Angular/TypeScript coding rules:** the `angular-best-practices` skill ([`.claude/skills/angular-best-practices/SKILL.md`](.claude/skills/angular-best-practices/SKILL.md)). Load it whenever writing or reviewing frontend code.
- **Home Daily brief card:** removed from the prototype for now; do not build it until a new design is chosen.

