# Testing Patterns

**Analysis Date:** 2026-01-21

## Test Framework

### React Prototype

**Runner:**
- Vitest 4.0.17
- Config: `vitest.config.ts` in project root

**Assertion Library:**
- Vitest built-in expect
- @testing-library/jest-dom for DOM assertions

**Run Commands:**
```bash
npm test                              # Run all tests
npm test -- --watch                   # Watch mode
npm test -- src/d3/factory.test.ts   # Single file
npm run test:coverage                 # Coverage report
```

### Native (Swift)

**Framework:**
- Swift Testing (modern `@Test` macros)
- XCTest for foundation

**Run Commands:**
```bash
swift test                            # Run all tests
swift test --filter IsometryTests     # Filter by target
```

## Test File Organization

### React
**Location:** `*.test.ts` alongside source files

**Structure:**
```
src/
  d3/
    factory.ts
    factory.test.ts
    scales.ts
    scales.test.ts
  types/
    lpg.ts
    lpg.test.ts
  components/
    Sidebar.tsx
    Sidebar.test.tsx
```

### Swift
**Location:** Separate `Tests/` directory

**Structure:**
```
native/
  Sources/Isometry/
    Database/IsometryDatabase.swift
  Tests/IsometryTests/
    IsometryDatabaseTests.swift
```

## Test Structure

### React (Vitest)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ModuleName', () => {
  describe('functionName', () => {
    beforeEach(() => {
      // reset state
    });

    it('should handle valid input', () => {
      // arrange
      const input = createTestInput();

      // act
      const result = functionName(input);

      // assert
      expect(result).toEqual(expectedOutput);
    });

    it('should throw on invalid input', () => {
      expect(() => functionName(null)).toThrow('Invalid input');
    });
  });
});
```

### Swift (Swift Testing)

```swift
import Testing
@testable import Isometry

@Suite("IsometryDatabase Tests")
struct IsometryDatabaseTests {
    @Test("Database initialization creates tables")
    func testInitialization() async throws {
        let db = try IsometryDatabase(path: ":memory:")
        try await db.initialize()

        let nodes = try await db.getAllNodes()
        #expect(nodes.isEmpty)
    }

    @Test("Node CRUD operations")
    func testNodeCRUD() async throws {
        let db = try IsometryDatabase(path: ":memory:")
        try await db.initialize()

        // Create
        let node = Node(name: "Test", content: "Content")
        try await db.createNode(node)

        // Read
        let fetched = try await db.getNode(id: node.id)
        #expect(fetched?.name == "Test")
    }
}
```

## Mocking

### React (Vitest)

**Module Mocking:**
```typescript
vi.mock('@/hooks/useSQLiteQuery', () => ({
  useSQLiteQuery: vi.fn(() => ({
    data: [{ name: 'test' }],
    loading: false,
    error: null,
  })),
}));
```

**Function Mocking:**
```typescript
const mockFn = vi.fn();
mockFn.mockReturnValue('result');
mockFn.mockResolvedValue(asyncResult);

expect(mockFn).toHaveBeenCalledWith('arg');
```

**Timer Mocking:**
```typescript
vi.useFakeTimers();
vi.advanceTimersByTime(300);
vi.useRealTimers();
```

### What to Mock
- External dependencies (sql.js, fetch)
- Time-based functions
- Browser APIs (ResizeObserver, matchMedia)

### What NOT to Mock
- Pure functions
- Simple utilities
- Internal business logic

## Fixtures and Factories

### React

```typescript
// Test data factory
function createTestNode(overrides?: Partial<Node>): Node {
  return {
    id: 'test-id',
    name: 'Test Node',
    nodeType: 'note',
    createdAt: '2026-01-01T00:00:00Z',
    modifiedAt: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

// In tests
const nodes = [
  createTestNode({ name: 'Node 1', priority: 1 }),
  createTestNode({ name: 'Node 2', priority: 2 }),
];
```

### Provider Wrapping

```typescript
function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ThemeProvider>
      <FilterProvider>
        {ui}
      </FilterProvider>
    </ThemeProvider>
  );
}

// Usage
renderWithProviders(<Sidebar />);
```

## Coverage

### Configuration (Vitest)
```typescript
// vitest.config.ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  include: ['src/**/*.{ts,tsx}'],
  exclude: ['src/test/**', 'src/**/*.d.ts'],
}
```

### View Coverage
```bash
npm run test:coverage
open coverage/index.html
```

## Test Types

### Unit Tests
- Test single function/class in isolation
- Mock external dependencies
- Fast execution (<100ms per test)
- Examples: `factory.test.ts`, `scales.test.ts`, `lpg.test.ts`

### Integration Tests
- Test multiple modules together
- Use in-memory database
- Examples: `IsometryDatabaseTests.swift`

### Component Tests
- Test React component rendering
- Use React Testing Library
- Mock data fetching hooks
- Examples: `Sidebar.test.tsx`

### E2E Tests
- Not currently implemented
- Planned: Playwright for React prototype

## Common Patterns

### Async Testing (Vitest)
```typescript
it('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe('expected');
});
```

### Async Testing (Swift)
```swift
@Test("Async database operation")
func testAsync() async throws {
    let result = try await db.fetchNodes()
    #expect(!result.isEmpty)
}
```

### Error Testing (Vitest)
```typescript
it('should throw on invalid input', () => {
  expect(() => parse(null)).toThrow('Cannot parse null');
});

it('should reject on failure', async () => {
  await expect(asyncCall()).rejects.toThrow('Error');
});
```

### Setup File
```typescript
// src/test/setup.ts
import '@testing-library/jest-dom';

// Mock ResizeObserver
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock matchMedia
window.matchMedia = vi.fn().mockImplementation(query => ({
  matches: false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));
```

## Test Coverage Areas

### Well-Tested
- D3 factory utilities (accessors, transitions, class names)
- Scale creation and data extraction
- LPG type conversions and guards
- Database CRUD operations (Swift)

### Needs More Tests
- Filter compilation
- DSL parser
- View rendering
- CloudKit sync

---

*Testing analysis: 2026-01-21*
*Update when test patterns change*
