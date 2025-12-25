# Magic Edit Links - Concept Document

## Overview

Enable anonymous editing of dogs and owners via shareable "magic links" that set a secure cookie, while keeping the backend admin UI completely locked down.

**User Flow:**
1. Admin creates named edit token in backend: "Famille Dupont"
2. Admin shares magic URL: `https://maisonsdoggo.fr/?magic=abc123xyz`
3. User visits link → cookie set → editing UI appears
4. User can edit dogs, create dogs, edit owners
5. All changes logged with token name: "Modifié via 'Famille Dupont'"

**Key Principles:**
- Backend admin UI: authentication required
- Frontend: read-only by default, edit-enabled with valid token
- All copy/text in a single configuration file
- Full audit trail with token attribution

---

## Backend Changes

### 1. New Model: EditToken

```typescript
EditToken: list({
  access: {
    operation: {
      query: isAuthenticated,
      create: isAuthenticated,
      update: isAuthenticated,
      delete: isAuthenticated,
    },
  },
  ui: {
    label: 'Lien magique',
    plural: 'Liens magiques',
    listView: {
      initialColumns: ['label', 'token', 'isActive', 'lastUsedAt', 'expiresAt'],
      initialSort: { field: 'createdAt', direction: 'DESC' },
    },
  },
  fields: {
    label: text({
      validation: { isRequired: true },
      label: 'Nom',
      ui: {
        description: 'Nom pour identifier ce lien (ex: "Famille Dupont", "Voisins du parc")',
      },
    }),
    token: text({
      validation: { isRequired: true },
      isIndexed: 'unique',
      label: 'Token',
      defaultValue: () => {
        // Generate cryptographically secure token
        return crypto.randomBytes(24).toString('base64url');
      },
      ui: {
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
      },
    }),
    isActive: checkbox({
      defaultValue: true,
      label: 'Actif',
      ui: {
        description: 'Désactiver pour révoquer l\'accès sans supprimer le lien',
      },
    }),
    expiresAt: timestamp({
      label: 'Date d\'expiration',
      db: { isNullable: true },
      ui: {
        description: 'Laisser vide pour aucune expiration',
      },
    }),
    createdAt: timestamp({
      defaultValue: { kind: 'now' },
      label: 'Créé le',
      ui: {
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
      },
    }),
    lastUsedAt: timestamp({
      label: 'Dernière utilisation',
      db: { isNullable: true },
      ui: {
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
        description: 'Mis à jour automatiquement à chaque utilisation',
      },
    }),
    usageCount: integer({
      defaultValue: 0,
      label: 'Nombre d\'utilisations',
      ui: {
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
      },
    }),
  },
})
```

### 2. Access Control Helper

**File:** `backend/auth.ts` (new file)

```typescript
import crypto from 'crypto';

export const isAuthenticated = ({ session }: any) => !!session;

export const hasValidEditToken = async ({ context }: any) => {
  // Admins always have access
  if (context.session) return true;

  // Check for magic token in cookie
  const token = context.req?.cookies?.magicToken;
  if (!token) return false;

  // Validate token
  const editToken = await context.query.EditToken.findOne({
    where: { token },
    query: 'id label isActive expiresAt usageCount',
  });

  if (!editToken) return false;
  if (!editToken.isActive) return false;

  // Check expiration
  if (editToken.expiresAt) {
    const now = new Date();
    const expires = new Date(editToken.expiresAt);
    if (now > expires) return false;
  }

  // Update last used timestamp and increment usage count
  // Do this in background, don't block the request
  context.query.EditToken.updateOne({
    where: { id: editToken.id },
    data: {
      lastUsedAt: new Date().toISOString(),
      usageCount: editToken.usageCount + 1,
    },
  }).catch(err => console.error('Failed to update token usage:', err));

  // Store token info in context for change logging
  context.magicToken = {
    id: editToken.id,
    label: editToken.label,
  };

  return true;
};

export const getChangedBySource = (context: any): string => {
  if (context.session) return 'admin';
  if (context.magicToken) return 'magic';
  return 'public';
};

export const getChangedByLabel = (context: any): string | undefined => {
  if (context.session) return context.session.name;
  if (context.magicToken) return context.magicToken.label;
  return undefined;
};
```

