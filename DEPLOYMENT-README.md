# 🚨 DEPLOYMENT WARNING - READ THIS FIRST 🚨

## CRITICAL: This project has a DUAL-BRANCH deployment system

### ⛔ NEVER do this:
```bash
git push          # ❌ WRONG - only updates main, Vercel won't see it!
git push origin main   # ❌ WRONG - Vercel watches vercel-test!
```

### ✅ ALWAYS do this:
```bash
./deploy-to-vercel.sh "Your commit message"
```

## Why?
- **main branch** = local development (localhost)
- **vercel-test branch** = Vercel production (live site)
- Vercel ONLY deploys from `vercel-test`
- Pushing to `main` alone = changes never go live

## The Problem This Solves
Multiple debugging sessions wasted because code was pushed to `main` but Vercel kept showing old code from `vercel-test`.

## What the Script Does
1. Commits your changes to `main`
2. Pushes `main` to GitHub
3. Switches to `vercel-test`
4. Merges `main` into `vercel-test`
5. Pushes `vercel-test` (triggers Vercel deployment)
6. Switches back to `main`

## For AI Assistants
When making frontend changes:
1. **ALWAYS** ask "Should I deploy to Vercel?"
2. **ALWAYS** use `./deploy-to-vercel.sh` script
3. **NEVER** just `git push` and assume it's deployed
4. Check `/memories/repo/deployment-workflow.md` for details

---

**Last Updated:** 2026-07-08 - After multiple wasted debugging sessions
