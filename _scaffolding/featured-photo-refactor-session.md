# Featured Photo Refactor - Implementation Session

**Date:** November 15, 2025
**Branch:** `main` (merged from `claude/mobile-photo-upload-011CUUeHdfgxC3fhfC8355jr`)
**Status:** ✅ Complete & Deployed

---

## 🎯 What We Did

### Problem Identified
The featured photo system had a fundamental design flaw:
- `Dog.photoFeatured` was an **image field** (separate from Media)
- `Media.isFeatured` was a **boolean flag** but didn't actually control what was featured
- Clicking the star button on Media items set `isFeatured: true` but didn't affect `Dog.photoFeatured`
- Result: **Two separate systems for the same concept, not connected**

### Solution Implemented

**Removed `Dog.photoFeatured` field entirely.** Now there's only:
- `Dog.photos` - relationship to Media (many)
- `Media.isFeatured` - boolean flag (exactly one per dog)

**Single source of truth:** The featured photo is simply `dog.photos.find(p => p.isFeatured)`

---

## 🔧 Technical Changes

### Backend (`/backend/`)

#### 1. Schema Changes (`schema.ts`)
```typescript
// REMOVED
photoFeatured: image({
  storage: 'local_images',
  label: 'Photo principale',
  validation: { isRequired: true },
})

// KEPT (with updated description)
photos: relationship({
  ref: 'Media.dog',
  many: true,
  label: 'Photos',
  ui: {
    description: 'Utilisez le bouton ⭐ pour définir la photo principale',
  },
})
```

#### 2. Auto-Unfeaturing Hook (`hooks.ts`)
When setting `Media.isFeatured = true`, automatically unset it on all other photos for that dog:

```typescript
if (operation === 'update' && resolvedData.isFeatured === true) {
  const currentMedia = await context.query.Media.findOne({
    where: { id: item.id },
    query: 'dog { id }',
  });

  if (currentMedia?.dog?.id) {
    const otherFeaturedPhotos = await context.query.Media.findMany({
      where: {
        dog: { id: { equals: currentMedia.dog.id } },
        id: { not: { equals: item.id } },
        isFeatured: { equals: true },
      },
      query: 'id',
    });

    await Promise.all(
      otherFeaturedPhotos.map(photo =>
        context.query.Media.updateOne({
          where: { id: photo.id },
          data: { isFeatured: false },
        })
      )
    );
  }
}
```

**Pattern:** "Unset All, Set One" - ensures only one featured photo per dog

#### 3. Moderation Mode Fix (`hooks.ts`)
Fixed bug where photos always defaulted to "pending" status:

```typescript
// BEFORE (broken)
if (!resolvedData.status) { ... }  // Never true because defaultValue: 'pending'

// AFTER (working)
if (operation === 'create') {
  const settings = await context.query.Settings.findOne({
    query: 'moderationMode',
  });

  const moderationMode = settings?.moderationMode || 'a_posteriori';

  if (moderationMode === 'a_posteriori') {
    resolvedData.status = 'approved';  // Auto-approve
  } else {
    resolvedData.status = 'pending';    // Require approval
  }
}
```

#### 4. Production Database Setup
Created missing tables manually on production:

```sql
-- Settings table (singleton)
CREATE TABLE Settings (
  id INTEGER NOT NULL PRIMARY KEY,
  moderationMode TEXT DEFAULT 'a_posteriori'
);
INSERT INTO Settings (id, moderationMode) VALUES (1, 'a_posteriori');

-- PushSubscription table
CREATE TABLE PushSubscription (
  id TEXT NOT NULL PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE DEFAULT '',
  keys TEXT NOT NULL DEFAULT '',
  createdAt DATETIME
);

-- Add missing columns to Media
ALTER TABLE Media ADD COLUMN status TEXT DEFAULT 'pending';
ALTER TABLE Media ADD COLUMN uploadedAt DATETIME;
```

### Frontend (`/frontend/`)

