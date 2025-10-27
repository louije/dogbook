# Trombinoscope Canin

Un trombinoscope (annuaire photo) de chiens construit avec une architecture JAMstack.

## Architecture

### Backend
- **KeystoneJS 6** - CMS headless avec interface d'administration
- **SQLite** - Base de données légère
- Hébergement sur serveur Hetzner
- Accès anonyme via URL secrète

### Frontend
- **11ty (Eleventy)** - Générateur de sites statiques
- **Vanilla JavaScript** - Sans framework
- **CSS sémantique avec BEM** - Pas de Tailwind
- Déploiement sur Hetzner ou Netlify
- Régénération automatique à chaque modification du backend

## Modèle de données

### Dog (Chien)
- `nom` - Nom du chien
- `sexe` - Mâle ou Femelle
- `age` - Âge en années
- `race` - Race du chien
- `robe` - Couleur/type de pelage
- `maitre` - Relation vers le propriétaire
- `photoFeatured` - Photo principale
- `photos` - Galerie de photos et vidéos
- `description` - Description en texte riche

### Owner (Maître)
- `nom` - Nom du propriétaire
- `email` - Email (optionnel)
- `telephone` - Numéro de téléphone (optionnel)
- `dogs` - Relation vers les chiens

### Media
- `nom` - Nom du média
- `file` - Fichier image
- `type` - Photo ou Vidéo
- `videoUrl` - URL de la vidéo (si type = vidéo)
- `dog` - Relation vers le chien
- `isFeatured` - Marquer comme photo principale

## Installation

### Prérequis
- Node.js 18+ et npm
- Git

### Backend

```bash
cd backend

# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp .env.example .env

# Modifier .env avec vos valeurs
nano .env

# Lancer le serveur de développement
npm run dev
```

Le backend sera accessible sur http://localhost:3000

**Important**: Modifiez `SESSION_SECRET` dans le fichier `.env` avant de déployer en production.

### Frontend

```bash
cd frontend

# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp .env.example .env

# Modifier .env avec l'URL de votre API
nano .env

# Lancer le serveur de développement
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
# Créez un script de build manuel
./build-frontend.sh
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
├── backend/              # Backend KeystoneJS
│   ├── keystone.ts      # Configuration Keystone
│   ├── schema.ts        # Modèles de données
│   ├── auth.ts          # Middleware d'authentification
│   ├── hooks.ts         # Hooks pour build webhook
│   ├── package.json
│   └── .env.example
├── frontend/            # Frontend 11ty
│   ├── src/
│   │   ├── _layouts/    # Templates de base
│   │   ├── css/         # Styles CSS (BEM)
│   │   ├── js/          # JavaScript vanilla
│   │   ├── images/      # Images statiques
│   │   ├── index.njk    # Page d'accueil
│   │   ├── chiens.njk   # Pages de détail des chiens
│   │   └── maitres.njk  # Pages des maîtres
│   ├── .eleventy.js     # Configuration 11ty
│   ├── package.json
│   └── .env.example
└── build-frontend.sh    # Script de build manuel
```

### Méthodologie CSS

Le projet utilise la méthodologie BEM (Block Element Modifier):

```css
/* Block */
.dog-card { }

/* Element */
.dog-card__image { }
.dog-card__name { }

/* Modifier */
.dog-card--featured { }
```

Variables CSS dans `frontend/src/css/main.css`:
- Couleurs sémantiques
- Espacements cohérents
- Typographie
- Breakpoints responsive

## API GraphQL

Le backend expose une API GraphQL sur `/api/graphql`.

Exemple de requête:

```graphql
query {
  dogs {
    id
    nom
    sexe
    age
    race
    robe
    photoFeatured {
      url
    }
    maitre {
      nom
      email
    }
    photos {
      file {
        url
      }
      type
      videoUrl
    }
  }
}
```

## Sécurité

- Changez `SESSION_SECRET` en production (utilisez une chaîne aléatoire longue)
- Configurez HTTPS avec Let's Encrypt
- Limitez les uploads de fichiers (configuré dans Caddy)
- L'interface d'administration nécessite une authentification par email/mot de passe

## Maintenance

### Sauvegardes

Sauvegardez régulièrement:
- `backend/keystone.db` - Base de données
- `backend/public/images/` - Images uploadées

```bash
# Script de backup
tar -czf backup-$(date +%Y%m%d).tar.gz backend/keystone.db backend/public/images/
```

### Mises à jour

```bash
# Backend
cd backend
npm update

# Frontend
cd frontend
npm update
```

## Fonctionnalités

- ✅ Liste de tous les chiens avec photos
- ✅ Pages détaillées pour chaque chien
- ✅ Galerie photos avec lightbox
- ✅ Support vidéos (liens YouTube, Vimeo, etc.)
- ✅ Gestion des propriétaires
- ✅ Recherche et filtres (à venir)
- ✅ Responsive design
- ✅ Génération statique pour performances optimales
- ✅ Régénération automatique du site

## Support

Pour toute question ou problème:
1. Vérifiez les logs: `pm2 logs dogbook-backend`
2. Consultez la documentation KeystoneJS: https://keystonejs.com
3. Consultez la documentation 11ty: https://www.11ty.dev

## Licence

MIT
