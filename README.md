# Trombinoscope Canin

Un trombinoscope (annuaire photo) de chiens construit avec une architecture JAMstack.

## Architecture

### Backend
- **KeystoneJS 6** - CMS headless avec interface d'administration
- **SQLite** - Base de données légère
- Hébergement sur serveur Hetzner

### Frontend
- **11ty (Eleventy)** - Générateur de sites statiques
- **Vanilla JavaScript** - Sans framework
- **CSS sémantique avec BEM** - Pas de Tailwind
- Régénération automatique via webhook

## Modèle de données

### Dog (Chien)
- `name`, `sex`, `birthday`, `breed`, `coat`
- `owner` → Owner (requis, admin-only update)
- `photos` → Media[] (relation many)

### Owner (Humain)
- `name`, `email`, `phone`
- `dogs` → Dog[]

### Media
- `file` (image), `type` (photo/video), `videoUrl`
- `dog` → Dog
- `isFeatured` (checkbox) - Une seule par chien (hook auto-exclusif)
- `status`: pending/approved/rejected (modération)
- `uploadedAt` (timestamp)

### Settings (singleton)
- `moderationMode`: a_posteriori / a_priori
  - **A posteriori**: Auto-approuve, notifie admin
  - **A priori**: Requiert validation avant publication

### PushSubscription
- Abonnements Web Push (notifications iOS/Safari)
- `endpoint`, `keys`, `receivesAdminNotifications`

### ChangeLog
- Journal d'audit: Dogs, Owners, Media
- `entityType`, `operation` (create/update/delete), `changes` (JSON)
- `frontendUrl`, `backendUrl` (liens auto-générés)
- `status`: pending/accepted/reverted

## Installation

### Prérequis
- Node.js 18+ et npm
- Git

### Backend

```bash
cd backend
npm install
cp .env.example .env
nano .env  # Modifier SESSION_SECRET et autres valeurs
npm run dev
```

Le backend sera accessible sur http://localhost:3000

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
nano .env  # Modifier API_URL
npm run dev
```

Le frontend sera accessible sur http://localhost:8080

## Configuration

### Déclenchement automatique des builds

Configurez un webhook pour régénérer le frontend automatiquement:

1. Si vous utilisez Netlify, créez un Build Hook dans les paramètres du site
2. Ajoutez l'URL du webhook dans `backend/.env`:
   ```
   FRONTEND_BUILD_HOOK_URL=https://api.netlify.com/build_hooks/xxxxx
   ```
3. Le frontend sera régénéré automatiquement à chaque modification de contenu

Si vous auto-hébergez le frontend:
```bash
cd frontend && npm run build
```

## Déploiement

### Backend sur Hetzner (niche.maisonsdoggo.fr)

Le déploiement utilise un workflow git push similaire à Capistrano.

#### Configuration initiale du serveur

Sur le serveur Hetzner (une seule fois):

```bash
# Créer la structure de répertoires
sudo mkdir -p /srv/dogbook/{repo.git,backups,data/images}
sudo chown -R caddy:caddy /srv/dogbook

# Initialiser le dépôt git bare
sudo -u caddy git init --bare /srv/dogbook/repo.git

# Copier le hook post-receive
sudo -u caddy cp deploy/post-receive /srv/dogbook/repo.git/hooks/
sudo chmod +x /srv/dogbook/repo.git/hooks/post-receive

# Installer le service systemd
sudo cp deploy/dogbook.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable dogbook

# Installer le système de backup
sudo cp deploy/dogbook-backup.{service,timer} /etc/systemd/system/
sudo systemctl enable dogbook-backup.timer
sudo systemctl start dogbook-backup.timer

# Configurer l'environnement de production
sudo -u caddy nano /srv/dogbook/data/.env
# Copiez le contenu de backend/.env.production.example et remplissez les valeurs
```

Ajoutez à `/etc/caddy/Caddyfile`:

```
niche.maisonsdoggo.fr {
    reverse_proxy 127.0.0.1:3002
    log {
        output file /srv/dogbook/access.log {
            roll_size 20mb
            roll_keep 10
        }
    }
}
```

Rechargez Caddy:
```bash
sudo systemctl reload caddy
```

#### Déploiement initial

Sur votre machine locale:

```bash
# Ajoutez le remote de déploiement
git remote add deploy ljt.cc:/srv/dogbook/repo.git

# Premier déploiement
git push deploy main

# Sur le serveur, créez le symlink .env
ssh ljt.cc "sudo -u caddy ln -s /srv/dogbook/data/.env /srv/dogbook/current/backend/.env"

# Démarrez le service
ssh ljt.cc "sudo systemctl start dogbook"
```

#### Déploiements futurs

Simplement:
```bash
git push deploy main
```

Le hook post-receive s'occupe automatiquement de:
- Checkout du code
- Installation des dépendances
- Build du backend
- Redémarrage du service

#### Vérification du déploiement

```bash
# Vérifier le statut du service
ssh ljt.cc "sudo systemctl status dogbook"

# Voir les logs
ssh ljt.cc "sudo journalctl -u dogbook -f"

# Vérifier les backups
ssh ljt.cc "ls -lh /srv/dogbook/backups/"
```

### Frontend sur Netlify

1. Créez un nouveau site sur Netlify
2. Connectez votre repository GitHub
3. Configurez le build:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/_site`
4. Ajoutez les variables d'environnement:
   - `API_URL`: URL de votre backend (ex: `https://api.yourdomain.com`)
5. Créez un Build Hook et ajoutez-le dans `backend/.env`

### Frontend sur Hetzner

```bash
# Build le frontend
cd frontend
npm install
npm run build

# Déployez dans nginx
sudo cp -r _site/* /var/www/dogbook/
```

Configuration nginx:

```nginx
server {
    listen 80;
    server_name dogbook.yourdomain.com;
    root /var/www/dogbook;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # Cache des assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Développement

### Structure du projet

```
dogbook/
├── backend/             # KeystoneJS: schema.ts, hooks.ts, auth.ts
├── frontend/src/        # 11ty: templates .njk, css/ (BEM), js/ (vanilla)
└── deploy/              # Scripts de déploiement Hetzner
```

### Méthodologie CSS

BEM (Block Element Modifier): `.dog-card`, `.dog-card__image`, `.dog-card--featured`

## API GraphQL

Backend expose une API GraphQL sur `/api/graphql`. Consultez le schéma dans l'interface GraphQL Playground.

## Sécurité

- Changez `SESSION_SECRET` en production (utilisez une chaîne aléatoire longue)
- Configurez HTTPS avec Let's Encrypt
- Limitez les uploads de fichiers (configuré dans Caddy)
- L'interface d'administration nécessite une authentification par email/mot de passe

## Maintenance

Backups automatiques via systemd timer (voir `deploy/dogbook-backup.service`).

Mises à jour: `cd backend && npm update` / `cd frontend && npm update`

## Fonctionnalités clés

### Upload mobile
- Compression client-side (50-70% réduction)
- Accès caméra et galerie
- Barre de progression temps réel

### Modération
- A posteriori (auto-approve) ou a priori (validation requise)
- Web push notifications (iOS/Safari compatible)
- Journal de changements avec audit trail

### Architecture
- Photo principale: hook auto-exclusif (une seule par chien)
- GraphQL multipart upload avec CSRF protection
- Régénération automatique du site static via webhook

## Support

Logs: `sudo journalctl -u dogbook -f`
Docs: [KeystoneJS](https://keystonejs.com) | [11ty](https://www.11ty.dev)

## Licence

MIT