#### 1. GraphQL Query Update (`.eleventy.js`)
```graphql
# REMOVED
photoFeatured {
  url
  width
  height
}

# Now uses only:
photos(where: { status: { equals: approved } }) {
  id
  isFeatured
  file { url }
}
```

#### 2. Featured Photo Filter (`.eleventy.js`)
```javascript
eleventyConfig.addFilter('getFeaturedPhoto', function(dog) {
  const API_URL = process.env.API_URL || 'http://localhost:3000';

  if (!dog.photos || dog.photos.length === 0) {
    return '/images/placeholder-dog.jpg';
  }

  // Try featured
  const featured = dog.photos.find(p => p.isFeatured);
  if (featured?.file?.url) {
    return API_URL + featured.file.url;
  }

  // Fallback to first photo
  if (dog.photos[0]?.file?.url) {
    return API_URL + dog.photos[0].file.url;
  }

  // Placeholder
  return '/images/placeholder-dog.jpg';
});
```

**Graceful degradation:** Featured → First photo → Placeholder

#### 3. Gallery Display (`dogs.njk`)
**Filter out featured photo from gallery:**
```nunjucks
{% for photo in dog.photos %}
  {% if photo.type === 'photo' and photo.file and not photo.isFeatured %}
  <button class="dog-gallery__item" ...>
    <img src="{{ photo.file.url | imageUrl }}" ...>
  </button>
  {% endif %}
{% endfor %}
```

**Avoids duplication** - featured photo only shows as main image

#### 4. Featured Photo Selection - Lightbox Integration
**Moved from prominent gallery buttons to discreet lightbox button:**

```javascript
// When gallery photo is clicked
galleryItems.forEach(item => {
  item.addEventListener('click', () => {
    currentPhotoId = item.getAttribute('data-photo-id');
    currentDogId = item.getAttribute('data-dog-id');

    if (currentPhotoId && currentDogId) {
      setFeaturedButton.hidden = false;  // Show button
    }
  });
});

// When main photo is clicked
mainPhotoButton.addEventListener('click', () => {
  setFeaturedButton.hidden = true;  // Hide button
  currentPhotoId = null;
  currentDogId = null;
});
```

**UX:** Button only appears when viewing non-featured gallery photos

#### 5. Upload UI Improvements (`upload.js` + `dogs.njk`)
- Removed section title "Ajouter une photo"
- Button label: "Ajouter une photo" (was "Choisir une photo")
- Moved form to bottom of sidebar (after gallery)
- Progress bar hidden by default, only shown during upload
- Dynamic success messages based on moderation mode:
  - **A posteriori:** "Photo envoyée ! Elle sera visible dans 2-3 minutes (temps de reconstruction du site)."
  - **A priori:** "Photo envoyée ! Elle sera visible après validation par un administrateur."

---

## 🗄️ Data Migration

### Migration Script (`migrate-featured-photos.ts`)

**Challenge:** Production database still had `photoFeatured_*` columns, but schema was already updated

**Solution:** Use Prisma raw SQL and better-sqlite3 directly

```javascript
const Database = require("better-sqlite3");
const db = new Database("../data/keystone.db");

// Get dogs with featured photos
const dogs = db.prepare(`
  SELECT id, name, photoFeatured_id, photoFeatured_filesize,
         photoFeatured_width, photoFeatured_height, photoFeatured_extension
  FROM Dog
  WHERE photoFeatured_id IS NOT NULL
`).all();

// Create Media items pointing to same image files
for (const dog of dogs) {
  const mediaId = `migrated_${dog.id}_${Date.now()}`;

  db.prepare(`
    INSERT INTO Media (
      id, name, file_id, file_filesize, file_width, file_height,
      file_extension, type, dog, isFeatured, status, uploadedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    mediaId, "Photo principale", dog.photoFeatured_id,
    dog.photoFeatured_filesize, dog.photoFeatured_width,
    dog.photoFeatured_height, dog.photoFeatured_extension,
    "photo", dog.id, 1, "approved", new Date().toISOString()
  );
}

