Production checklist — AI Website Analyser

1) Secrets & keys
- Remove `backend/.env` from git history and rotate keys at providers (OpenAI, DataForSEO, ZAP).
- Use environment variables on the deployment host or a secret manager (AWS Secrets Manager, Vault, GitHub Secrets).

2) Node & runtime
- Use Node LTS (>=18, <25). Prefer Node 18/20 in production. Add `.nvmrc` with `lts/*` or specific version.
- Run with a process manager (PM2) or inside a Docker container behind a reverse proxy (NGINX) terminating TLS.

3) Security
- Ensure `JWT_SECRET` is set to a strong random value. The server will refuse to start in `NODE_ENV=production` without it.
- Do not enable `PUPPETEER_ALLOW_NO_SANDBOX` in multi-tenant or untrusted environments.
- Configure HTTPS, HSTS, and `helmet()` is enabled by default.

4) Ops
- Configure `MONGODB_URI` to a managed database with authentication and network restrictions.
- Monitor logs and errors, and run regular dependency audits (`pnpm audit`).

5) CI/CD
- Add Dependabot or Renovate for dependency updates.
- Add `pnpm install --frozen-lockfile`, `pnpm audit`, and tests to CI pipelines.

6) Post-change steps (important)
- Run `git rm --cached backend/.env` and commit the removal, then purge secrets from history using BFG or git filter-repo and force-push.
- Rotate any exposed keys immediately.

Commands:
```bash
# Remove tracked env and commit
git rm --cached backend/.env
git commit -m "Remove tracked backend/.env (contains secrets)"
# Purge history (BFG example) - run with caution
bfg --delete-files backend/.env
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force
```
