# Dogbook Code Audit Report

**Date:** December 27, 2025
**Auditor:** Code Review
**Scope:** Full codebase security, correctness, and best practices review

---

## Executive Summary

Dogbook is a well-structured full-stack application (KeystoneJS 6 backend + 11ty static frontend) for managing a dog directory with magic link authentication. The codebase demonstrates good security practices overall, but has several areas requiring attention, particularly around race conditions, input validation edge cases, and token security.

---

## Critical Issues

### 1. Race Condition in Token Usage Counter (auth.ts:42-48)

**File:** `backend/auth.ts:42-48`
**Severity:** Medium
**Issue:** The token usage update is fire-and-forget with no await, creating a race condition.

```typescript
context.prisma.editToken.update({
  where: { id: editToken.id },
  data: {
    lastUsedAt: new Date(),
    usageCount: editToken.usageCount + 1,  // Race condition!
  },
}).catch((err: any) => console.error('Failed to update token usage:', err));
```

**Problem:** If two requests use the same token simultaneously, `usageCount` could be incremented incorrectly (lost updates). The value is read before the update and not atomic.

**Recommendation:** Use Prisma's atomic increment:
```typescript
usageCount: { increment: 1 }
```

---

### 2. PushSubscription Keys Stored as Plain Text JSON (schema.ts:334-339)

**File:** `backend/schema.ts:334-339`
**Severity:** Medium
**Issue:** Push subscription keys are stored as a plain text JSON string in the database.

```typescript
keys: text({
  validation: { isRequired: true },
  label: 'Keys (JSON)',
```

**Problem:** These keys (p256dh and auth) are cryptographic secrets. If the database is compromised, attackers could potentially send fake notifications.

**Recommendation:** Consider encrypting the keys at rest, or at minimum ensure the database file has strict filesystem permissions.

---

### 3. VAPID Public Key Hardcoded in Frontend (notifications.tsx:8)

**File:** `backend/admin/pages/notifications.tsx:8`
**Severity:** Low-Medium
**Issue:** The VAPID public key is hardcoded in the frontend:

```typescript
const VAPID_PUBLIC_KEY = 'BD8ZCavx5V8BB5zWCUY06fjWZugVtNbESyaL1CvMYgAy-CSCbREIxe8JZOZpYhMO3zuvUjp5EmNp_Tl0uIf3BDo';
```

**Problem:** If you need to rotate VAPID keys, you must rebuild and redeploy the admin UI. Also, this key should match the environment variable.

**Recommendation:** Fetch the public key from an API endpoint or inject it at build time from environment variables.

---

## Security Concerns

### 4. Magic Token Not HttpOnly (magic-auth.js:89-107)

**File:** `frontend/src/js/magic-auth.js:89-107`
**Severity:** Medium
**Issue:** The magic token cookie is set via JavaScript without HttpOnly flag:

```javascript
let cookieValue = `${COOKIE_NAME}=${token}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=${sameSite}`;
```

**Problem:** The cookie is accessible to JavaScript, making it vulnerable to XSS attacks. If any XSS vulnerability exists, attackers could steal magic tokens.

**Recommendation:** The token should ideally be set server-side with `HttpOnly` flag. Consider redirecting magic link requests through the backend which sets the cookie.

---

### 5. No CSRF Token for GraphQL Mutations

