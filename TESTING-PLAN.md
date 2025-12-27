# Automated Testing Plan - Dogbook

This document outlines the strategy for automated testing of the Dogbook application, covering functional tests, security testing, and production monitoring.

---

## 1. Backend Unit & Integration Tests

### Setup
```bash
cd backend
npm install --save-dev vitest supertest @types/supertest
```

### Test Structure
```
backend/
├── tests/
│   ├── unit/
│   │   ├── auth.test.ts        # Magic token validation
│   │   ├── hooks.test.ts       # File validation, moderation logic
│   │   └── notifications.test.ts
│   ├── integration/
│   │   ├── api.test.ts         # GraphQL API tests
│   │   ├── upload.test.ts      # File upload flow
│   │   └── access-control.test.ts
│   └── setup.ts                # Test database setup
```

### Key Test Cases

| Area | Test Case | Priority |
|------|-----------|----------|
| Auth | Valid magic token grants access | High |
| Auth | Expired token is rejected | High |
| Auth | Invalid token format rejected | High |
| Upload | Files over 24MB rejected | High |
| Upload | Invalid extensions rejected | High |
| Upload | Valid image accepted | High |
| Access | Owner PII hidden from public | High |
| Access | Media requires token to create | High |
| Rate Limit | 100 req/15min limit enforced | Medium |
| Rate Limit | 60 uploads/hour limit enforced | Medium |
| Hooks | Featured photo toggle works | Medium |
| Hooks | Moderation mode sets correct status | Medium |

### Run Command
```bash
npm run test          # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

---

## 2. Frontend E2E Tests

### Setup
```bash
cd frontend
npm install --save-dev playwright @playwright/test
npx playwright install
```

### Test Structure
```
frontend/
├── tests/
│   ├── e2e/
│   │   ├── navigation.spec.ts   # Page navigation
│   │   ├── dog-listing.spec.ts  # Dog cards display
│   │   ├── magic-auth.spec.ts   # Magic link flow
│   │   ├── upload.spec.ts       # Photo upload
│   │   └── edit-forms.spec.ts   # Edit dog/owner
│   └── playwright.config.ts
```

### Key Test Cases

| Flow | Test Case | Priority |
|------|-----------|----------|
| Navigation | Homepage loads dog grid | High |
| Navigation | Dog detail page shows photos | High |
| Magic Auth | Token in URL activates edit mode | High |
| Magic Auth | Invalid token shows error | High |
| Magic Auth | Token persists in cookie | Medium |
| Upload | Form hidden without auth | High |
| Upload | Upload succeeds with valid token | High |
| Upload | Large file shows error | Medium |
| Edit | Dog form saves changes | Medium |
| Edit | Owner form saves changes | Medium |

### Run Command
```bash
npx playwright test              # Run all tests
npx playwright test --ui         # Interactive UI
npx playwright show-report       # View report
```

---

## 3. Security / Penetration Testing

### 3.1 Automated Security Scanning

#### OWASP ZAP (API Scanning)
```bash
# Run ZAP against staging API
docker run -t owasp/zap2docker-stable zap-api-scan.py \
  -t https://staging-api.dogbook.example/api/graphql \
  -f openapi \
  -r zap-report.html
```

#### nuclei (Vulnerability Scanner)
```bash
# Install
go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest

# Scan for common vulnerabilities
nuclei -u https://staging.dogbook.example -t cves,vulnerabilities,exposures
```

### 3.2 Manual Penetration Test Checklist

#### Authentication & Authorization
- [ ] Attempt API access without token
- [ ] Attempt API access with expired token
- [ ] Attempt to access Owner email/phone without admin session
- [ ] Attempt to delete PushSubscription without admin session
- [ ] Attempt to change Media status without admin session
- [ ] Test token enumeration (timing attacks)

#### Input Validation
- [ ] Upload file with fake extension (e.g., malware.jpg.exe)
- [ ] Upload polyglot file (valid image + embedded script)
- [ ] GraphQL injection attempts
- [ ] XSS in dog/owner name fields
- [ ] Path traversal in file upload

#### Rate Limiting
- [ ] Verify 100 req/15min general limit
- [ ] Verify 60 uploads/hour limit
- [ ] Test limit bypass via IP spoofing headers

#### Session Security
- [ ] Verify SESSION_SECRET is not default
- [ ] Verify cookies are HttpOnly
- [ ] Verify cookies are Secure (HTTPS only)
- [ ] Verify SameSite attribute

#### CORS
- [ ] Verify only allowed origins accepted
- [ ] Test preflight request handling

### 3.3 Security Test Script

```typescript
// backend/tests/security/penetration.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';

