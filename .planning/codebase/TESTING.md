# Testing Patterns

**Analysis Date:** 2026-01-25

## Test Framework

**Runner:**
- Vitest 4.0.17
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in `expect`
- @testing-library/jest-dom for DOM assertions
- @testing-library/react for component testing
- @testing-library/user-event for user interactions

**Run Commands:**
```bash
npm test                              # Run all tests
npm run test:run                      # Single run mode
npm run test:coverage                 # With coverage report
vitest                               # Watch mode (default)
```

## Test File Organization

**Location:**
- Co-located pattern: `*.test.ts` and `*.spec.ts` alongside source files
- Some centralized in `src/test/` for integration tests

**Naming:**
- Unit tests: `filter-presets.test.ts`
- Component tests: `LocationMapWidget.test.tsx`, `PAFVContext.test.tsx`
- Integration tests: `migration-e2e.test.ts`, `data-integrity-validation.test.ts`

**Structure:**
```
src/
├── components/
│   ├── LocationMapWidget.tsx
│   └── __tests__/
│       ├── LocationMapWidget.test.tsx
│       ├── Canvas.mvp.test.tsx
│       └── HierarchyTreeView.test.tsx
├── utils/
│   └── __tests__/
│       ├── filter-presets.test.ts
│       └── geo-utils.test.ts
├── state/
│   └── __tests__/
│       └── PAFVContext.test.tsx
└── test/
    ├── setup.ts
    ├── migration-e2e.test.ts
    └── performance-regression.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

describe('ComponentName', () => {
  const defaultProps = {
    // test props
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders basic elements', () => {
      render(<Component {...defaultProps} />);
      expect(screen.getByText('Expected Text')).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('handles click events', async () => {
      const mockOnClick = vi.fn();
      render(<Component {...defaultProps} onClick={mockOnClick} />);

      screen.getByRole('button').click();

      await waitFor(() => {
        expect(mockOnClick).toHaveBeenCalledWith(/* expected args */);
      });
    });
  });
});
```

**Patterns:**
- Setup/teardown: `beforeEach()` and `afterEach()` for mock cleanup
- Nested `describe` blocks for feature grouping
- Descriptive test names starting with 'should' or action verbs

## Mocking

**Framework:** Vitest `vi` utilities

**Patterns:**
```typescript
// Module mocking
vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(() => mockMap),
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    marker: vi.fn(() => mockMarker),
  },
}));

// Function mocking
const mockOnChange = vi.fn();
mockGeolocation.getCurrentPosition.mockImplementation((success) => {
  success({ coords: { latitude: 37.7749, longitude: -122.4194 } });
});

// Object mocking
const mockMarker = {
  addTo: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  setLatLng: vi.fn().mockReturnThis(),
  bindPopup: vi.fn().mockReturnThis(),
};
```

**What to Mock:**
- External libraries: `leaflet`, `d3`, browser APIs
- Geolocation API: `navigator.geolocation`
- Database operations for unit tests
- Time-sensitive functions

**What NOT to Mock:**
- Pure utility functions
- Internal business logic
- Simple data transformations

## Fixtures and Factories

**Test Data:**
```typescript
// Factory pattern for test objects
function createTestPreset(overrides?: Partial<FilterPreset>): FilterPreset {
  return {
    id: 'test-1',
    name: 'Test Preset',
    filters: EMPTY_FILTERS,
    createdAt: new Date('2026-01-24'),
    updatedAt: new Date('2026-01-24'),
    ...overrides,
  };
}

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
```

**Location:**
- Test utilities defined within test files
- Shared mocks in test setup files

## Coverage

**Requirements:** No specific target enforced

**View Coverage:**
```bash
npm run test:coverage
open coverage/index.html
```

**Configuration:**
```typescript
// vitest.config.ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  include: ['src/**/*.{ts,tsx}'],
  exclude: ['src/test/**', 'src/**/*.d.ts'],
}
```

## Test Types

**Unit Tests:**
- Pure functions and utilities: `src/utils/__tests__/filter-presets.test.ts`
- Type guards and converters: `src/types/lpg.test.ts`
- Individual hooks and contexts: `src/state/__tests__/PAFVContext.test.tsx`

**Integration Tests:**
- End-to-end data flows: `src/test/migration-e2e.test.ts`
- Database operations: `src/test/data-integrity-validation.test.ts`
- Performance validation: `src/test/performance-regression.test.ts`

**Component Tests:**
- React component rendering and behavior
- User interaction testing with Testing Library
- Mock external dependencies and focus on component logic

## Common Patterns

**Async Testing:**
```typescript
it('handles async geolocation', async () => {
  mockGeolocation.getCurrentPosition.mockImplementation((success) => {
    success({ coords: { latitude: 37.7749, longitude: -122.4194 } });
  });

  render(<LocationMapWidget {...defaultProps} />);

  const button = screen.getByText('Use my location');
  button.click();

  await waitFor(() => {
    expect(screen.getByText('✓ Location granted')).toBeInTheDocument();
  });
});
```

**Error Testing:**
```typescript
it('handles geolocation errors', async () => {
  mockGeolocation.getCurrentPosition.mockImplementation((_success, error) => {
    error(new Error('User denied geolocation'));
  });

  render(<LocationMapWidget {...defaultProps} />);

  const button = screen.getByText('Use my location');
  button.click();

  await waitFor(() => {
    expect(screen.getByText('✗ Location denied')).toBeInTheDocument();
  });
});

it('throws on invalid preset update', () => {
  expect(() => {
    updatePreset('non-existent-id', { name: 'New Name' });
  }).toThrow('Failed to update preset');
});
```

**Context Testing:**
```typescript
// Wrapper for provider testing
function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <PAFVProvider>{children}</PAFVProvider>
    </BrowserRouter>
  );
}

it('throws error when used outside provider', () => {
  expect(() => {
    renderHook(() => usePAFV());
  }).toThrow('usePAFV must be used within PAFVProvider');
});
```

**Setup File:**
```typescript
// src/test/setup.ts
import '@testing-library/jest-dom';

// Mock ResizeObserver for D3 components
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;

// Mock matchMedia for theme detection
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }),
});
```

---

*Testing analysis: 2026-01-25*