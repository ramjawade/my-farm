---
name: auto-testing-and-fix
description: Autonomously smoke-test the live my-farm app (or a named page/flow) with the Browser pane in batches ("patches") of a configurable number of bugs, tell real bugs apart from browser-automation flakiness, file each patch as GitHub issues via board-first, and — if the patch isn't approved — keep hunting for the next patch instead of stopping. Use when asked to test/QA a page or flow and fix what's found, or to run a smoke test. Never fixes code without the user approving the filed issue(s) first.
---

Base directory for this skill: C:\Users\Ram\dev\fe\my-farm\.claude\skills\auto-testing-and-fix

# Auto testing & fix

Smoke-test the live app (or a specific page/flow), tell real bugs apart from
automation noise, and route every confirmed bug through the [[board-first]]
workflow. This skill never fixes code on its own authority — it files a
**patch** of findings, waits for approval, then follows board-first's normal
build/PR flow. There is no literal Jira integration in this repo — "log to
Jira" / "log a patch" means file GitHub issues on the project board (the
only tracker this repo has); say so once if the user's wording suggests they
expect a real Jira, then proceed with GitHub issues.

Default target: https://ramjawade.github.io/my-farm/ (prod frontend) talking
to `https://myfarm-api.onrender.com` (prod backend). If the user names a
specific page/flow, scope the session to that instead of a full sweep.

## Patch size

A **patch** is a batch of confirmed-bug findings filed together in one round.

- Default patch size: **10** issues.
- Configurable per invocation — if the user gives a number ("patch of 5",
  "max 3 issues at a time"), use that instead for the rest of the session
  (all subsequent patches in this run), not just the first one.
- A patch may end up smaller than the configured size if a full sweep of the
  in-scope pages/flows turns up fewer confirmed bugs — don't pad it with
  unverified or low-confidence findings just to hit the number.

## Procedure

