# Git workflow

| Branch | Purpose | Deploys to |
|---|---|---|
| `main` | What real users have | Production, after approval |
| `development` | Finished work being tested | Staging |
| `feature/...`, `fix/...`, `chore/...` | One piece of work each | Nowhere |

```
feature/xyz ──PR──▶ development ──auto──▶ STAGING  (test here)
                         │
                       PR + approval
                         ▼
                        main ──auto──▶ PRODUCTION
```

## Building something new

**1. Start from the latest `development`:**
```bash
git switch development
git pull
git switch -c feature/short-name
```

**2. Work and commit in small steps:**
```bash
npm test
git status                  # check what you're about to commit
git add path/to/file
git commit -m "Describe the change"
```

**3. Push your branch:**
```bash
git push -u origin feature/short-name
```

**4. Open a pull request on GitHub:**
1. Go to the repo and click **Compare & pull request**.
2. Set **base** to `development`. Check this every time.
3. Describe what changed and how you tested it.
4. Wait for the tests and a review.

**5. Merge it.** Staging then deploys automatically, so test your change at https://umconnect-e455a.web.app.

**6. Clean up:**
```bash
git switch development
git pull
git branch -d feature/short-name
```

## If `development` moved while you were working

```bash
git switch development
git pull
git switch feature/short-name
git merge development
```

If Git reports conflicts, open the listed files, choose the right code and remove the `<<<<<<<`, `=======` and `>>>>>>>` markers. Then run:

```bash
git add path/to/file
git commit
git push
```

## Releasing to production

1. Test everything on staging first.
2. On GitHub, open a pull request with **base** `main` and **compare** `development`.
3. Get it reviewed, then merge using **Create a merge commit**. Don't squash this PR, because the two branches would stop matching and the next release would show false conflicts.
4. Open the **Actions** tab and approve the production deployment when asked.
5. Check the production site.

## Urgent production fixes

Use this only when production is broken and the fix can't wait for a normal release.

```bash
git switch main
git pull
git switch -c fix/short-name
```

1. Commit and push the fix, then open a PR into `main`.
2. After it's merged and deployed, open a PR from `main` into `development`, so the fix isn't lost in the next release.

## Rules

- Don't commit directly to `main` or `development`.
- Don't commit `.env.local`, `.env.production` or service account keys. If you commit one by accident, tell the team leader straight away, even if you delete it afterwards: it stays in Git history.
- Don't use `git push --force` on `main` or `development`.
- Keep each branch to one piece of work, so it's easier to review.
- Avoid `git add .` until you've checked `git status`.

## Repo admin setup (once)

**Branch protection:** Settings > Branches > Add rule, for both `main` and `development`:
- Require a pull request before merging, with 1 approval
- Require status checks to pass, and select the `test` check after it has run once
- Block force pushes

**Default branch (recommended):** in Settings > General, set it to `development`, so new PRs target it automatically. Check Settings > Pages first, in case Pages depends on the current default.

**Deployment environments:** see [DEPLOY.md](DEPLOY.md#set-up-github-actions).
