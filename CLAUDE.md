# Claude Code Development Workflow

## Overview

This document defines the **unified workflow** for all development on this project using GitHub Projects v1 as the source of truth. All work must flow through the project board — there are no local plans or hidden designs. Agents and developers follow a strict **board-first, code-second** approach.

**Golden Rule:** 📋 **Everything starts on the GitHub Project board, not in code.**

---

## GitHub Project Workflow

Your project board has 4 status columns: **Backlog** → **In Progress** → **In Review** → **Done**

### Workflow Stages

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. PLANNING (on the board)                                      │
│    - User describes feature/bug → Create Issue                  │
│    - For complex work: Link parent → sub-issues                 │
│    - Add Issue to Project → Status: "Backlog"                   │
│    - Set description as: **Approved Plan** (not a draft)        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. APPROVAL (async, on the board)                               │
│    - User reviews Issue description on board                    │
│    - Comments/requests changes if needed                        │
│    - Once approved, Issue is ready (stays in Backlog)           │
│    - ⚠️ Do NOT start coding until approved                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. IMPLEMENTATION (code, branch, PR)                            │
│    - Agent creates branch from approved Issue                   │
│    - Move Issue to "In Progress" (manually or auto)             │
│    - Follow code quality rules (lint, build, tests)             │
│    - Commit & push branch                                       │
│    - Create PR (link to Issue)                                  │
│    - Keep Issue in "In Progress"                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. REVIEW (PR review cycle)                                     │
│    - PR ready for review                                        │
│    - Move Issue to "In Review" (manually or auto)               │
│    - Address review comments                                    │
│    - Keep Issue in "In Review" until merged                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. COMPLETION (merge & cleanup)                                 │
│    - PR merged to `main`                                        │
│    - Move Issue to "Done" (manually or auto)                    │
│    - Delete branch immediately after merge                      │
│    - Issue stays in Done (don't close it)                       │
│    - CI passes, feature deployed                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## How to Create & Plan Work

### ✅ DO: Create Issues on the Board First

**When you have a requirement:**

1. **Open GitHub Project** → https://github.com/users/ramjawade/projects/6
2. **Create Issue** (in project or repo)
   - **Title:** Brief feature/bug description
   - **Description:** Complete plan (what, why, how, files to touch)
   - **Labels:** `backend`, `frontend`, `bug`, `feature`, etc.
   - Add to Project → Status: **Backlog**
3. **For complex work:** Create parent issue + sub-issues
   - Parent: High-level feature description
   - Sub-issues: Each discrete piece of work
   - Link via `is:sub-issue-of` or GitHub sub-task syntax

### ❌ DON'T: Write Plans Outside the Board

- ❌ No DESIGN.md, PLAN.md, or local planning docs
- ❌ No long email threads debating approach
- ❌ No "let me think about this and get back to you"
- ✅ **Everything goes in the Issue description** on the board

### Plan Description Template

When creating an Issue, use this structure in the description:

````markdown
## Overview
One-sentence summary of what this does.

## Requirements
- Specific requirement 1
- Specific requirement 2
- Specific requirement 3

## Implementation Notes
- Which files to touch
- Which services/APIs are involved
- Known risks or constraints
- Dependencies (other issues that must complete first)

## Related
- Blocks: [#45](link to issue)
- Depends on: [#42](link to issue)

## Acceptance Criteria
- [ ] Feature works locally
- [ ] Tests pass
- [ ] Code reviewed
- [ ] Merged to main

## Status
⏳ Backlog (awaiting approval)
````

---

## Project Board Status Flow

### Status: Backlog
- **What:** New issues awaiting approval or not yet started
- **Entry:** Issue created and added to project
- **Exit:** Approved + branch created
- **Duration:** Same day to 1+ week depending on complexity
- **Agent Action:** Read issue description for plan, request clarification if needed

### Status: In Progress
- **What:** Active development (branch exists, code is being written)
- **Entry:** Agent creates branch from approved Issue
- **Exit:** PR created and ready for review
- **Duration:** 1-4 hours to several days
- **Agent Action:** Follow the approved plan, write code, commit, push, create PR
- **Project Update:** Manually move to "In Progress" when branch is created

### Status: In Review
- **What:** PR opened, under code review
- **Entry:** PR created with link to Issue
- **Exit:** PR approved and ready to merge
- **Duration:** 1-24 hours (address feedback if needed)
- **Agent Action:** Address review feedback, push updates, re-request review
- **Project Update:** Manually move to "In Review" when PR is ready

### Status: Done
- **What:** Completed work (PR merged, branch deleted, feature deployed)
- **Entry:** PR merged to `main`
- **Exit:** Final (historical record)
- **Duration:** ∞ (stays here as reference)
- **Agent Action:** Delete branch, confirm CI passes
- **Project Update:** Manually move to "Done" after merge

---

## For Complex Features: Parent-Child Issues

**When a feature is too big to fit in one PR:**

### Example: Backend Stage 7 (Weather + Attachments)

**Parent Issue #42:**
```
Title: Backend Stage 7 — Weather API & Attachments (Cloudflare R2)
Description: (overview + implementation notes)
Status: In Progress
Sub-issues:
  - #50 (child): Server-side weather API caching
  - #51 (child): Cloudflare R2 integration
  - #52 (child): Activity photo upload endpoint
```

**Child Issues (#50, #51, #52):**
- Each child is its own Issue with **independent PR**
- Each child moves through **Backlog → In Progress → In Review → Done**
- Parent stays **In Progress** until **all children are Done**
- Each child branch/PR is tracked separately on the board

---

## Branch Strategy

### Naming Convention
- **Feature:** `claude/feature-<description>` (e.g., `claude/feature-r2-integration`)
- **Bugfix:** `claude/bugfix-<issue>` (e.g., `claude/bugfix-activity-sync`)
- **Stage:** `claude/stage-<number>-<description>` (e.g., `claude/stage-7-weather-attachments`)

### Branch Lifecycle

```
1. Issue created & approved on board (Backlog status)
   ↓
2. Agent creates branch:
   git checkout -b claude/feature-xyz
   
3. Move Issue to "In Progress" (board)
   ↓
4. Write code, commit, push
   ↓
5. Create PR (reference Issue: "Fixes #42")
   ↓
6. Move Issue to "In Review" (board)
   ↓
7. Address review feedback if needed
   ↓
8. PR merged to main
   ↓
9. Delete branch:
   git branch -D claude/feature-xyz
   
10. Move Issue to "Done" (board)
```

**Critical:** Delete branches **immediately after merge** — no orphaned branches.

---

## Code Quality Gates

Before creating a PR, these must pass:

```bash
npm run lint    # ✓ No linting errors
npm run build   # ✓ Code compiles
# (tests ready if applicable)
```

**All PRs must pass CI** before merging to main.

---

## PR Description Template

Every PR must link to its Issue and capture the plan:

````markdown
Fixes #42

## Plan (from Issue)
Brief summary of what this PR does.

## Changes
- File 1: What changed
- File 2: What changed

## Testing
- How to test locally
- What tests pass

## Checklist
- [x] Lint: `npm run lint` ✓
- [x] Build: `npm run build` ✓
- [x] Tests ready
- [x] Feature works locally
- [x] PR description complete
````

---

## Workflow Rules for Agents

### When You Start a Task

1. **Look at the GitHub Project board** first
2. **Find the Issue** in the Backlog that you're working on
3. **Read the full Issue description** — this IS your plan (not separate docs)
4. **Check for sub-issues** — if it's a parent, work on children first
5. **Check the Backlog** — is this Issue approved? (description should be complete)
   - ✅ If approved: proceed to branch creation
   - ⏸️ If not approved: ask for clarification in Issue comments

### When You're Implementing

1. **Create the branch** with the right naming convention
2. **Immediately update the Project:** Move Issue to "In Progress"
3. **Follow the plan** in the Issue description exactly
4. **If the plan needs to change:** Stop and comment on the Issue (request user approval)
5. **Commit with clear messages** — reference the Issue number

### When You Open a PR

1. **Link the PR to the Issue:** "Fixes #42" in the PR description
2. **Copy the plan** from Issue into PR description
3. **Include testing notes** in the PR
4. **Update the Project:** Move Issue to "In Review"

### When the PR is Merged

1. **Delete the branch** immediately (locally and remote)
2. **Update the Project:** Move Issue to "Done"
3. **Celebrate!** ✨ (the Issue is now a permanent record of completed work)

---

## Usage Optimization Rules

### ✅ DO
- Keep reasoning effort at `medium` (unless architecture is genuinely complex)
- Batch independent tool calls into one request
- Reuse context already in the conversation
- Keep commit messages and PR descriptions concise
- Reference Issue/PR numbers in commits

### ❌ DON'T
- Don't write plans locally — they go in Issues
- Don't skip Board updates (moving between statuses)
- Don't leave branches after merge
- Don't force-push to main
- Don't combine multiple features in one PR
- Don't skip CI/lint/build checks before pushing

---

## Interaction & Styling Rules

- **Don't drive the Browser** unless asked. Run `npm run build` to catch errors, but don't screenshot/navigate to verify UI unless requested.
- **Prefer Bootstrap CSS** over custom CSS. Use utility classes (`d-flex`, `btn`, `badge`) first; only write custom CSS as a last resort.

---

## Example: Full Workflow

### Scenario: User Requests "Add password reset via email"

#### 1️⃣ Planning (on the board)

User creates Issue on the board:
```
Title: Feature: Email-based password reset
Description:
  ## Overview
  Allow users to reset password via email verification code.
  
  ## Requirements
  - API endpoint: POST /api/auth/password-reset
  - Email service integration (SendGrid or similar)
  - Frontend: Reset form with code input
  
  ## Implementation
  - Touch: projects/backend/auth/reset.py, projects/home/auth/reset.component.ts
  - Depends on: #30 (email service setup)
  - Blocks: #33 (2FA workflow)
  
  ## Status
  ⏳ Backlog - awaiting approval
```

Agent/User approves (updates description, confirms ready)

#### 2️⃣ Implementation

Agent reads Issue, then:
```bash
git checkout -b claude/feature-password-reset

# (writes code, follows plan from Issue)

git commit -m "Add email password reset flow (Issue #XX)"
npm run lint  # ✓
npm run build # ✓

git push -u origin claude/feature-password-reset
```

**Agent updates Project:** Move Issue to "In Progress"

#### 3️⃣ PR & Review

Agent opens PR:
```
Title: Add email-based password reset (Fixes #XX)
Description:
  Fixes #XX
  
  Plan: (copy from Issue)
  - New endpoint: POST /api/auth/password-reset
  - SendGrid integration for emails
  - Frontend reset form with code verification
  
  Testing:
  - Unit tests pass
  - Feature tested with demo email
  - CI green
```

**Agent updates Project:** Move Issue to "In Review"

#### 4️⃣ Merge & Complete

User approves PR → Agent merges → Agent deletes branch

```bash
git branch -D claude/feature-password-reset
```

**Agent updates Project:** Move Issue to "Done" ✅

---

## Summary: Board-First Principles

| Principle | Rule |
|-----------|------|
| **Single Source of Truth** | GitHub Project board = all plans |
| **No Hidden Design** | Plans live in Issue descriptions, not local files |
| **Approval Before Code** | Issue must be approved before branch creation |
| **Continuous Visibility** | Project reflects real-time work status |
| **Clear Hierarchy** | Parent-child issues for complex features |
| **Permanent Records** | Done issues stay visible (never delete) |
| **Strict Status Flow** | Backlog → In Progress → In Review → Done |

---

## Quick Reference: What to Do When...

| Scenario | Action |
|----------|--------|
| **User has a new idea** | Create Issue on board with full plan, add to Backlog |
| **Agent starts work** | Read Issue, create branch, move to In Progress |
| **Plan needs to change** | Comment on Issue (don't patch silently) |
| **Code is ready** | Create PR linking Issue, move to In Review |
| **PR is approved** | Merge, delete branch, move Issue to Done |
| **Work is complete** | Issue in Done = permanent record (never delete) |
| **Complex feature** | Create parent Issue + child sub-issues for each part |
