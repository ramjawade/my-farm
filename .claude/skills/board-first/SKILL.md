---
name: board-first
description: Board-first GitHub workflow for this repo. Use when planning work, creating or updating issues, starting an issue ("start 67"), raising a PR, or finishing/verifying an issue or parent epic. Holds the real board ids and gh commands for moving status.
---

# Board-first workflow

The GitHub Project board is the only plan. No local PLAN/DESIGN docs.

## Board facts

| | |
|---|---|
| Repo | `ramjawade/my-farm` (push to remote `origin`) |
| Board | project **6** "farm", owner `ramjawade` — https://github.com/users/ramjawade/projects/6 |
| Project id | `PVT_kwHOAse-7M4Bi2uX` |
| Status field id | `PVTSSF_lAHOAse-7M4Bi2uXzhhtO_w` |
| Status options | **Todo** `f75ad846` · **In Progress** `47fc9ee4` · **Done** `98236657` |
| Labels | `bug` `enhancement` `documentation` (no backend/frontend labels) |

Status meaning: **Todo** = planned, awaiting approval or not started. **In Progress** = branch exists, including while its PR is in review (there is no "In Review" column). **Done** = set automatically when the issue closes (a merged PR with `Fixes #N`, or a manual close).

## Commands

```bash
# Create an issue on the board (lands in Todo)
gh issue create --title "…" --label bug --project "farm" --body-file body.md

# Board item id for issue N
gh project item-list 6 --owner ramjawade --limit 200 --format json \
  --jq '.items[] | select(.content.number==N) | .id'

# Move status (use an option id from the table)
gh project item-edit --project-id PVT_kwHOAse-7M4Bi2uX \
  --field-id PVTSSF_lAHOAse-7M4Bi2uXzhhtO_w --id <ITEM_ID> \
  --single-select-option-id 47fc9ee4

# Link child issue C under parent P
gh api repos/ramjawade/my-farm/issues/P/sub_issues -F sub_issue_id=$(gh api repos/ramjawade/my-farm/issues/C --jq .id)
```

## Flow (single issue)

1. **Plan** — write the issue body with the template below; big work = parent issue + one sub-issue per PR (see parent-epic flow below). Stop and wait for the user to approve. No code before approval.
2. **Start** ("start N") — read issue N (it is the plan), then:
   `git fetch origin && git checkout -b claude/feature-N-<slug> origin/main`, and move the item to **In Progress**.
3. **Build** — follow the plan exactly. If it must change, comment on the issue and ask; don't patch silently.
4. **Gates** — `npm run lint` and `npm run build` for frontend changes. Backend: `ruff`, `mypy`, `pytest` (Python may not be on PATH locally — then say so; CI runs them). Never claim a gate passed that didn't run. **If the issue touches a backend router or Pydantic schema**: run `python scripts/export_openapi.py` (from `projects/backend/`) then `npm run generate:contracts` (from the repo root) and commit the result as part of this PR — same tier as running lint/build (issue #196; CI fails the build if either drifts).
5. **PR** — commit messages end with `(Fixes #N)` on the final commit; push `-u origin`; `gh pr create` with the PR template, targeting `main`. Leave the item in In Progress.
6. **Watch CI** — after the PR exists, read status with the `ccd_pr` tools (`get_status`) instead of polling `gh pr checks` by hand. If a check fails: pull the actual failure (`gh run view <run> --job <job> --log-failed`), diagnose the real cause (don't just retry), fix it, rerun the affected local gates, and push a **new commit** (never amend/force-push) to the same branch. Repeat until every check is green. Frontend and backend gates can fail independently — a green frontend run doesn't mean the backend job passed too; check both.
7. **After merge** (user says merged) — `git checkout main && git pull origin main && git branch -D <branch>`. Check the item reached Done.

Bugs found along the way go into a new issue in Todo, not into the current PR.

## Flow (parent epic + sub-issues)

A big feature is a parent issue plus one sub-issue per PR, but sub-issue PRs do **not** target `main` directly — they stack onto the parent's own feature branch, which is the last thing merged to `main`.

1. **Plan** — parent issue holds the overall plan; each sub-issue holds its own slice. Link sub-issues under the parent (`sub_issues` API command above). Wait for approval before any code.
2. **Start the parent** ("start P") — `git fetch origin && git checkout -b claude/feature-P-<slug> origin/main`, push it once (`git push -u origin`) so sub-issue branches have something to fork from. Move the parent item to In Progress.
3. **Start each sub-issue** ("start N") — branch **from the parent branch, not `origin/main`**: `git fetch origin && git checkout -b claude/feature-N-<slug> origin/claude/feature-P-<slug>`. Move the sub-issue item to In Progress.
4. **Build → Gates** — same as the single-issue flow, per sub-issue.
5. **Sub-issue PR** — targets the **parent branch** (`gh pr create --base claude/feature-P-<slug>`), not `main`. `(Fixes #N)` in the final commit still applies so the sub-issue closes when this PR merges.
6. **Watch CI, fix, merge the sub-issue PR into the parent branch** — same fix-commit-push loop as step 6 of the single-issue flow. After merging, pull the parent branch locally (`git checkout claude/feature-P-<slug> && git pull origin claude/feature-P-<slug>`) before starting or rebasing the next sub-issue on it.
7. **Repeat** step 3–6 for every sub-issue.
8. **Parent PR** — once every sub-issue is merged into the parent branch, open the parent's own PR from `claude/feature-P-<slug>` into `main`, with `Fixes #P #<sub1> #<sub2> …` in the description so every linked issue auto-closes on merge. Run the same Watch CI loop (step 6 above) against this PR before merging.
9. **After the parent merges to main** (user says merged) — `git checkout main && git pull origin main && git branch -D claude/feature-P-<slug>` (and any leftover local sub-issue branches).
10. **Reverify** — this is the step that matters most for a parent epic, since it's the one moment everything actually lands on `main` together:
    - Confirm the parent **and every sub-issue** actually closed: `gh issue view N --json state,closedAt` for each, and that the board item reached **Done**.
    - Re-run the full local gate set (lint/build/test, and ruff/mypy/pytest if backend was touched and Python is on PATH) against the freshly-pulled `main` — sub-issue branches each passed CI individually against the parent branch, but the parent branch itself may never have been gate-checked against `main` until this final merge.
11. **Parent done?** — verify every requirement in every sub-issue's body actually exists in the code (grep for it, don't trust a closed checkbox). A closed issue is not proof the work was built.

Bugs found along the way go into a new issue in Todo, not into the current PR.

## Issue template

```markdown
## Overview
One or two sentences: what and why.

## Requirements
- …

## Implementation Notes
- Files/services to touch, risks, dependencies

## Related
- Depends on / Blocks: #…

## Acceptance Criteria
- [ ] …
- [ ] lint / build / tests pass; merged to main

## Status
⏳ Backlog (awaiting approval)
```

## PR template

```markdown
Fixes #N

## Plan (from issue)
…

## Changes
- file — what changed

## Testing
- what ran, what passed (only what actually ran)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## Rules

- Branches: `claude/feature-N-<slug>` or `claude/bugfix-N-<slug>`; one feature per PR.
- Never delete issues — close as "not planned" with a comment.
- Never force-push `main`; never skip hooks.
- Delete a branch right after its PR merges.
- Destructive or shared actions (deleting files/issues, closing issues, merging) need the user's go-ahead.
