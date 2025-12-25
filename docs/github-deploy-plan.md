# GitHub Actions Deploy Plan

## Overview

Replace the current `git push deploy` workflow with automatic deploys triggered by pushing to `origin/main`. GitHub Actions will SSH into the server and run the deploy script.

## Current State

- Push to `deploy` remote triggers `post-receive` hook
- Hook reads git refs from stdin (`while read oldrev newrev ref`)
- Deploy runs as `deploy-user`, service runs as `deploy-user`
- Server: configured in secrets

## Target State

- Push to `origin/main` triggers GitHub Actions workflow
- Workflow SSHs to server and runs deploy
- `deploy` remote becomes optional/deprecated

---

## Implementation Steps

### 1. Refactor deploy script for direct execution

**Current problem:** The `post-receive` hook expects git ref data on stdin. When called directly via SSH, there's no stdin.

**Solution:** Create a standalone deploy script that can be called directly.

```
/srv/dogbook/deploy.sh  (new, standalone)
/srv/dogbook/repo.git/hooks/post-receive  (calls deploy.sh, for backwards compat)
```

The new `deploy.sh`:
- No stdin reading
- Accepts optional branch argument (default: main)
- Does a `git fetch && git checkout` instead of relying on post-receive context
- Same build/migrate/restart logic

### 2. SSH access for GitHub Actions

**Option A: Direct SSH with IP allowlisting**
- Add GitHub Actions IP ranges to server firewall
- Problem: GitHub's IPs change, ranges are large (Azure datacenter blocks)
- Not recommended

**Option B: SSH key only (no IP restriction)**
- Rely solely on SSH key authentication
- Simpler, but server SSH port exposed to internet
- Acceptable if SSH is hardened (key-only, no root, fail2ban)

**Option C: Tailscale/Wireguard tunnel**
- GitHub runner connects to Tailscale network first
- SSH over private network
- Most secure, but adds complexity
- Requires Tailscale auth key as secret

**Recommendation:** Option B for simplicity. Server already accepts SSH on port 22.

### 3. GitHub Secrets required

| Secret | Description |
|--------|-------------|
| `DEPLOY_SSH_KEY` | Private key for deploy user |
| `DEPLOY_HOST` | Server hostname or IP address |
| `DEPLOY_USER` | `deploy-user` |

**SSH key setup:**
- Generate dedicated deploy key: `ssh-keygen -t ed25519 -C "github-deploy"`
- Add public key to `/home/deploy-user/.ssh/authorized_keys` on server
- Add private key to GitHub Secrets
- Consider: restrict key to only run deploy script (see `command=` in authorized_keys)

### 4. GitHub Actions workflow

File: `.github/workflows/deploy.yml`

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: /srv/dogbook/deploy.sh
```

### 5. Restricted SSH key (optional but recommended)

In `/home/deploy-user/.ssh/authorized_keys`:

```
command="/srv/dogbook/deploy.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding ssh-ed25519 AAAA... github-deploy
```

This ensures the deploy key can ONLY run the deploy script, nothing else.

---

## Gotchas & Mitigations

### 1. Concurrent deploys
**Problem:** Two pushes in quick succession = two simultaneous deploys = corruption.

**Solution:** Use a lock file in deploy script:
```bash
LOCKFILE="/tmp/dogbook-deploy.lock"
exec 200>"$LOCKFILE"
flock -n 200 || { echo "Deploy already in progress"; exit 1; }
```

### 2. Deploy failures not visible
**Problem:** With `git push deploy`, you see output immediately. With GitHub Actions, you need to check the Actions tab.

**Solutions:**
- GitHub sends email on workflow failure (default)
- Add Slack/Discord notification step
- Badge in README showing deploy status

### 3. Long-running builds
**Problem:** Keystone build takes 1-2 minutes. SSH connection might timeout.

**Solution:** GitHub Actions default timeout is 6 hours. SSH action has configurable timeout. Should be fine, but set explicit timeout:
```yaml
timeout: 10m
```

### 4. Secrets rotation
**Problem:** If deploy key is compromised, attacker can deploy arbitrary code.

**Solutions:**
- Use restricted `command=` in authorized_keys (limits damage)
- Rotate key periodically
- Monitor for unexpected deploys

### 5. Branch protection
**Problem:** Anyone with push access to main can trigger deploy.

**Solution:** Enable branch protection:
- Require PR reviews before merge
- Require status checks (tests, lint)
- Only then does merge trigger deploy

### 6. Rollback strategy
**Problem:** Bad deploy goes out, need to revert quickly.

**Solutions:**
- `git revert` + push triggers new deploy
- Keep previous build artifacts (not currently done)
- Manual SSH + git checkout of previous commit

### 7. Database migrations on rollback
**Problem:** If deploy included a migration, rollback doesn't undo it.

**Solution:**
- Prisma doesn't auto-rollback migrations
- Would need manual intervention or migration down scripts
- For SQLite: restore from backup (already have backup logic potential)

---

## Testing plan

1. Create deploy key, add to server
2. Test SSH manually: `ssh -i deploy_key $DEPLOY_USER@$DEPLOY_HOST /srv/dogbook/deploy.sh`
3. Add secrets to GitHub
4. Create workflow file on a branch
5. Merge branch, verify deploy runs
6. Test failure case (break something, verify notification)
7. Remove `deploy` remote or keep as backup

---

## Migration path

1. Implement new `deploy.sh` script
2. Update `post-receive` to call `deploy.sh` (maintains backward compat)
3. Test that `git push deploy` still works
4. Set up GitHub Actions
5. Test GitHub-triggered deploy
6. Deprecate `deploy` remote (optional - can keep both)

---

## Future enhancements

- **Staging environment:** Deploy to staging on PR, production on merge
- **Deploy previews:** Spin up temporary environment per PR
- **Health checks:** After deploy, verify service responds before marking success
- **Metrics:** Track deploy frequency, duration, failure rate