### 3. Update Schema Access Control

**File:** `backend/schema.ts`

```typescript
import { hasValidEditToken, isAuthenticated } from './auth';

// Dog model
Dog: list({
  access: {
    operation: {
      query: () => true,              // Anyone can view approved dogs
      create: hasValidEditToken,      // Magic token or admin
      update: hasValidEditToken,      // Magic token or admin
      delete: isAuthenticated,        // Admin only
    },
  },
  // ... rest
}),

// Owner model
Owner: list({
  access: {
    operation: {
      query: () => true,
      create: hasValidEditToken,
      update: hasValidEditToken,
      delete: isAuthenticated,
    },
  },
  // ... rest
}),
```

### 4. Update Change Logging

**File:** `backend/change-logging.ts`

Modify `logChange` to include magic token label:

```typescript
export async function logChange(
  context: any,
  {
    entityType,
    entityId,
    entityName,
    operation,
    changes,
    changesSummary,
    dogId,
  }: {
    entityType: 'Dog' | 'Owner' | 'Media';
    entityId: string;
    entityName: string;
    operation: 'create' | 'update' | 'delete';
    changes: FieldChange[];
    changesSummary?: string;
    dogId?: string;
  }
) {
  // Determine who made the change
  const changedBy = getChangedBySource(context); // 'admin' | 'magic' | 'public'
  const changedByLabel = getChangedByLabel(context); // 'Admin Name' | 'Famille Dupont' | undefined

  // Enhance summary with attribution
  let fullSummary = changesSummary || generateSummary(changes);
  if (changedBy === 'magic' && changedByLabel) {
    fullSummary = `[${changedByLabel}] ${fullSummary}`;
  }

  // Get moderation mode for status
  const settings = await context.query.Settings.findOne({
    query: 'moderationMode',
  });
  const status = settings?.moderationMode === 'a_posteriori' ? 'accepted' : 'pending';

  // Generate URLs
  const { frontendUrl, backendUrl } = generateEntityUrls(entityType, entityId, dogId);

  // Create change log entry
  await context.query.ChangeLog.createOne({
    data: {
      timestamp: new Date().toISOString(),
      entityType,
      entityId,
      entityName,
      operation,
      changes: JSON.stringify(changes),
      changesSummary: fullSummary,
      changedBy,
      changedByLabel, // NEW FIELD
      status,
      frontendUrl,
      backendUrl,
    },
  });
}
```

### 5. Add Field to ChangeLog Model

**File:** `backend/schema.ts`

```typescript
ChangeLog: list({
  // ... existing config
  fields: {
    // ... existing fields
    changedBy: select({
      type: 'enum',
      options: [
        { label: '👤 Public', value: 'public' },
        { label: '🔐 Admin', value: 'admin' },
        { label: '✨ Lien magique', value: 'magic' },
      ],
      defaultValue: 'public',
      label: 'Modifié par',
    }),
    changedByLabel: text({
      label: 'Source',
      ui: {
        description: 'Nom de l\'admin ou du lien magique',
      },
    }),
    // ... rest of fields
  },
}),
```

### 6. Add Dog.status for Moderation

**File:** `backend/schema.ts`

```typescript
Dog: list({
  fields: {
    // ... existing fields
    status: select({
      type: 'enum',
      options: [
        { label: '⏳ En attente', value: 'pending' },
        { label: '✅ Approuvé', value: 'approved' },
      ],
      defaultValue: 'pending',
      label: 'Statut',
      access: {
        update: isAuthenticated, // Only admins can change status
      },
      ui: {
        displayMode: 'segmented-control',
      },
    }),
    // ... rest
  },
}),
```

### 7. Update dogHooks for Auto-Status

**File:** `backend/hooks.ts`

