# Claude Code Rules

## Workflow: OpenSpec-first

📐 **Everything starts as an OpenSpec change, not in code.** The GitHub Project board is set aside for now: no issues are needed.

Flow, **one change = one branch = one PR**:

1. `/opsx:explore` (optional, chat only, no files).
2. `/opsx:propose` on a new branch from `origin/main`; commit the plan and open a **draft PR**.
3. User reviews the plan and approves (in the PR or in chat). No code before this.
4. `/opsx:apply` on the same branch; tick tasks as you go; CI runs on each push.
5. `/opsx:archive` **on the same branch once CI is green** (moves the change to `archive/`, syncs `openspec/specs/`, ticks the roadmap).
6. Mark the PR ready; the user merges once. Then delete the local branch and pull `main`.

Non-negotiables:

- The plan lives in `openspec/changes/<name>/` (proposal, specs, design, tasks). No other local PLAN/DESIGN docs.
- A change is required for user-visible or API behaviour. Small bugs and chores can go straight to a PR with the plan in its description.
- No code until the user approves the change.
- Big features: one change per PR-sized slice. A change that depends on an unmerged one starts after it merges.
- Branch: `claude/feature-<change-name>` from `origin/main`, ideally in its own worktree so two changes never share a working tree. The PR names the change and holds its plan, code and archive; there are no separate planning or archive PRs.
- Stage explicit paths on every commit (never `git add -A`), so a PR holds only its own files.
- Tick the roadmap and update the main specs in the same PR as the change.
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

