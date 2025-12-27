# Code Audit - Dogbook

This document summarizes the findings from a security and code quality audit of the Dogbook codebase.

## Summary

The application is generally well-structured with clear separation between backend (KeystoneJS) and frontend (11ty). However, several security issues and maintenance concerns should be addressed before production deployment.

---

## Security Issues

### High Priority

#### 1. Insecure Default Session Secret
**Location:** `backend/keystone.ts:12`

```typescript
secret: process.env.SESSION_SECRET || 'change-me-in-production-min-32-chars',
```

**Problem:** A hardcoded fallback secret means sessions are predictable if the environment variable is not set. This could allow session hijacking.

**Recommendation:** Remove the fallback and fail fast if `SESSION_SECRET` is not configured:
```typescript
secret: process.env.SESSION_SECRET || (() => {
  throw new Error('SESSION_SECRET environment variable is required');
})(),
```

---

#### 2. Overly Permissive CORS Configuration
**Location:** `backend/keystone.ts:52-54`

```typescript
cors: {
  origin: true,  // Allows ANY origin
  credentials: true,
},
```

**Problem:** `origin: true` allows any website to make authenticated requests to the API. Combined with `credentials: true`, this is a significant security risk.

**Recommendation:** Restrict origins to known domains:
```typescript
cors: {
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:8080',
    process.env.ADMIN_URL || 'http://localhost:3000',
  ].filter(Boolean),
  credentials: true,
},
```

---

#### 3. No Rate Limiting
**Location:** Entire API

**Problem:** No rate limiting on any endpoints. This enables:
- Brute force attacks on admin login
- Abuse of public upload functionality (DoS)
- Token enumeration attacks

**Recommendation:** Add rate limiting middleware, especially for:
- Login attempts (e.g., 5 per minute per IP)
- File uploads (e.g., 10 per hour per IP)
- Magic token validation (e.g., 20 per minute per IP)

---

#### 4. Open Media Upload
**Location:** `backend/schema.ts:180-181`

```typescript
create: () => true, // Anyone can upload
update: () => true, // Anyone can update
```

**Problem:** Unauthenticated users can upload arbitrary files. Combined with no rate limiting, this is a storage exhaustion and potential malware vector.

**Recommendation:** Require at least a magic token for uploads:
```typescript
create: hasValidEditToken,
update: hasValidEditToken,
```

---

### Medium Priority

#### 5. Magic Token Leakage via URL
**Location:** Frontend magic link handling

**Problem:** Tokens passed via `?magic=...` URL parameter can leak through:
- Browser history
- Referrer headers to external sites
- Server access logs
- Analytics tools

**Recommendation:**
- Clear URL immediately after extracting token (already done - good!)
- Consider POST-based token validation instead of URL parameter
- Document that tokens should be treated as sensitive secrets

---

#### 6. PushSubscription Deletion Open to Public
**Location:** `backend/schema.ts:311`

```typescript
delete: () => true, // Anyone can unsubscribe
```

**Problem:** Anyone can delete any push subscription by ID, potentially silencing admin notifications.

**Recommendation:** Restrict deletion:
```typescript
delete: ({ session, item }) => {
  // Only allow if admin OR subscription endpoint matches request origin
  return !!session;
},
```

---

#### 7. Fragile API URL Inference
**Location:** `frontend/src/js/api.js:7-9`, `frontend/src/js/magic-auth.js:52-54`

```javascript
const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : window.location.origin.replace('www.', 'niche.');
```

**Problem:** This logic assumes a specific subdomain pattern that will break with different domain configurations.

**Recommendation:** Use a build-time environment variable:
```javascript
const API_URL = window.API_URL || 'http://localhost:3000';
```

And inject `API_URL` in the HTML template at build time.

---

#### 8. Owner PII Publicly Queryable
**Location:** `backend/schema.ts:139`, frontend queries

**Problem:** Owner email and phone are queryable by anyone. The frontend even fetches this data at build time and includes it in the static HTML.

**Recommendation:**
- Add field-level access control to restrict email/phone to authenticated users
- Or remove these fields from public queries entirely

---

### Low Priority

#### 9. Debug Logging in Production
**Locations:** Multiple files

Examples:
- `backend/notifications.ts:17` logs partial VAPID public key
- `backend/notifications.ts:97-101` logs all subscription details
- Various `console.log` statements throughout

**Recommendation:** Use a proper logging library with log levels, disable debug logs in production.

---

#### 10. No Server-Side File Type Validation
**Location:** `backend/schema.ts:208` (image field)

**Problem:** Relies on Keystone's built-in image handling without additional validation. Malicious files could potentially be uploaded.

**Recommendation:** Add explicit file type and size validation in `resolveInput` hook.

---

## Bugs

### 1. Race Condition in Featured Photo Hook
**Location:** `backend/hooks.ts:200-207`

```typescript
await Promise.all(
  otherFeaturedPhotos.map((photo: any) =>
    context.query.Media.updateOne({
      where: { id: photo.id },
      data: { isFeatured: false },
    })
  )
);
```

**Problem:** If two photos are set as featured simultaneously, both operations might see each other as "featured" and both might try to unfeature each other, leading to no featured photo.

