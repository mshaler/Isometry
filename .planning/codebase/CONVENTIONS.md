# Coding Conventions

**Analysis Date:** 2026-01-21

## Naming Patterns

### Files
- **Components:** PascalCase (`Sidebar.tsx`, `Navigator.tsx`)
- **Hooks:** camelCase with `use` prefix (`useSQLiteQuery.ts`, `useD3.ts`)
- **Utilities:** camelCase (`compiler.ts`, `factory.ts`)
- **Types:** PascalCase files with lowercase names (`node.ts`, `filter.ts`)
- **Tests:** Same name + `.test.ts` (`factory.test.ts`)

### Functions
- camelCase for all functions
- No special prefix for async functions
- `handle*` for event handlers (`handleClick`, `handleSubmit`)
- `use*` for hooks (`useDatabase`, `useFilters`)
- `is*` for type guards (`isNode`, `isEdge`)
- `*To*` for converters (`rowToNode`, `nodeToCardValue`)

### Variables
- camelCase for variables
- UPPER_SNAKE_CASE for constants (not strictly enforced)
- No underscore prefix for private members

### Types (TypeScript)
- PascalCase for interfaces (`Node`, `Edge`, `FilterState`)
- PascalCase for type aliases (`ViewType`, `LATCHAxis`)
- No `I` prefix for interfaces

### Swift Naming
- PascalCase for types (`Node`, `IsometryDatabase`)
- camelCase for properties (`nodeType`, `createdAt`)
- camelCase for enum cases (`.link`, `.nest`)
- `MARK:` comments for section organization

## Code Style

### Formatting
- **Tool:** Prettier (implicit via ESLint)
- **Indentation:** 2 spaces
- **Line length:** ~100 characters
- **Quotes:** Single quotes for strings
- **Semicolons:** Required

### Linting (ESLint v9)
```javascript
// eslint.config.js
{
  '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  '@typescript-eslint/no-explicit-any': 'warn',
}
```

### TypeScript Config
```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

## Import Organization

### Order
1. External packages (`react`, `d3`, `sql.js`)
2. Internal modules (`@/lib`, `@/components`)
3. Relative imports (`./utils`, `../types`)
4. Type imports (`import type { }`)

### Path Aliases
- `@/` maps to `src/`
- Configured in `tsconfig.json`

### Example
```typescript
import { useState, useCallback } from 'react';
import * as d3 from 'd3';

import { useDatabase } from '@/db/DatabaseContext';
import { compile } from '@/dsl/compiler';

import type { Node, Edge } from '@/types';
```

## Error Handling

### React/TypeScript
- Try-catch with error state management
- Error passed through `QueryState<T>` interface
- `ErrorBoundary` component wraps entire app
- Optional chaining for null safety

```typescript
try {
  const rows = execute<Record<string, unknown>>(sql, params);
  setData(transformRef.current ? transformRef.current(rows) : rows);
} catch (err) {
  setError(err as Error);
  setData(null);
}
```

### Swift
- Custom error types conforming to `LocalizedError, Sendable`
- Associated values for context
- Async/await with throws

```swift
public enum DatabaseError: LocalizedError, Sendable {
    case queryFailed(sql: String, underlying: Error)
    case nodeNotFound(id: String)

    var errorDescription: String? {
        switch self {
        case .queryFailed(let sql, let error):
            return "Query failed: \(sql) - \(error.localizedDescription)"
        case .nodeNotFound(let id):
            return "Node not found: \(id)"
        }
    }
}
```

## Logging

### React
- `console.error` for SQL errors (with query + params)
- No production logging framework yet

### Swift
- `print()` for debug output
- Structured logging not implemented

## Comments

### When to Comment
- Explain "why", not "what"
- Document business rules and edge cases
- Section headers with `// ============`

### JSDoc
- Required for public hook APIs
- Use `@param`, `@returns`, `@example` tags

### TODO Format
```typescript
// TODO: Load schema from SQLite
// TODO(username): Fix race condition
```

## Function Design

### Size
- Keep under 50 lines
- Extract helpers for complex logic

### Parameters
- Max 3-4 parameters
- Use options object for more: `function create(options: CreateOptions)`
- Destructure in parameter list

### Return Values
- Explicit returns
- Return early for guard clauses
- Use `QueryState<T>` for async data

## Module Design

### Exports
- Named exports preferred
- Barrel exports via `index.ts`

### Context Pattern
```typescript
const Context = createContext<T | undefined>(undefined);

export function Provider({ children }) {
  // state management
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useHook() {
  const context = useContext(Context);
  if (!context) throw new Error('useHook must be used within Provider');
  return context;
}
```

### Hook Pattern
```typescript
export function useSomething<T>(query: string, options: Options = {}): QueryState<T> {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // effect logic

  return { data, loading, error, refetch };
}
```

## Swift Conventions

### Actor Pattern
```swift
public actor IsometryDatabase {
    private let dbPool: DatabasePool

    public func createNode(_ node: Node) async throws {
        try await dbPool.write { db in
            try node.insert(db)
        }
    }
}
```

### Codable + CodingKeys
```swift
struct Node: Codable, Sendable {
    let nodeType: String

    enum CodingKeys: String, CodingKey {
        case nodeType = "node_type"  // snake_case DB → camelCase Swift
    }
}
```

### Computed Properties
```swift
var isDeleted: Bool { deletedAt != nil }
var hasLocation: Bool { latitude != nil && longitude != nil }
var isOverdue: Bool {
    guard let dueAt, completedAt == nil else { return false }
    return dueAt < Date()
}
```

---

*Convention analysis: 2026-01-21*
*Update when patterns change*
