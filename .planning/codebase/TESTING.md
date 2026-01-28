---
version: 1.0
last_updated: 2026-01-28
---

# Testing Patterns

**Analysis Date:** 2026-01-28

## Test Framework

**Runner:**
- Vitest (`vitest.config.ts`) for web/client tests
- SwiftPM XCTest for native (`native/Tests/`)

**Assertion Library:**
- Vitest `expect` + @testing-library/jest-dom matchers
- Swift XCTest assertions

**Run Commands:**
```bash
npm run test              # Vitest watch
npm run test:run          # Vitest single run
npm run test:coverage     # Coverage report
swift test --package-path native  # Native tests
```

## Test File Organization

**Location:**
- Web: `src/**/__tests__/` and `src/**/*.{test,spec}.{ts,tsx}`
- Native: `native/Tests/`

**Naming:**
- Web: `*.test.tsx` / `*.test.ts`
- Swift: XCTest `*Tests.swift`

**Structure:**
```
src/
  components/
    __tests__/
      LocationMapWidget.test.tsx
  db/
    __tests__/
      MigrationSafety.test.ts
```

## Test Structure

**Suite Organization (Vitest):**
```typescript
describe('ComponentOrModule', () => {
  it('handles expected case', () => {
    // arrange
    // act
    // assert
  });
});
```

**Patterns:**
- `beforeEach` used for shared setup where needed
- Test timeouts configured in `vitest.config.ts`

## Mocking

**Framework:**
- Vitest `vi` for mocks

**Patterns:**
```typescript
vi.mock('../path/to/module', () => ({
  someFn: vi.fn()
}));
```

**What to Mock:**
- Network calls, native API bridge, timeouts

**What NOT to Mock:**
- Pure utilities where possible

## Fixtures and Factories

**Test Data:**
- Inline objects in tests are common
- Some shared helpers in `src/test/`

## Coverage

**Requirements:**
- No explicit target enforced

**Configuration:**
- Coverage via `vitest.config.ts` (V8 provider)
- Excludes `src/test/**` and `*.d.ts`

**View Coverage:**
```bash
npm run test:coverage
```

## Test Types

**Unit Tests:**
- React component behavior and utilities

**Integration Tests:**
- DB layer and bridge logic in `src/db/__tests__/`

**E2E Tests:**
- None configured (Playwright config directory exists: `.playwright-mcp/`)

---

*Testing analysis: 2026-01-28*
*Update when testing approach changes*
