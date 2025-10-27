# Guide de démarrage rapide

## Démarrage en local (développement)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Le backend démarre sur http://localhost:3000

**Interface d'administration**: http://localhost:3000

### 2. Frontend

Dans un nouveau terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Le frontend démarre sur http://localhost:8080

## Créer votre premier chien

1. Ouvrez http://localhost:3000
2. Cliquez sur "Dogs" dans le menu
3. Cliquez sur "Create Dog"
4. Remplissez les informations:
   - Nom: Rex
   - Sexe: Mâle
   - Âge: 3
   - Race: Berger Allemand
   - Robe: Noir et feu
5. Uploadez une photo
6. Cliquez sur "Create Dog"

## Voir le résultat

1. Retournez sur http://localhost:8080
2. Rafraîchissez la page
3. Votre chien apparaît dans la liste!

## Accès à l'administration

Pour accéder à l'interface d'administration:

1. Visitez http://localhost:3000
2. Créez un premier utilisateur (vous serez invité à le faire au premier lancement)
3. Connectez-vous avec votre email et mot de passe

## Prochaines étapes

1. Ajoutez plus de chiens
2. Créez des propriétaires (Owners)
3. Associez les chiens à leurs propriétaires
4. Ajoutez des photos supplémentaires via Media
5. Testez la galerie photo sur le frontend

## Déploiement

Consultez le README.md pour les instructions complètes de déploiement sur Hetzner et Netlify.
