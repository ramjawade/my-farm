# Claude Code Development Workflow

## Overview
This document outlines the workflow and rules for developing features with Claude Code on this project.

## Branch Strategy

### Naming Convention
- Feature branches: `claude/feature-<description>` (e.g., `claude/feature-auth-integration`)
- Bugfix branches: `claude/bugfix-<issue>` (e.g., `claude/bugfix-activity-sync`)
- Phase branches: `claude/phase-<number>-<description>` (e.g., `claude/phase-2-persistence-layer`)

### Branch Lifecycle
1. **Create**: Branch from latest `main` 
2. **Work**: Complete, testable feature only
3. **Verify**: 
   - ✅ `npm run build` passes
   - ✅ `npm run lint` passes
   - ✅ Unit tests ready
   - ✅ Feature tested locally
4. **Commit**: Clear, descriptive commit messages
5. **Push**: Push to remote branch
6. **Create PR**: Create pull request for review
7. **Merge**: Merge to main via PR
8. **Delete**: Delete branch (both local and remote) immediately after merge

## Rules & Guidelines

### ✅ DO
- Create **focused, testable features** only per branch
- Complete features before merging (no half-finished work)
- Run full test suite before pushing
- Write clear commit messages
- Delete branches after merging
- Use descriptive PR titles and descriptions
- Keep branches short-lived (1-2 days max)

### ❌ DON'T
- Reuse merged branches for new work
- Commit incomplete/untested features
- Leave branches orphaned after merge
- Accumulate multiple features in one branch
- Force push to main/master
- Skip build/lint checks before push

## CI/CD Gates

Before any PR merge, these must pass:
- ESLint: `npm run lint` ✓
- Build: `npm run build` ✓
- Tests: Unit test suite ready ✓

## Feature Checklist

For each feature branch:

```markdown
- [ ] Feature is complete and testable
- [ ] npm run build passes
- [ ] npm run lint passes  
- [ ] Unit tests added/updated
- [ ] Feature tested in browser
- [ ] Commit messages are clear
- [ ] PR description is complete
- [ ] Ready to merge
- [ ] Merge to main via PR
- [ ] Delete branch after merge
```

## Workflow Example

```bash
# 1. Start new feature
git fetch origin main
git checkout -b claude/feature-activity-export

# 2. Make changes, commit
git add projects/...
git commit -m "Add activity export to CSV functionality"

# 3. Verify
npm run lint  # ✓
npm run build # ✓

# 4. Push and create PR
git push -u origin claude/feature-activity-export

# 5. (After review & merge)
# Delete branch on GitHub

# 6. Clean up locally
git branch -D claude/feature-activity-export
```

## Current Status

- Phase 0: ✅ Complete (ESLint, CI gates)
- Phase 1: ✅ Complete (Unified Activity Model)
- Phase 2: 🔄 Next (Storage abstraction layer)

## Next Features

Ready to work on testable features:
- Phase 2: Storage abstraction layer (StorageService interface)
- Phase 3: Real authentication system
- Phase 4: Real weather API integration
- Phase 5: Backend sync layer
- Phase 6: Feature completion & polish

---

**Last Updated**: 2026-09-01
**Process**: Merge & Delete workflow established