```typescript
export const dogHooks = {
  resolveInput: async ({ operation, resolvedData, context }: any) => {
    // Set status on create based on moderation mode
    if (operation === 'create') {
      const settings = await context.query.Settings.findOne({
        query: 'moderationMode',
      });

      const moderationMode = settings?.moderationMode || 'a_posteriori';
      resolvedData.status = moderationMode === 'a_posteriori' ? 'approved' : 'pending';
    }

    return resolvedData;
  },

  // ... existing afterOperation for change logging
};
```

### 8. Cookie Parser Setup

**File:** `backend/keystone.ts`

```typescript
import cookieParser from 'cookie-parser';

export default withAuth(config({
  // ...
  server: {
    cors: {
      origin: process.env.FRONTEND_URL || true,
      credentials: true, // Required for cookies
    },
    extendExpressApp: (app) => {
      // Parse cookies before any routes
      app.use(cookieParser());

      // ... rest (service worker, etc)
    },
  },
  ui: {
    isAccessAllowed: ({ session }) => !!session, // Lock down admin UI
  },
  // ...
}));
```

### 9. Database Migration

**File:** `backend/migrations/YYYYMMDDHHMMSS_add_magic_links/migration.sql`

```sql
-- Create EditToken table
CREATE TABLE "EditToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL DEFAULT '',
    "token" TEXT NOT NULL UNIQUE DEFAULT '',
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME,
    "usageCount" INTEGER NOT NULL DEFAULT 0
);

-- Add status to Dog
ALTER TABLE "Dog" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';

-- Add changedByLabel to ChangeLog
ALTER TABLE "ChangeLog" ADD COLUMN "changedByLabel" TEXT;

-- Update existing dogs to approved (backward compat)
UPDATE "Dog" SET "status" = 'approved';
```

---

## Frontend Changes

### 1. Copy/Text Configuration

**File:** `frontend/src/_data/content.json`

```json
{
  "site": {
    "title": "Trombinoscope Canin",
    "description": "L'annuaire des chiens du quartier"
  },
  "magic": {
    "activated": "Mode édition activé ✨",
    "deactivated": "Mode édition désactivé",
    "indicator": "Mode édition"
  },
  "dog": {
    "add": "Ajouter un chien",
    "edit": "Modifier",
    "delete": "Supprimer",
    "name": "Nom",
    "sex": "Sexe",
    "birthday": "Anniversaire",
    "breed": "Race",
    "coat": "Robe",
    "owner": "Humain",
    "photos": "Photos",
    "sex_male": "Mâle",
    "sex_female": "Femelle"
  },
  "owner": {
    "edit": "Modifier l'humain",
    "create": "Créer nouveau",
    "name": "Nom",
    "email": "Email",
    "phone": "Téléphone",
    "search_placeholder": "Rechercher ou créer un humain...",
    "create_new": "➕ Créer nouveau : {name}"
  },
  "form": {
    "save": "Enregistrer",
    "cancel": "Annuler",
    "saving": "Enregistrement...",
    "required": "Champ requis"
  },
  "messages": {
    "dog_created_aposteriori": "Chien créé ! Visible dans 2-3 minutes (temps de reconstruction du site).",
    "dog_created_apriori": "Chien créé ! Visible après validation par un administrateur.",
    "dog_updated": "Changements enregistrés ! Visibles dans 2-3 minutes.",
    "owner_updated": "Humain mis à jour !",
    "error_generic": "Une erreur est survenue. Veuillez réessayer.",
    "error_network": "Erreur de connexion. Vérifiez votre connexion internet."
  },
  "dialog": {
    "edit_dog_title": "Modifier {name}",
    "add_dog_title": "Ajouter un chien",
    "edit_owner_title": "Modifier {name}"
  }
}
```

**Access in templates:**

```njk
<!-- dogs.njk -->
<button class="edit-button">{{ content.dog.edit }}</button>
<h1>{{ content.dialog.edit_dog_title | replace("{name}", dog.name) }}</h1>
```

**Access in JavaScript:**

```javascript
// Load copy at build time or runtime
const content = await fetch('/_data/content.json').then(r => r.json());

// Or inject at build time via 11ty data
const content = window.APP_CONTENT; // Injected in base template
```

