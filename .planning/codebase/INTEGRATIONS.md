---
version: 1.0
last_updated: 2026-01-28
---

# External Integrations

**Analysis Date:** 2026-01-28

## APIs & External Services

**AI/LLM:**
- Anthropic Claude API - AI command execution and notebook assistance
  - Web client: `src/hooks/useClaudeAPI.ts` (via `@anthropic-ai/sdk`)
  - Native client: `native/Sources/Isometry/API/ClaudeAPIClient.swift`
  - Auth: `VITE_ANTHROPIC_API_KEY` / `ANTHROPIC_API_KEY` or proxy endpoint (`VITE_API_PROXY_ENDPOINT`, `CLAUDE_API_ENDPOINT`)

**Maps:**
- OpenStreetMap tile servers - Map tiles in `src/components/LocationMapWidget.tsx` (Leaflet)
  - Integration: public tile URLs, no auth

**Local Native API (development/runtime):**
- IsometryAPIServer - Local HTTP bridge to native SQLite database
  - Swift server: `native/Sources/IsometryAPIServer/main.swift`
  - Launcher: `src/server/native-api-server.ts`, `src/server/launch-native-server.js`
  - Endpoint: `http://127.0.0.1:<port>` with REST routes in `native/Sources/IsometryAPI/routes.swift`

## Data Storage

**Database:**
- SQLite (local)
  - Native access via GRDB (`native/Sources/Isometry/Database/`)
  - Dev DB file default: `isometry-dev.db` (see `src/server/native-api-server.ts`)
  - Schema: `native/Sources/Isometry/Resources/schema.sql`, `src/db/schema.sql`

**File Storage:**
- Local filesystem (native app sandbox)
  - Entitlements and privacy usage declared under `native/Isometry*/*.entitlements` and `PrivacyInfo.xcprivacy`

## Authentication & Identity

**API Keys:**
- Claude API key for Anthropic requests (env-configured)

## Monitoring & Observability

**Logging:**
- Web: console logging in hooks/utils (`src/`)
- Native: OSLog/Logger in Swift (`native/Sources/Isometry/**`)

## CI/CD & Deployment

**Hosting:**
- Netlify config: `netlify.toml`
- Vercel config: `vercel.json`

**CI Pipeline:**
- GitHub Actions: `.github/workflows/*.yml`

## Environment Configuration

**Development:**
- `.env.production` and local env vars for Claude integration
- Native API server spawned via `npm run start:native-api` / `npm run dev:full-native`

**Production:**
- Expect proxy-based Claude API calls (see `src/config/security.ts`)

## Webhooks & Callbacks

- None identified

---

*Integration audit: 2026-01-28*
*Update when adding/removing external services*