// Drop old columns
db.exec(`ALTER TABLE Dog DROP COLUMN photoFeatured_id`);
db.exec(`ALTER TABLE Dog DROP COLUMN photoFeatured_filesize`);
db.exec(`ALTER TABLE Dog DROP COLUMN photoFeatured_width`);
db.exec(`ALTER TABLE Dog DROP COLUMN photoFeatured_height`);
db.exec(`ALTER TABLE Dog DROP COLUMN photoFeatured_extension`);
```

**Result:**
- ✅ 30 Media items created (one per dog)
- ✅ All point to existing image files (no file duplication)
- ✅ All marked `isFeatured: true`, `status: 'approved'`
- ✅ Old columns removed

**Zero data loss** - same image files, cleaner schema

---

## 🐛 Issues Encountered & Solved

### 1. Prisma Schema Mismatch
**Problem:** After schema update, Prisma client didn't know about `photoFeatured_*` columns

**Solution:** Use raw SQL queries via better-sqlite3 directly instead of Prisma ORM

### 2. Settings Table Missing on Production
**Problem:** Hook tried to query Settings singleton but table didn't exist

**Error:**
```
Prisma error: The table `main.Settings` does not exist in the current database.
```

**Solution:** Manually create table on production:
```sql
CREATE TABLE Settings (id INTEGER PRIMARY KEY, moderationMode TEXT DEFAULT 'a_posteriori');
INSERT INTO Settings (id, moderationMode) VALUES (1, 'a_posteriori');
```

### 3. Moderation Mode Not Working
**Problem:** Photos always created with status "pending" regardless of setting

**Root Cause:** Schema has `defaultValue: 'pending'`, so hook's `if (!resolvedData.status)` was always false

**Solution:** Change condition to `if (operation === 'create')` to always override default

### 4. Featured Photo Button Positioning
**Problem:** Button overlaid on image instead of below it

**Solution:** Changed from `position: absolute` to `position: relative`, added proper margins

### 5. Lightbox Overflow Hidden
**Problem:** Button cut off by dialog's default overflow behavior

**Solution:** Added `overflow: visible` to `.lightbox` dialog

### 6. Deploy Hook Permission Errors
**Problem:** `git checkout` failed with "Permission denied" on server

**Cause:** Files created by root SSH sessions owned by root, not caddy

**Solution:** Run `chown -R caddy:caddy /srv/dogbook/current` before operations

---

## 📚 Key Learnings

### 1. Keystone Singleton Pattern
```typescript
Settings: list({
  isSingleton: true,
  graphql: {
    plural: 'SettingsItems',  // Avoid name conflicts with "Settings" query
  },
})
```

**Query:** `context.query.Settings.findOne({ query: 'moderationMode' })` (no `where` needed)

**Database:** Uses `id: 1` as the single record

### 2. Field-Level vs Operation-Level Access Control
```typescript
Media: {
  operation: {
    update: () => true,  // Anyone can update
  },
  fields: {
    status: {
      update: isAuthenticated,  // But only admins can change status
    }
  }
}
```

**Allows:** Public users to set `isFeatured`, but only admins to moderate

### 3. Keystone Hooks Execution Order
```typescript
resolveInput  // Runs BEFORE database write - modify data
afterOperation // Runs AFTER successful write - side effects
```

**Pattern:** Use `resolveInput` for setting defaults, `afterOperation` for notifications/rebuilds

### 4. SQLite Limitations
- No `ALTER TABLE ADD COLUMN` with non-constant defaults
- Required manual timestamp setting in hooks instead of `defaultValue: { kind: 'now' }`
- ALTER TABLE DROP COLUMN works fine (unlike older SQLite versions)

### 5. GraphQL Multipart Upload in Keystone
```javascript
formData.append('operations', JSON.stringify({ query, variables }));
formData.append('map', JSON.stringify({ '0': ['variables.file'] }));
formData.append('0', blob, 'photo.jpg');