### 2. Magic Link Detection

**File:** `frontend/src/js/magic-auth.js`

```javascript
/**
 * Magic link authentication
 * Detects ?magic= parameter, sets cookie, enables edit mode
 */

const COOKIE_NAME = 'magicToken';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Initialize on page load
export function initMagicAuth(content) {
  const urlParams = new URLSearchParams(window.location.search);
  const magicToken = urlParams.get('magic');

  if (magicToken) {
    // Set secure cookie
    setMagicCookie(magicToken);

    // Clean URL (remove ?magic=)
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);

    // Show notification
    showNotification(content.magic.activated, 'success');

    // Enable edit mode immediately
    enableEditMode();
  } else if (hasMagicCookie()) {
    // Cookie already set from previous visit
    enableEditMode();
  }
}

function setMagicCookie(token) {
  document.cookie = `${COOKIE_NAME}=${token}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax; Secure`;
}

export function hasMagicCookie() {
  return document.cookie.includes(`${COOKIE_NAME}=`);
}

export function getMagicToken() {
  const match = document.cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

export function clearMagicCookie() {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
  location.reload();
}

function enableEditMode() {
  // Show all edit buttons
  document.querySelectorAll('.edit-button, .add-button').forEach(btn => {
    btn.style.display = '';
    btn.removeAttribute('hidden');
  });

  // Add visual indicator
  document.body.classList.add('magic-mode');

  // Optional: Show mode indicator in header
  showMagicIndicator();
}

function showMagicIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'magic-indicator';
  indicator.textContent = window.APP_CONTENT?.magic?.indicator || '✨ Mode édition';
  indicator.innerHTML = `
    <span>${window.APP_CONTENT?.magic?.indicator || '✨ Mode édition'}</span>
    <button onclick="confirmDeactivateMagic()" title="Désactiver">×</button>
  `;
  document.body.prepend(indicator);
}

function confirmDeactivateMagic() {
  if (confirm('Désactiver le mode édition ?')) {
    clearMagicCookie();
  }
}

function showNotification(message, type = 'info') {
  // Simple toast notification
  const toast = document.createElement('div');
  toast.className = `notification notification--${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('notification--visible'), 100);
  setTimeout(() => {
    toast.classList.remove('notification--visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
```

### 3. GraphQL Mutations

**File:** `frontend/src/js/api.js`

```javascript
const API_URL = 'http://localhost:3000'; // From env or config

/**
 * Make GraphQL request with credentials (cookies)
 */
async function graphql(query, variables = {}) {
  const response = await fetch(`${API_URL}/api/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apollo-require-preflight': 'true',
    },
    credentials: 'include', // Important: sends cookies
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json();

  if (result.errors) {
    console.error('GraphQL errors:', result.errors);
    throw new Error(result.errors[0].message);
  }

  return result.data;
}

/**
 * Update dog
 */
export async function updateDog(id, data) {
  const query = `
    mutation UpdateDog($id: ID!, $data: DogUpdateInput!) {
      updateDog(where: { id: $id }, data: $data) {
        id
        name
        sex
        birthday
        breed
        coat
        owner { id name }
      }
    }
  `;

  return graphql(query, { id, data });
}

/**
 * Create dog
 */
export async function createDog(data) {
  const query = `
    mutation CreateDog($data: DogCreateInput!) {
      createDog(data: $data) {
        id
        name
        status
      }
    }
  `;

  return graphql(query, { data });
}

/**
 * Search owners by name
 */
export async function searchOwners(searchTerm) {
  const query = `
    query SearchOwners($search: String!) {
      owners(
        where: {
          OR: [
            { name: { contains: $search, mode: insensitive } }
            { email: { contains: $search, mode: insensitive } }
          ]
        }
        take: 10
      ) {
        id
        name
        email
        dogs { id }
      }
    }
  `;

  return graphql(query, { search: searchTerm });
}

/**
 * Create owner
 */
export async function createOwner(data) {
  const query = `
    mutation CreateOwner($data: OwnerCreateInput!) {
      createOwner(data: $data) {
        id
        name
      }
    }
  `;

  return graphql(query, { data });
}

/**
 * Update owner
 */
export async function updateOwner(id, data) {
  const query = `
    mutation UpdateOwner($id: ID!, $data: OwnerUpdateInput!) {
      updateOwner(where: { id: $id }, data: $data) {
        id
        name
        email
        phone
      }
    }
  `;

  return graphql(query, { id, data });
}

/**
 * Get moderation mode
 */
export async function getModerationMode() {
  const query = `
    query GetSettings {
      settings {
        moderationMode
      }
    }
  `;

  const data = await graphql(query);
  return data.settings?.moderationMode || 'a_posteriori';
}
```

### 4. Edit Dog Modal

**File:** `frontend/src/js/edit-dog.js`

```javascript
import { updateDog, createDog, getModerationMode } from './api.js';
import { OwnerAutocomplete } from './owner-autocomplete.js';

export class EditDogModal {
  constructor(content, dog = null) {
    this.copy = copy;
    this.dog = dog; // null for create, object for edit
    this.dialog = this.createDialog();
    this.ownerAutocomplete = null;
  }

  createDialog() {
    const isEdit = !!this.dog;
    const title = isEdit
      ? this.content.dialog.edit_dog_title.replace('{name}', this.dog.name)
      : this.content.dialog.add_dog_title;

    const dialog = document.createElement('dialog');
    dialog.className = 'edit-dialog';
    dialog.innerHTML = `
      <form method="dialog" class="edit-form">
        <header class="edit-form__header">
          <h2>${title}</h2>
          <button type="button" class="close-button" aria-label="${this.content.form.cancel}">×</button>
        </header>

        <div class="edit-form__body">
          <label>
            <span>${this.content.dog.name} *</span>
            <input type="text" name="name" required value="${this.dog?.name || ''}">
          </label>

          <label>
            <span>${this.content.dog.sex}</span>
            <select name="sex">
              <option value="">-</option>
              <option value="male" ${this.dog?.sex === 'male' ? 'selected' : ''}>
                ${this.content.dog.sex_male}
              </option>
              <option value="female" ${this.dog?.sex === 'female' ? 'selected' : ''}>
                ${this.content.dog.sex_female}
              </option>
            </select>
          </label>

          <label>
            <span>${this.content.dog.birthday}</span>
            <input type="date" name="birthday" value="${this.dog?.birthday || ''}">
          </label>

          <label>
            <span>${this.content.dog.breed}</span>
            <input type="text" name="breed" value="${this.dog?.breed || ''}">
          </label>

          <label>
            <span>${this.content.dog.coat}</span>
            <input type="text" name="coat" value="${this.dog?.coat || ''}">
          </label>

          <label>
            <span>${this.content.dog.owner} *</span>
            <div id="owner-autocomplete"></div>
          </label>
        </div>

        <footer class="edit-form__footer">
          <button type="button" class="button button--secondary cancel-button">
            ${this.content.form.cancel}
          </button>
          <button type="submit" class="button button--primary">
            ${this.content.form.save}
          </button>
        </footer>
      </form>
    `;

    // Setup owner autocomplete
    const autocompleteContainer = dialog.querySelector('#owner-autocomplete');
    this.ownerAutocomplete = new OwnerAutocomplete(
      autocompleteContainer,
      this.copy,
      this.dog?.owner
    );

    // Event listeners
    dialog.querySelector('.close-button').addEventListener('click', () => dialog.close());
    dialog.querySelector('.cancel-button').addEventListener('click', () => dialog.close());
    dialog.querySelector('form').addEventListener('submit', (e) => this.handleSubmit(e));

    return dialog;
  }

  async handleSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = this.content.form.saving;

    try {
      // Get owner from autocomplete (ID or new owner data)
      const ownerData = this.ownerAutocomplete.getValue();

      // Prepare dog data
      const dogData = {
        name: formData.get('name'),
        sex: formData.get('sex') || null,
        birthday: formData.get('birthday') || null,
        breed: formData.get('breed') || '',
        coat: formData.get('coat') || '',
      };

      // Handle owner
      if (ownerData.isNew) {
        // Create new owner inline
        dogData.owner = {
          create: {
            name: ownerData.name,
            email: '',
            phone: '',
          },
        };
      } else {
        // Connect to existing owner
        dogData.owner = {
          connect: { id: ownerData.id },
        };
      }

      if (this.dog) {
        // Update existing dog
        await updateDog(this.dog.id, dogData);
        showSuccess(this.content.messages.dog_updated);
      } else {
        // Create new dog
        const result = await createDog(dogData);

        // Show appropriate message based on moderation
        const moderationMode = await getModerationMode();
        const message = moderationMode === 'a_posteriori'
          ? this.content.messages.dog_created_aposteriori
          : this.content.messages.dog_created_apriori;
        showSuccess(message);
      }

      this.dialog.close();

      // Trigger rebuild (optional, backend might do this automatically)
      await fetch(`${API_URL}/api/trigger-build`, { method: 'POST' });

    } catch (error) {
      console.error('Error saving dog:', error);
      showError(this.content.messages.error_generic);
      submitButton.disabled = false;
      submitButton.textContent = this.content.form.save;
    }
  }

  show() {
    document.body.appendChild(this.dialog);
    this.dialog.showModal();
  }
}

function showSuccess(message) {
  // Reuse notification system from magic-auth.js
  showNotification(message, 'success');
}

function showError(message) {
  showNotification(message, 'error');
}
```

### 5. Owner Autocomplete Component

**File:** `frontend/src/js/owner-autocomplete.js`

```javascript
import { searchOwners, createOwner } from './api.js';

export class OwnerAutocomplete {
  constructor(container, content, initialOwner = null) {
    this.container = container;
    this.copy = copy;
    this.selectedOwner = initialOwner;
    this.results = [];
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <input
        type="text"
        class="owner-search"
        placeholder="${this.content.owner.search_placeholder}"
        value="${this.selectedOwner?.name || ''}"
        autocomplete="off"
      >
      <div class="owner-results" hidden></div>
    `;

    const input = this.container.querySelector('.owner-search');
    const resultsDiv = this.container.querySelector('.owner-results');

    // Debounced search
    let timeout;
    input.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => this.search(e.target.value, resultsDiv), 300);
    });

    // Clear selection on edit
    input.addEventListener('focus', () => {
      this.selectedOwner = null;
    });
  }

  async search(term, resultsDiv) {
    if (term.length < 2) {
      resultsDiv.hidden = true;
      return;
    }

    try {
      const data = await searchOwners(term);
      this.results = data.owners || [];
      this.renderResults(term, resultsDiv);
    } catch (error) {
      console.error('Search error:', error);
    }
  }

  renderResults(searchTerm, resultsDiv) {
    resultsDiv.innerHTML = '';

    // Show existing owners
    this.results.forEach(owner => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'owner-result';
      item.innerHTML = `
        <strong>${owner.name}</strong>
        <small>${owner.dogs.length} chien(s)</small>
      `;
      item.addEventListener('click', () => this.selectOwner(owner, resultsDiv));
      resultsDiv.appendChild(item);
    });

    // Option to create new
    const createNew = document.createElement('button');
    createNew.type = 'button';
    createNew.className = 'owner-result owner-result--create';
    createNew.textContent = this.content.owner.create_new.replace('{name}', searchTerm);
    createNew.addEventListener('click', () => this.selectNewOwner(searchTerm, resultsDiv));
    resultsDiv.appendChild(createNew);

    resultsDiv.hidden = false;
  }

  selectOwner(owner, resultsDiv) {
    this.selectedOwner = owner;
    this.container.querySelector('.owner-search').value = owner.name;
    resultsDiv.hidden = true;
  }

  selectNewOwner(name, resultsDiv) {
    this.selectedOwner = { name, isNew: true };
    this.container.querySelector('.owner-search').value = name;
    resultsDiv.hidden = true;
  }

  getValue() {
    if (!this.selectedOwner) {
      // Fallback: treat as new owner
      const name = this.container.querySelector('.owner-search').value;
      return { name, isNew: true };
    }
    return this.selectedOwner;
  }
}
```

### 6. Template Updates

**File:** `frontend/src/dogs.njk`

```njk
---
pagination:
  data: dogs
  size: 1
  alias: dog