**Recommendation:** Use a database transaction or mutex for this operation.

---

### 2. Fire-and-Forget Token Update
**Location:** `backend/auth.ts:42-48`

```typescript
context.prisma.editToken.update({
  where: { id: editToken.id },
  data: {
    lastUsedAt: new Date(),
    usageCount: editToken.usageCount + 1,
  },
}).catch((err: any) => console.error('Failed to update token usage:', err));
```

**Problem:** The update is not awaited, so `usageCount` might be outdated if the same token is used in rapid succession.

**Recommendation:** Either await the update (adds latency) or accept eventual consistency and document this behavior.

---

### 3. Inconsistent Admin Notification Filtering
**Location:** `backend/notifications.ts:94-101`

```typescript
const allSubscriptions = await context.query.PushSubscription.findMany({
  query: 'id endpoint keys receivesAdminNotifications',
});
const adminSubscriptions = allSubscriptions.filter((s: any) =>
  s.receivesAdminNotifications === true
);
```

**Problem:** Fetches all subscriptions then filters in JavaScript, while other functions use proper `where` clause filtering. Inefficient and inconsistent.

**Recommendation:** Use the `where` clause consistently:
```typescript
const adminSubscriptions = await context.query.PushSubscription.findMany({
  where: { receivesAdminNotifications: { equals: true } },
  query: 'id endpoint keys',
});
```

---

### 4. Missing Magic Token Format Validation
**Location:** `backend/auth.ts`

**Problem:** Magic tokens are accepted without validating they match the expected format (36-character hex string).

**Recommendation:** Add format validation:
```typescript
if (!/^[0-9a-f]{36}$/.test(token)) return false;
```

---

## Maintenance & Best Practices

### 1. Missing TypeScript Types
**Location:** Throughout backend code

**Problem:** Extensive use of `any` type loses TypeScript benefits.

```typescript
export const hasValidEditToken = async ({ context }: any) => { ... }
```

**Recommendation:** Create proper type definitions for Keystone context and use them.

---

### 2. Hardcoded Node Version in systemd Service
**Location:** `deploy/dogbook.service:9-11`

```
ExecStart=/home/dogbook/.nvm/versions/node/v22.21.1/bin/node ...
```

**Problem:** Node version is hardcoded; updates require manual service file changes.

**Recommendation:** Use a wrapper script that sources nvm, or use a version-agnostic path.

---

### 3. No Health Check Endpoint
**Location:** `backend/keystone.ts`

**Problem:** No `/health` or `/status` endpoint for monitoring and load balancer health checks.

**Recommendation:** Add a simple health endpoint:
```typescript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

---

### 4. Hardcoded GitHub URL in Deploy Script
**Location:** `deploy/deploy.sh:19`

```bash
GITHUB_REPO="https://github.com/louije/dogbook.git"
```

**Recommendation:** Make this configurable or remove if not needed.

---

### 5. Missing package-lock.json
**Location:** Both `backend/` and `frontend/`

**Problem:** Without lockfiles, `npm install` may resolve different versions on different machines, causing "works on my machine" issues.

**Recommendation:** Commit `package-lock.json` files.

---

### 6. Frontend Build Depends on Running Backend
**Location:** `frontend/.eleventy.js:98-148`

```javascript
eleventyConfig.addGlobalData('dogs', async () => {
  const response = await fetch(`${API_URL}/api/graphql`, { ... });
```

**Problem:** Frontend build fails if backend is not running. This couples CI/CD pipelines.

**Recommendation:**
- Add fallback for build-time data fetching failures
- Or use a mock/fixture data for CI builds
- Document this dependency clearly

---

### 7. VAPID Keys Not in Production Example
**Location:** `backend/.env.production.example`

**Problem:** VAPID keys are documented in `.env.example` but not in `.env.production.example`, leading to incomplete production setup.

**Recommendation:** Add VAPID configuration to production example.

---

### 8. Inconsistent Error Handling
**Location:** Throughout codebase

**Problem:** Some functions throw errors, some return false, some fail silently. This makes error handling unpredictable.

**Recommendation:** Establish consistent error handling patterns:
- Functions that can fail should throw or return `Result<T, Error>` type
- Document error behavior in function comments

---

## Positive Observations

1. **Good audit trail**: The ChangeLog system provides comprehensive change tracking
2. **Moderation modes**: Flexible a priori/a posteriori moderation is well-implemented
3. **Client-side compression**: Image compression before upload reduces bandwidth and storage
4. **Clean separation**: Backend/frontend split with clear API boundaries
5. **Magic links**: Passwordless authentication is user-friendly for the use case
6. **Cookie-based auth**: Using HttpOnly cookies for session management is correct

---

## Recommendations Priority

### Immediate (Before Production)
1. Fix session secret fallback
2. Restrict CORS origins
3. Add rate limiting
4. Require authentication for media uploads

### Short-term
5. Add health check endpoint
6. Fix Owner PII exposure
7. Add package-lock.json files
8. Document VAPID setup for production

### Long-term
9. Add proper TypeScript types
10. Improve error handling consistency
11. Add comprehensive logging with log levels
12. Consider transaction-based featured photo updates