const API_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('Security Tests', () => {
  describe('Authentication Bypass', () => {
    it('rejects media creation without token', async () => {
      const res = await request(API_URL)
        .post('/api/graphql')
        .send({
          query: `mutation { createMedia(data: { name: "test" }) { id } }`
        });
      expect(res.body.errors).toBeDefined();
    });

    it('rejects invalid magic token', async () => {
      const res = await request(API_URL)
        .post('/api/graphql')
        .set('Cookie', 'magic_token=invalid123')
        .send({
          query: `mutation { createMedia(data: { name: "test" }) { id } }`
        });
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('PII Protection', () => {
    it('hides owner email from public', async () => {
      const res = await request(API_URL)
        .post('/api/graphql')
        .send({
          query: `{ owners { id name email } }`
        });
      const owner = res.body.data.owners[0];
      expect(owner.email).toBeNull();
    });
  });

  describe('Rate Limiting', () => {
    it('enforces request limit', async () => {
      const requests = Array(101).fill(null).map(() =>
        request(API_URL).post('/api/graphql').send({ query: '{ __typename }' })
      );
      const responses = await Promise.all(requests);
      const blocked = responses.filter(r => r.status === 429);
      expect(blocked.length).toBeGreaterThan(0);
    });
  });
});
```

---

## 4. CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        run: cd backend && npm ci

      - name: Run unit tests
        run: cd backend && npm test

      - name: Run security tests
        run: cd backend && npm run test:security

  frontend-e2e:
    runs-on: ubuntu-latest
    needs: backend-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install dependencies
        run: |
          cd backend && npm ci
          cd ../frontend && npm ci
          npx playwright install --with-deps

      - name: Start backend
        run: cd backend && npm run dev &
        env:
          SESSION_SECRET: ${{ secrets.TEST_SESSION_SECRET }}
          DATABASE_URL: file:./test.db

      - name: Build frontend
        run: cd frontend && npm run build

      - name: Run E2E tests
        run: cd frontend && npx playwright test

  security-scan:
    runs-on: ubuntu-latest
    needs: backend-tests
    steps:
      - uses: actions/checkout@v4

      - name: Run OWASP ZAP scan
        uses: zaproxy/action-api-scan@v0.7.0
        with:
          target: ${{ secrets.STAGING_API_URL }}
          fail_action: true
          rules_file_name: '.zap-rules.tsv'
```

---

## 5. Production Monitoring

### 5.1 Health Check Endpoint

Add to `backend/keystone.ts`:
```typescript
server: {
  extendExpressApp: (app) => {
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });
  },
},
```

### 5.2 Uptime Monitoring

Use external service (UptimeRobot, Pingdom, or self-hosted):

| Check | URL | Interval | Alert |
|-------|-----|----------|-------|
| API Health | `/health` | 1 min | Email + Push |
| GraphQL | `/api/graphql` | 5 min | Email |
| Frontend | `/` | 5 min | Email |

### 5.3 Synthetic Monitoring Script

```bash
#!/bin/bash
# monitoring/synthetic-test.sh

API_URL="${API_URL:-https://api.dogbook.example}"
FRONTEND_URL="${FRONTEND_URL:-https://dogbook.example}"

# Test API health
if ! curl -sf "$API_URL/health" > /dev/null; then
  echo "CRITICAL: API health check failed"
  exit 1
fi

# Test GraphQL endpoint
GRAPHQL_RESPONSE=$(curl -sf "$API_URL/api/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ dogs { id } }"}')

if ! echo "$GRAPHQL_RESPONSE" | jq -e '.data.dogs' > /dev/null; then
  echo "CRITICAL: GraphQL query failed"
  exit 1
fi

# Test frontend
if ! curl -sf "$FRONTEND_URL" | grep -q "Dogbook"; then
  echo "CRITICAL: Frontend not loading"
  exit 1
fi

echo "OK: All checks passed"
exit 0
```

### 5.4 Cron Schedule

```cron
# Run synthetic tests every 5 minutes
*/5 * * * * /srv/dogbook/monitoring/synthetic-test.sh >> /var/log/dogbook-monitoring.log 2>&1
```

---

## 6. Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Set up vitest in backend
- [ ] Write auth unit tests
- [ ] Write file validation tests
- [ ] Add health check endpoint

### Phase 2: Integration (Week 2)
- [ ] Write API integration tests
- [ ] Write access control tests
- [ ] Set up Playwright in frontend
- [ ] Write basic E2E tests

### Phase 3: Security (Week 3)
- [ ] Write security test suite
- [ ] Run OWASP ZAP scan
- [ ] Run nuclei scan
- [ ] Manual penetration testing

### Phase 4: CI/CD (Week 4)
- [ ] Create GitHub Actions workflow
- [ ] Set up staging environment
- [ ] Configure security scanning in CI
- [ ] Set up production monitoring

---

## 7. Tools Summary

| Purpose | Tool | License |
|---------|------|---------|
| Unit Tests | vitest | MIT |
| API Tests | supertest | MIT |
| E2E Tests | Playwright | Apache 2.0 |
| Security Scan | OWASP ZAP | Apache 2.0 |
| Vuln Scan | nuclei | MIT |
| Monitoring | UptimeRobot | Free tier |