permalink: "/chiens/{{ dog.id }}/"
---

{% extends "_layouts/base.njk" %}

{% block content %}
<article class="dog-detail">
  <header class="dog-header">
    <h1>{{ dog.name }}</h1>

    {# Edit button - hidden by default, shown when magic cookie present #}
    <button class="edit-button" hidden data-dog-id="{{ dog.id }}">
      {{ content.dog.edit }}
    </button>
  </header>

  {# ... rest of dog detail page #}

  <aside class="dog-owner">
    <h3>{{ content.dog.owner }}</h3>
    <p>
      {{ dog.owner.name }}
      <button class="edit-owner-button" hidden data-owner-id="{{ dog.owner.id }}">
        ✏️
      </button>
    </p>
  </aside>
</article>

<script type="module">
  import { initMagicAuth, hasMagicCookie } from '/js/magic-auth.js';
  import { EditDogModal } from '/js/edit-dog.js';

  const content = {{ copy | dump | safe }};

  // Initialize magic auth
  initMagicAuth(content);

  // Setup edit button
  if (hasMagicCookie()) {
    const editButton = document.querySelector('.edit-button');
    editButton.addEventListener('click', () => {
      const dogData = {{ dog | dump | safe }};
      const modal = new EditDogModal(content, dogData);
      modal.show();
    });
  }
</script>
{% endblock %}
```

**File:** `frontend/src/index.njk`

```njk
---
pagination:
  data: dogs
  size: 100
permalink: "/"
---

{% extends "_layouts/base.njk" %}

{% block content %}
<header class="page-header">
  <h1>{{ content.site.title }}</h1>

  {# Add dog button - hidden by default #}
  <button class="add-button" hidden id="add-dog-button">
    {{ content.dog.add }}
  </button>
</header>

{# ... dog grid #}

<script type="module">
  import { initMagicAuth, hasMagicCookie } from '/js/magic-auth.js';
  import { EditDogModal } from '/js/edit-dog.js';

  const content = {{ copy | dump | safe }};

  initMagicAuth(content);

  if (hasMagicCookie()) {
    document.getElementById('add-dog-button').addEventListener('click', () => {
      const modal = new EditDogModal(content); // null = create mode
      modal.show();
    });
  }
</script>
{% endblock %}
```

### 7. Styling

**File:** `frontend/src/css/components/magic-mode.css`

```css
/* Magic mode indicator */
.magic-indicator {
  position: fixed;
  top: 1rem;
  right: 1rem;
  background: var(--color-magic, #9333ea);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 2rem;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.magic-indicator button {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.25rem;
  line-height: 1;
}

/* Edit buttons */
.edit-button,
.add-button {
  /* Styles for edit/add buttons */
  padding: 0.5rem 1rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
}

.edit-button:hover,
.add-button:hover {
  background: var(--color-primary-dark);
}

/* Edit dialog */
.edit-dialog {
  border: none;
  border-radius: 0.5rem;
  padding: 0;
  max-width: 32rem;
  width: 90vw;
}

.edit-dialog::backdrop {
  background: rgba(0, 0, 0, 0.5);
}

.edit-form__header {
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.edit-form__body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.edit-form__footer {
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

/* Owner autocomplete */
.owner-results {
  position: absolute;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.25rem;
  margin-top: 0.25rem;
  max-height: 12rem;
  overflow-y: auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.owner-result {
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  background: white;
  text-align: left;
  cursor: pointer;
}

.owner-result:hover {
  background: #f3f4f6;
}

.owner-result--create {
  border-top: 1px solid #e5e7eb;
  color: var(--color-primary);
  font-weight: 500;
}
```

---

## Implementation Phases

### Phase 1: Backend Foundation
- [ ] Create `EditToken` model
- [ ] Add `auth.ts` with `hasValidEditToken` helper
- [ ] Add cookie parser to keystone.ts
- [ ] Update Dog/Owner access control
- [ ] Add `status` field to Dog model
- [ ] Update dogHooks for auto-status
- [ ] Database migration
- [ ] Test token validation manually

### Phase 2: Change Logging Enhancement
- [ ] Add `changedByLabel` field to ChangeLog
- [ ] Update `logChange()` to capture magic token name
- [ ] Test that magic edits appear with label in changelog

### Phase 3: Frontend Copy System
- [ ] Create `content.json` with all text strings
- [ ] Configure 11ty to load as global data
- [ ] Update all templates to use `{{ content.* }}`
- [ ] Test that all text renders correctly

### Phase 4: Frontend Magic Auth
- [ ] Create `magic-auth.js` for cookie detection
- [ ] Add magic indicator UI
- [ ] Test: visit `/?magic=test123` sets cookie and shows UI

### Phase 5: Frontend Edit UI
- [ ] Create `api.js` with GraphQL mutations
- [ ] Create `owner-autocomplete.js` component
- [ ] Create `edit-dog.js` modal
- [ ] Add edit buttons to templates (hidden by default)
- [ ] Wire up event listeners
- [ ] Add CSS for dialogs and magic mode

### Phase 6: Testing & Refinement
- [ ] Create test edit token in admin
- [ ] Test full flow: magic link → edit dog → see in changelog
- [ ] Test create dog → moderation modes
- [ ] Test owner autocomplete and creation
- [ ] Test error handling
- [ ] Mobile responsive testing

### Phase 7: Documentation
- [ ] Update README with magic link instructions
- [ ] Admin guide: how to create/revoke tokens
- [ ] User guide: what can be edited

---

## Security Considerations

### Risks
1. **Token leakage**: URL in browser history, shared screenshots
2. **Token theft**: Cookie could be stolen via XSS
3. **Abuse**: Malicious edits if token is compromised

### Mitigations
1. **URL cleaning**: Immediately remove `?magic=` from URL after setting cookie
2. **Secure cookie**: `SameSite=Lax; Secure` (HTTPS only)
3. **Revocation**: Admin can instantly disable token
4. **Audit trail**: All edits logged with token name
5. **Moderation**: A priori mode requires admin approval
6. **Expiration**: Optional time-based expiration
7. **Static site**: Low XSS risk (no user-generated HTML rendering)

### Best Practices
- Share magic links via secure channels (Signal, encrypted email)
- Use descriptive token labels to identify leaks
- Regularly review active tokens
- Set expiration for temporary access
- Monitor ChangeLog for suspicious activity

---

## Future Enhancements

### Token Management
- [ ] Token permissions (edit-only vs edit+create)
- [ ] Usage analytics (who edited what)
- [ ] IP restrictions (optional)
- [ ] Multiple tokens per family/group

### UI/UX
- [ ] Inline editing (click to edit, no modal)
- [ ] Optimistic updates (show changes immediately)
- [ ] Undo recent changes
- [ ] Bulk editing

### Advanced Features
- [ ] Photo upload from magic links
- [ ] Comment/notes on changes
- [ ] Email notifications to token owner
- [ ] Token usage dashboard

---

## Questions to Resolve

1. **Cookie domain**: Should cookie work on subdomain? (e.g., www.example.com and example.com)
2. **Token length**: 24 bytes (32 chars base64url) sufficient? Or longer?
3. **Default expiration**: Should we enforce expiration or allow permanent tokens?
4. **Rate limiting**: Do we need it, or trust moderation + audit log?
5. **Frontend rebuild**: Auto-trigger on every edit, or manual admin trigger?
6. **Copy management**: JSON file or database? (JSON = easy edit, DB = multi-language ready)

---

## Success Metrics

- Admin can create magic link in < 30 seconds
- User can edit dog details in < 1 minute
- All edits appear in ChangeLog with token attribution
- Zero unauthorized access to backend admin
- Copy changes don't require code deploys
