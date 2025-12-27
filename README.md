# Dogbook - Trombinoscope Canin

A dog directory application with a static frontend and headless CMS backend.

## Architecture

```
dogbook/
├── backend/     # KeystoneJS 6 + SQLite (headless CMS)
├── frontend/    # 11ty static site generator
└── deploy/      # VPS deployment scripts
```

**Backend:** KeystoneJS 6 with SQLite, provides GraphQL API and admin UI.
**Frontend:** Static site built with 11ty, fetches data at build time.

## Quick Start

### Prerequisites
- Node.js 18+
- npm

### Development

```bash
# Terminal 1: Start backend
cd backend
cp .env.example .env
npm install
npm run dev
# Admin UI: http://localhost:3000

# Terminal 2: Start frontend
cd frontend
cp .env.example .env
npm install
npm run dev
# Site: http://localhost:8080
```

On first run, KeystoneJS prompts you to create an admin user.

## Configuration

### Backend Environment (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | Yes | Random 32+ character string for session encryption |
| `DATABASE_URL` | No | SQLite path (default: `file:./keystone.db`) |
| `FRONTEND_BUILD_HOOK_URL` | No | Netlify/webhook URL to trigger frontend rebuild |
| `VAPID_PUBLIC_KEY` | No | Web Push public key (for notifications) |
| `VAPID_PRIVATE_KEY` | No | Web Push private key |
| `VAPID_SUBJECT` | No | Web Push contact email |

Generate VAPID keys:
```bash
npx web-push generate-vapid-keys
```

### Frontend Environment (`frontend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `API_URL` | Yes | Backend URL (e.g., `http://localhost:3000`) |

## Data Model

- **Dog** - name, sex, birthday, breed, coat, owner, photos, status
- **Owner** - name, email, phone, dogs
- **Media** - file, type (photo/video), dog, isFeatured, status
- **Settings** - moderationMode (a_posteriori/a_priori)

### Moderation Modes
- **A posteriori:** Auto-approve uploads, notify admin afterward
- **A priori:** Require admin approval before publishing

## Features

- **Magic Links:** Shareable edit URLs without password (via EditToken)
- **Push Notifications:** Web push alerts for admins on new uploads/changes
- **Image Compression:** Client-side compression before upload
- **Audit Log:** Full change history with attribution

## Production Deployment

### Backend (VPS)

1. Set up server structure:
```bash
sudo mkdir -p /srv/dogbook/{repo.git,backups,data/images}
sudo useradd -r -s /bin/bash dogbook
sudo chown -R dogbook:dogbook /srv/dogbook
```

2. Initialize git deployment:
```bash
sudo -u dogbook git init --bare /srv/dogbook/repo.git
sudo cp deploy/post-receive /srv/dogbook/repo.git/hooks/
sudo chmod +x /srv/dogbook/repo.git/hooks/post-receive
sudo cp deploy/deploy.sh /srv/dogbook/
sudo chmod +x /srv/dogbook/deploy.sh
```

3. Configure production environment:
```bash
sudo -u dogbook cp backend/.env.production.example /srv/dogbook/data/.env
sudo -u dogbook nano /srv/dogbook/data/.env  # Fill in values
```

4. Install systemd service:
```bash
sudo cp deploy/dogbook.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable dogbook
```

5. Configure Caddy (reverse proxy):
```
your-domain.com {
    reverse_proxy 127.0.0.1:3002
}
```

6. Deploy:
```bash
# On local machine
git remote add deploy user@server:/srv/dogbook/repo.git
git push deploy main
```

### Frontend (Netlify)

1. Connect repository to Netlify
2. Configure build:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `frontend/_site`
3. Set environment variable: `API_URL=https://your-backend-domain.com`
4. Create Build Hook and add URL to backend `.env` as `FRONTEND_BUILD_HOOK_URL`

## Maintenance

**View logs:**
```bash
sudo journalctl -u dogbook -f
```

**Backups:** Automated via systemd timer (see `deploy/dogbook-backup.service`)

**Updates:**
```bash
cd backend && npm update
cd frontend && npm update
```

## Security Notes

- Always set a strong `SESSION_SECRET` in production
- Configure HTTPS via Caddy/Let's Encrypt
- Review `AUDIT.md` for security recommendations

## License

MIT