// MUST include header
xhr.setRequestHeader('apollo-require-preflight', 'true');
```

**Critical:** Apollo Server 4+ requires preflight header for CSRF protection

### 6. Frontend Build Triggers
Backend hook triggers Netlify rebuild via webhook:
```typescript
afterOperation: async ({ operation, item }) => {
  if (operation === 'update' && item.isFeatured === true) {
    await triggerFrontendBuild();  // POST to Netlify hook
  }
}
```

**Result:** Featured photo changes → auto-rebuild frontend → live in 2-3 minutes

---

## ✅ What's Working Now

1. **Featured Photo System**
   - Single source of truth: `Media.isFeatured`
   - Auto-unfeaturing hook prevents multiple featured photos per dog
   - Featured photo selection via lightbox (discreet, non-intrusive)
   - Featured photo filtered from gallery (no duplication)

2. **Photo Upload**
   - Mobile-optimized with camera integration
   - Client-side compression (50-70% reduction)
   - Real-time progress tracking
   - Context-aware success messages (moderation mode)

3. **Moderation System**
   - A posteriori: Auto-approve, notify admin
   - A priori: Pending approval required
   - Setting properly respected on upload

4. **UI/UX**
   - Upload form at bottom of sidebar
   - Progress bar hidden until needed
   - Featured button in lightbox only (not on featured photo itself)
   - Proper messaging about rebuild time

---

## 🚧 Known Issues / Technical Debt

### 1. Permission Errors on Server
**Issue:** Git deploy hook sometimes fails with "Permission denied" on files

**Workaround:** Manual `chown -R caddy:caddy /srv/dogbook/current`

**TODO:** Fix deploy hook to run as caddy user instead of root

### 2. Migration Script Cleanup
**Issue:** `migrate-featured-photos.ts` uses `getContext` which doesn't work in tsx environment

**Current:** Using separate `migrate-simple.js` with better-sqlite3

**TODO:** Remove old migration script or fix to work properly

### 3. Environment Variables in Frontend
**Issue:** VAPID keys hardcoded in `push-notifications.js`

**TODO:** Inject at build time from environment variables

### 4. Error Recovery in Upload
**Issue:** Upload failure doesn't clean up UI state well

**TODO:** Allow retry without page reload, store failed uploads in localStorage

### 5. No Automated Tests
**Issue:** All changes tested manually

**TODO:**
- E2E tests for upload flow
- Unit tests for image compression
- Test hook behavior with mocked context

---

## 🎯 Future Improvements

### Immediate Enhancements

1. **Rate Limiting**
   - Prevent spam uploads
   - Track uploads per IP/session
   - Suggestion: 5 uploads per hour per dog
   - Implement in `mediaHooks.resolveInput`

2. **Batch Photo Upload**
   - Allow selecting multiple photos
   - Upload sequentially with combined progress
   - Better UX for users with many photos

3. **Admin Notification Digest**
   - Daily summary email instead of per-photo
   - "5 new photos awaiting approval"
   - Batch approval interface

### Advanced Features

4. **Image Rotation/Cropping**
   - Client-side rotation before upload
   - Optional crop tool
   - EXIF orientation handling

5. **Photo Tagging/Categories**
   - Add tags to Media model
   - Filter by tags in gallery
   - Auto-tag based on AI image recognition?

6. **CDN Integration**
   - Move from local storage to S3/Cloudflare R2
   - Serve images via CDN
   - Automatic WebP/AVIF conversion
   - Generate multiple sizes (thumbnail, medium, large)

### User Experience

7. **Upload History**
   - Show user their recent uploads
   - Track status (pending/approved/rejected)
   - Allow deletion of own pending uploads

8. **Photo Comments**
   - Add comment field to Media
   - Display under photos in gallery
   - Moderate comments similar to photos

9. **Photo Reactions**
   - Like/love reactions
   - Public engagement without comments
   - Track most popular photos

---

## 🔑 Key Files Modified

### Backend
- `backend/schema.ts` - Removed photoFeatured field, updated UI descriptions
- `backend/hooks.ts` - Added auto-unfeaturing, fixed moderation mode
- `backend/migrate-featured-photos.ts` - Migration script (TypeScript version)
- `backend/migrate-simple.js` - Working migration using better-sqlite3
- `backend/package.json` - Added tsx, migration script

### Frontend
- `frontend/.eleventy.js` - Updated GraphQL query, getFeaturedPhoto filter
- `frontend/src/dogs.njk` - Gallery filtering, upload form repositioning, lightbox button
- `frontend/src/js/featured-photo.js` - Lightbox-based featured selection
- `frontend/src/js/upload.js` - Dynamic success messages, moderation mode awareness
- `frontend/src/css/main.css` - Upload form styles, lightbox button styling

### Documentation
- `_scaffolding/mobile-photo-upload-session.md` - Original implementation session notes
- `_scaffolding/featured-photo-refactor-session.md` - This document

---

## 📊 Commits Summary

### Feature Branch Commits (4)
1. `3357c13` - Add migration script to convert photoFeatured to Media relationship
2. `8fbafc6` - Remove photoFeatured field and add auto-unfeaturing hook for Media.isFeatured
3. `eac6e28` - Update frontend to use Media.isFeatured for featured photos
4. `528696b` - Remove obsolete documentation files

### Main Branch Commits (7)
1. `86a7562` - Fix moderation mode hook to override default status on create
2. `407d3a6` - Fix moderation mode detection and update upload UI messages
3. `3e7e90f` - Improve photo upload UX and move featured photo selection to lightbox
4. `eb8e43f` - Fix lightbox featured button position - place below image, left-aligned
5. `a43607c` - Fix lightbox overflow and button spacing
6. `2775c0d` - Update featured photo button text to mention rebuild time
7. (This document will be next commit)

---

## 🎓 Patterns Worth Reusing

### 1. Unset All, Set One Pattern
```javascript
// Find all items with flag=true
const items = await context.query.Media.findMany({
  where: {
    dog: { id: { equals: dogId } },
    isFeatured: { equals: true }
  }
});

