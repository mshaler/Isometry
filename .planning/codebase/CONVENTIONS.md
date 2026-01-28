---
version: 1.0
last_updated: 2026-01-28
---

# Coding Conventions

**Analysis Date:** 2026-01-28

## Naming Patterns

**Files:**
- React components use PascalCase `.tsx` (e.g., `LocationMapWidget.tsx`)
- Hooks use `use*` prefix in camelCase (e.g., `useClaudeAPI.ts`)
- Tests use `*.test.tsx` or live under `__tests__/`
- Swift files typically match type names in PascalCase

**Functions:**
- camelCase for functions and methods
- Event handlers often `handle*` or `on*`

**Variables:**
- camelCase for variables
- UPPER_SNAKE_CASE for constants (occasional)

**Types:**
- PascalCase for interfaces/types/enums
- Swift types use PascalCase; cases use lowerCamelCase

## Code Style

**Formatting:**
- Semicolons present in TS/JS
- Single quotes in TS/JS imports and strings

**Linting:**
- ESLint with `eslint.config.js`
- TypeScript ESLint recommended configs
- `npm run lint`

## Import Organization

**Order (typical):**
1. External packages
2. Internal modules
3. Relative imports

**Path Aliases:**
- `@` alias to `src/` (see `vitest.config.ts`)

## Error Handling

**Patterns:**
- Web: `try/catch` around async calls in hooks and services
- Native: Swift `throws` and typed error enums

**Error Types:**
- Web: return structured `CommandResponse` errors (e.g., `src/hooks/useCommandRouter.ts`)
- Native: `LocalizedError` and custom error enums in API server

## Logging

**Framework:**
- Web: `console.*`
- Native: `OSLog`/`Logger` (`native/Sources/Isometry/**`)

## Comments

**When to Comment:**
- Use `// MARK: -` sections in Swift for organization
- Explanatory comments for non-obvious logic (seen in db/ and API layers)

**JSDoc/TSDoc:**
- Not required globally; used sparingly for exported utilities

## Function Design

**Size:**
- Larger functions exist; helpers used in some areas (e.g., `src/db/NativeAPIClient.ts`)

**Parameters:**
- Objects used for configuration (e.g., `startNativeAPIServer(config)`)

## Module Design

**Exports:**
- Named exports in TS modules
- Swift modules split by domain under `native/Sources/Isometry/`

**Barrel Files:**
- Limited usage; imports are often direct paths

---

*Convention analysis: 2026-01-28*
*Update when patterns change*