**File:** `backend/keystone.ts` and `frontend/src/js/api.js`
**Severity:** Low-Medium
**Issue:** While the `apollo-require-preflight: true` header provides some CSRF protection by requiring a custom header (browsers won't send this on simple requests), it's not a complete CSRF solution.

**Problem:** If an attacker can make the browser send a POST with the correct Content-Type and custom header (e.g., via XMLHttpRequest on a compromised subdomain), CSRF could occur.

**Recommendation:** Consider implementing a proper CSRF token system, especially for sensitive mutations.

---

### 6. Rate Limiting Bypass for Admins (keystone.ts:85)

**File:** `backend/keystone.ts:85`
**Severity:** Low
**Issue:** Rate limiting is completely skipped for authenticated admins:

```typescript
skip: isAdmin,
```

**Problem:** If an admin account is compromised, there's no rate limiting to slow down an attacker.

**Recommendation:** Consider applying a higher but non-zero rate limit for admins.

---

### 7. No Rate Limiting on Token Bruteforce

**File:** `backend/keystone.ts:107-116`
**Severity:** Medium
**Issue:** While the validation endpoint has general API rate limiting (500 req/15min), magic tokens are 36 hex characters (144 bits of entropy) which is secure against bruteforce. However, the rate limit is quite high for a token validation endpoint.

**Recommendation:** Consider a stricter rate limit specifically for failed token validations.

---

### 8. ChangeLog Creation is Public (schema.ts:359)

**File:** `backend/schema.ts:359`
**Severity:** Low
**Issue:** ChangeLog creation is open to anyone:

```typescript
create: () => true, // System can create logs
```

**Problem:** While intended for the system, any unauthenticated request could potentially create changelog entries, polluting the audit log.

**Recommendation:** Change to a more restrictive check or use `context.sudo()` for system operations and restrict create access.

---

## Bug Risks & Edge Cases

### 9. Potential Null Reference in Notification (notifications.ts:104-109)

**File:** `backend/notifications.ts:104-109`
**Severity:** Low
**Issue:** The code assumes `item.dogId` exists but doesn't handle all cases:

```typescript
const dog = item.dogId
  ? await context.query.Dog.findOne({
      where: { id: item.dogId },
      query: 'id name',
    })
  : null;
```

**Problem:** After a media upload, `item.dogId` might not be set yet if the resolver hasn't populated it. The notification might fail silently.

**Recommendation:** Fetch the media with dog relationship instead of relying on `item.dogId`.

---

### 10. Date Parsing Without Timezone Handling (change-logging.ts:115-119)

**File:** `backend/change-logging.ts:115-119`
**Severity:** Low
**Issue:** Date formatting uses local timezone:

```typescript
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
```

**Problem:** Dates will display differently depending on server timezone.

**Recommendation:** Use UTC methods or a proper date library with explicit timezone handling.

---

### 11. Frontend Date Calculation Edge Case (.eleventy.js:29-36)

**File:** `frontend/.eleventy.js:29-36`
**Severity:** Low
**Issue:** Age calculation has edge cases around month boundaries:

```javascript
if (today.getDate() < birthDate.getDate()) {
  months--;
}
```

**Problem:** This doesn't correctly handle months with different numbers of days (e.g., Feb 28 to Mar 31).

**Recommendation:** Use a proper date library like `date-fns` or handle edge cases more explicitly.

---

### 12. Owner Update Logic Flaw (edit-dog.js:159-161)

**File:** `frontend/src/js/edit-dog.js:159-161`
**Severity:** Medium
**Issue:** When editing a dog, the owner name is updated directly:

```javascript
if (this.dog.owner && newOwnerName !== this.dog.owner.name) {
  await updateOwner(this.dog.owner.id, { name: newOwnerName });
}
```

**Problem:** If Owner A has dogs [Dog1, Dog2] and you edit Dog1's owner name to "Bob", it renames Owner A for ALL their dogs, not just Dog1. This is likely unintended behavior.

**Recommendation:** Either:
- Make owner names read-only in the dog edit form
- Add a confirmation dialog warning that all dogs under this owner will be affected
- Allow reassigning to a different/new owner instead

---

### 13. Missing Error Boundary in Upload (upload.js:110-116)

**File:** `frontend/src/js/upload.js:110-116`
**Severity:** Low
**Issue:** When compression fails, the original file is used but the error is silently logged:

```javascript
} catch (error) {
  console.error('Error compressing image:', error);
  compressedBlob = file;
```

**Problem:** Users have no indication that compression failed and the original (potentially large) file will be uploaded.

**Recommendation:** Show a warning to the user that the image couldn't be optimized.

---

### 14. Unchecked JSON.parse in Notifications (notifications.ts:55)

**File:** `backend/notifications.ts:55`
**Severity:** Low
**Issue:** `JSON.parse(sub.keys)` could throw if keys is malformed:

```typescript
keys: JSON.parse(sub.keys),
```

**Problem:** A malformed keys string in the database would crash the notification sending for all subscriptions.

**Recommendation:** Wrap in try-catch and skip malformed subscriptions.

---

## Code Quality & Maintainability

### 15. Inconsistent Error Handling

**Files:** Multiple
**Issue:** Error handling is inconsistent across the codebase:
- Some places use try-catch and log
- Some places use `.catch()` callbacks
- Some errors are silently swallowed

**Recommendation:** Establish consistent error handling patterns:
- Define custom error classes
- Use a centralized error logging utility
- Never silently swallow errors

---

### 16. No TypeScript in Frontend

**File:** `frontend/src/js/*.js`
**Issue:** Frontend JavaScript lacks type safety, making refactoring error-prone.

**Recommendation:** Consider migrating to TypeScript or at minimum adding JSDoc type annotations.

---

### 17. Duplicate Domain Extraction Logic (magic-auth.js)

**File:** `frontend/src/js/magic-auth.js:71-77, 91-96, 129-134`
**Issue:** The root domain extraction logic is duplicated three times:

```javascript
const hostParts = window.location.hostname.split('.');
const rootDomain = hostParts.length > 2
  ? '.' + hostParts.slice(-2).join('.')
  : ...
```

**Recommendation:** Extract to a helper function.

---

### 18. Magic Numbers

**Files:** Multiple
**Issue:** Various magic numbers without named constants:
- `24 * 1024 * 1024` (24MB file size)
- `1920` (image dimensions)
- `0.85` (JPEG quality)
- `30 * 24 * 60 * 60` (30 days in seconds)
- `500` (rate limit)

**Recommendation:** Define named constants with comments explaining the rationale.

---

### 19. No Input Sanitization for Log Messages

**File:** `backend/change-logging.ts`
**Issue:** Entity names are included directly in log messages without sanitization:

```typescript
changesSummary: `Nouveau chien créé: ${entityName}`,
```

**Problem:** If someone creates a dog named `<script>alert('xss')</script>`, this could cause XSS if logs are displayed in HTML without escaping.

**Recommendation:** The KeystoneJS admin UI likely escapes this, but ensure all display contexts properly escape user input.

---

## Deployment & Operations

### 20. Deploy Script Uses sudo (deploy.sh:64, 99)

**File:** `deploy/deploy.sh:64, 99`
**Severity:** Low
**Issue:** The deploy script uses `sudo` without `-n` (non-interactive):

```bash
sudo systemctl stop dogbook || true
sudo systemctl restart dogbook
```

**Problem:** If sudo requires a password, deployment could hang or fail unexpectedly.

**Recommendation:**
- Use `sudo -n` to fail fast if password is required
- Or configure passwordless sudo for the deploy user for these specific commands

---

### 21. No Health Check Endpoint

**File:** `backend/keystone.ts`
**Issue:** There's no dedicated health check endpoint for monitoring.

**Recommendation:** Add a `/health` endpoint that checks:
- Database connectivity
- Disk space for images
- Memory usage

---

### 22. No Structured Logging

**Files:** Multiple
**Issue:** Logging uses `console.log/console.error` without structure:

```typescript
console.error('Failed to trigger frontend build:', response.status);
```

**Problem:** Makes log parsing, alerting, and debugging in production difficult.

**Recommendation:** Use a structured logging library (pino, winston) with:
- Log levels
- Request IDs
- Timestamps
- JSON output for production

---

### 23. Database Backup Has No Verification

**File:** `deploy/dogbook-backup.service` (referenced, not in repo)
**Issue:** The backup strategy mentions daily backups but there's no verification that backups are valid.

**Recommendation:**
- Add backup integrity checks (try opening the SQLite backup)
- Add alerting for backup failures
- Periodically test restore procedures

---

### 24. Missing Database Migrations Rollback Plan

**File:** `deploy/deploy.sh:68`
**Issue:** Migrations are applied with no rollback capability:

```bash
npx prisma migrate deploy
```

**Problem:** If a migration fails or causes issues, there's no easy way to roll back.

**Recommendation:**
- Backup database before migrations
- Document rollback procedures
- Consider feature flags for risky changes

---

## Testing

### 25. No Test Suite

**Files:** `package.json` (both)
**Severity:** High (for maintainability)
**Issue:** There are no tests configured in either the backend or frontend.

**Impact:**
- Refactoring is risky
- Edge cases are likely to be missed
- Regressions can go unnoticed

**Recommendation:** Add:
- Unit tests for auth logic, change detection, age calculation
- Integration tests for GraphQL mutations
- E2E tests for critical flows (magic link auth, upload)

---

## Performance Considerations

### 26. Frontend Build Triggered Multiple Times

**File:** `backend/hooks.ts`
**Issue:** Multiple operations can trigger multiple frontend builds in quick succession:

```typescript
// In dogHooks
if (['create', 'update', 'delete'].includes(operation)) {
  await triggerFrontendBuild();
}

// In mediaHooks - also triggers
if (operation === 'delete' || (operation === 'update' && item.status === 'approved')) {
  await triggerFrontendBuild();
}
```

**Problem:** Uploading multiple photos could trigger many unnecessary builds.

**Recommendation:** Debounce the webhook or implement a build queue.

---

### 27. N+1 Query Pattern in Featured Photo Unfeaturing

**File:** `backend/hooks.ts:211-228`
**Issue:** When setting a featured photo, other photos are unfeatured one-by-one:

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

**Recommendation:** Use `updateMany` instead:
```typescript
await context.query.Media.updateMany({
  where: { ... },
  data: { isFeatured: false },
});
```

---

## Recommendations Summary

### Priority 1 (Security - Address Soon)
1. Make magic token cookie HttpOnly (requires backend change)
2. Fix race condition in token usage counter
3. Add encryption for push subscription keys or ensure DB file permissions
4. Restrict ChangeLog creation access

### Priority 2 (Correctness - Address in Next Sprint)
5. Fix owner rename affecting all dogs issue
6. Add try-catch around JSON.parse for push keys
7. Handle notification edge cases

### Priority 3 (Maintainability - Ongoing)
8. Add comprehensive test suite
9. Implement structured logging
10. Add health check endpoint
11. Debounce frontend build triggers
12. Extract duplicate code into helpers

### Priority 4 (Nice to Have)
13. Migrate frontend to TypeScript
14. Add VAPID key to environment/API
15. Improve backup verification

---

## Conclusion

The Dogbook codebase is well-architected with good separation of concerns and thoughtful features like magic link authentication and comprehensive change logging. The main areas requiring attention are:

1. **Security hardening** around cookie handling and token storage
2. **Test coverage** to prevent regressions
3. **Operational improvements** for production reliability
4. **Edge case handling** in date calculations and owner updates

The codebase is in good shape overall and these recommendations will help ensure long-term maintainability and security.