// Unset all
await Promise.all(items.map(item =>
  context.query.Media.updateOne({
    where: { id: item.id },
    data: { isFeatured: false }
  })
));

// Set selected
await context.query.Media.updateOne({
  where: { id: selectedId },
  data: { isFeatured: true }
});
```

### 2. Graceful Fallback Chain
```javascript
const featured = items.find(i => i.isFeatured);
if (featured?.file?.url) return featured.file.url;

if (items[0]?.file?.url) return items[0].file.url;

return '/images/placeholder.jpg';
```

### 3. Context-Aware UI Messages
```javascript
async function fetchModerationMode() {
  const response = await fetch(`${API_URL}/api/graphql`, {
    method: 'POST',
    body: JSON.stringify({ query: `{ settings { moderationMode } }` })
  });
  const data = await response.json();
  return data.data?.settings?.moderationMode || 'a_posteriori';
}

// Use in success message
if (moderationMode === 'a_posteriori') {
  showStatus('Visible dans 2-3 minutes');
} else {
  showStatus('Visible après validation');
}
```

---

## 🏁 Summary

**Total Time:** ~6 hours (including debugging deployment issues)

**Lines Changed:**
- Backend: ~150 lines modified/added
- Frontend: ~200 lines modified
- Migration: ~100 lines
- Documentation: ~650 lines

**Status:** ✅ **Production Ready**
- Backend deployed and running
- Frontend rebuilt and live
- Migration completed successfully (30 dogs)
- All features tested and working

**Branch:** Merged to `main`, deployed to production

**Next Session:** Consider implementing rate limiting and batch upload features

---

*Session completed November 15, 2025*