1. **Scope** — confirm (or infer from the user's ask) which page/flow to test:
   login/register, a specific feature page, or a full click-through of the nav
   (Home, Lands, Crops, Activities, Weather, Reports, Profile). Also confirm
   (or infer) the patch size for this run.
2. **Drive it** — use the Browser pane tools. For every step:
   - Take a screenshot (or `read_page`) *immediately before* clicking by pixel
     coordinate — viewport scaling (emulated size vs. the pane's actual
     rendered size) means a coordinate computed from a stale screenshot or
     from a `getBoundingClientRect()` call misses. Prefer clicking by `ref`
     (from `read_page`/`find`) over raw coordinates when a ref is available.
   - Prefer `form_input` to set field values over click+type — it's immune to
     focus/coordinate drift between fields.
   - After any state-changing action, re-`read_page` or screenshot before
     asserting what happened; don't chain multiple blind clicks.
3. **Instrument, don't just eyeball**:
   - `read_console_messages` (errors) and `read_network_requests` for static
     assets, but this app's XHR/fetch calls to `myfarm-api.onrender.com` don't
     reliably show there — pull them with `javascript_tool`:
     ```js
     performance.getEntriesByType('resource')
       .filter(r => r.initiatorType === 'xmlhttprequest' || r.initiatorType === 'fetch')
       .map(r => ({name: r.name, status: r.responseStatus}))
     ```
   - Check `localStorage` state directly (`my_farm_active_user_id`,
     `my_farm_session_token`, `my_farm_session_expiry`) when testing
     login/logout/session persistence — don't infer session state from the
     UI alone.
4. **Verify before filing — kill false positives.** The Browser pane's
   coordinate clicks are flaky (a click can silently miss a moving/toggled
   element, especially right after a screenshot or on dropdown toggles) and
   produce symptoms that look exactly like real bugs but aren't. Before
   writing up ANY finding:
   - Reproduce it a second way: a `ref`-based click, or a direct
     `element.click()` / `form.dispatchEvent` via `javascript_tool`.
   - Cross-check against the actual source (`Grep`/`Read` the component,
     service, or SCSS involved) — find the real mechanism, don't file on
     symptom alone. A CSS stacking bug should be traced to the actual
     z-index values; a "stuck" state should be traced to the actual
     handler/signal.
   - If the second reproduction doesn't confirm it, it was automation noise,
     not a bug — drop it and move on, don't file it.
5. **Keep hunting until the patch is full (or the scope is exhausted).**
   Don't stop at the first bug — continue testing across the in-scope
   pages/flows, verifying each finding (step 4) as you go, until you've
   accumulated up to the configured patch size in confirmed bugs, or you've
   covered the full scope and there's nothing left to check.
6. **File each bug as its own issue first**, using the [[board-first]] skill's
   issue template and `gh issue create` (Todo column, `bug` label plus a
   dated **`regression-YYYY-MM-DD`** label — today's date, one label per
   calendar day of testing, not per patch). Include: root cause (with
   file:line), a minimal repro, and acceptance criteria. Every independent
   bug gets its own issue — never bundle two bugs' fixes into one issue
   body.
   - Create the label once per day if it doesn't exist yet:
     `gh label create "regression-YYYY-MM-DD" --color d73a4a --description "Regression bugs found YYYY-MM-DD" 2>/dev/null || true`
     (ignore the error if it already exists — check with
     `gh label list --search regression-YYYY-MM-DD` first only if you need
     to confirm, don't make it a separate step every time).
   - Add both labels in the same `gh issue create --label bug --label
     "regression-YYYY-MM-DD" ...` call; for the parent "release" issue
     (step 7), tag it with the label(s) matching the date(s) of the patches
     it consolidates (it may span two labels if patch 1 and patch 2 were
     found on different days).
   - This is what makes a day's regression sweep easy to filter/channelize
     later (`gh issue list --label regression-2026-09-12`) — don't skip it
     even for a single-bug patch.
7. **Don't consolidate every round — only every other one.** Creating the
   parent issue and linking sub-issues costs a `gh api` round-trip per child
   (each one echoes the full issue JSON back into context — real token cost,
   not hypothetical), so it isn't worth doing after every single patch:
   - After patch 1: file the individual bug issues (step 6) and report them
     as a **flat list**, no parent issue yet.
   - After patch 2 (or whenever the user is ready to approve/fix, whichever
     comes first): consolidate — build **one** parent "release" issue that
     covers *every still-open, unapproved patch issue so far* (patch 1 +
     patch 2 together, not one parent per patch), using board-first's
     **parent-epic** shape: title like "Patch release: <short list> (#a, #b,
     #c, #d, #e)", body listing every sub-issue **in the order they'll be
     fixed** (highest severity / least-dependent first) plus acceptance
     criteria "each sub-issue merged into this parent branch" + "parent
     branch merged to main".
   - Link sub-issues in one pass, and throw away the noisy response instead
     of letting it print into context — e.g.
     `gh api repos/ramjawade/my-farm/issues/<parent>/sub_issues -F sub_issue_id=$(gh api repos/ramjawade/my-farm/issues/<child> --jq .id) > /dev/null`
     for each child, inside a single Bash call (one round-trip, not one per
     child). Same rule for any other `gh api`/`gh issue` mutation whose
     output you don't need: redirect it away rather than let it flood
     context.
   - If a third patch gets filed before the first parent is approved, don't
     make a second parent — update the existing one's body/sub-issues to
     include it instead.
8. **Report and stop.** After a flat-list round: present the bug list, ask
   whether to keep hunting or consolidate now. After a consolidation round:
   present the parent issue link plus its sequenced sub-issue list (one-line
   summary each), plus what was checked but turned out fine (say so
   explicitly — it's signal, not noise). Ask for approval either way. Do not
   start branching/coding.
9. **If approved** — switch fully into [[board-first]]'s **parent-epic flow**:
   branch the parent (`claude/feature-<parent>-<slug>` off `origin/main`,
   pushed once), then for each sub-issue in the documented sequence: branch
   off the parent branch, implement exactly what that sub-issue says, run
   `npm run lint` / `npm run build`, PR into the **parent branch** (not
   `main`) with `Fixes #<sub-issue>`, watch CI, merge, pull the parent branch
   locally, then move to the next sub-issue in sequence. Once every
   sub-issue is merged into the parent branch, open the parent's own PR into
   `main` (`Fixes #<parent> #<sub1> #<sub2> ...`) and run the same watch/fix
   loop there. Nothing here overrides board-first's "no code before
   approval" rule — the parent issue itself is what needs approval.
10. **If not approved** (rejected outright, or the user says "no"/"keep
    looking"/gives no go-ahead) — do not fix anything from this patch. Go
    back to step 2 and keep testing to assemble the **next** patch: a fresh
    batch of up to the configured size, covering ground (pages/flows/edge
    cases) not yet exercised. File it the same way (individual issues, then
    a parent consolidating it — and any still-pending earlier patch — per
    step 7). Repeat until the user approves a patch, narrows scope, or says
    to stop.

## Reset after testing
`resize_window` back to `preset: "desktop"` and clear any emulation before
ending the session — the pane persists viewport emulation across calls.

## Non-negotiables (inherited from CLAUDE.md / board-first)
- No fix commits before the user approves the filed issue.
- Bugs found mid-testing are new issues, never folded into an in-flight PR.
- Never fix by guessing — always find the actual line(s) responsible first.
