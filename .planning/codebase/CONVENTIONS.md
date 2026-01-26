# Coding Conventions

**Analysis Date:** 2026-01-25

## Naming Patterns

**Files:**
- PascalCase for React components: `UnifiedApp.tsx`, `LocationMapWidget.tsx`, `PAFVNavigator.tsx`
- camelCase for utilities and modules: `filter-presets.ts`, `webview-bridge.ts`, `sqliteSyncManager.ts`
- kebab-case for test files: `data-integrity-validation.test.ts`, `final-migration-validation.test.ts`
- camelCase for hooks: `useSlashCommands.ts`, `useD3Visualization.ts`, `useCommandRouter.ts`

**Functions:**
- camelCase for functions and methods: `compileString()`, `getSuggestions()`, `loadPresets()`, `generatePresetId()`
- PascalCase for React components: `UnifiedApp()`, `LocationMapWidget()`, `ThemeProvider()`
- `handle*` pattern for event handlers: observed in component patterns
- `use*` prefix for custom hooks: `usePAFV()`, `useSlashCommands()`

**Variables:**
- camelCase for variables: `mockGeolocation`, `localStorageMock`, `trimmed`, `textBeforeCursor`
- SCREAMING_SNAKE_CASE for module constants: `EMPTY_FILTERS`, `DEFAULT_PAFV`, `SCHEMA_FIELDS`, `ISOMETRY_COMMANDS`
- Prefix `mock` for test mocks: `mockMarker`, `mockCircle`, `mockMap`

**Types:**
- PascalCase for interfaces and types: `SlashCommand`, `FilterPreset`, `ConnectionStatus`, `AxisMapping`
- camelCase for interface properties: `isOpen`, `cursorOffset`, `selectedIndex`, `radiusMeters`
- Union types for constrained values: `type FilterOperator = '=' | '<' | '>' | '<=' | '>=' | '~'`

## Code Style

**Formatting:**
- No Prettier config detected - relies on ESLint TypeScript formatting
- 2-space indentation (consistent across all source files)
- Single quotes for strings
- Trailing commas in multiline objects and arrays

**Linting:**
- ESLint 9 with TypeScript support via `typescript-eslint`
- Config file: `eslint.config.js`
- Key rules:
  - `@typescript-eslint/no-unused-vars: ['warn', { argsIgnorePattern: '^_' }]`
  - `@typescript-eslint/no-explicit-any: 'warn'`
- Ignores: `['node_modules', 'dist', '*.js', 'native/**']`

## Import Organization

**Order:**
1. React imports: `import { useState, useCallback, useRef } from 'react'`
2. External library imports: `import * as d3 from 'd3'`, `import { BrowserRouter } from 'react-router-dom'`
3. Internal absolute imports: `import { ThemeProvider } from '../contexts/ThemeContext'`
4. Type-only imports: `import type { Database, QueryExecResult } from 'sql.js'`

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- Used consistently: `import { Button } from '@/components/ui/button'`

## Error Handling

**Patterns:**
- Throw descriptive Error objects: `throw new Error('WebView bridge not available - ensure running in native app')`
- Include context in error messages: operation, parameters, and underlying error
- Try-catch blocks for external API calls and database operations
- Graceful fallbacks: Native API falls back to sql.js when unavailable
- Error state management in React hooks with `QueryState<T>` pattern

## Logging

**Framework:** Native `console` methods

**Patterns:**
- `console.error()` for failures and exceptions with context
- `console.log()` for successful operations
- `console.warn()` for recoverable issues
- Include operation context: `console.error('WebView database execution error:', sql, params, error)`

## Comments

**When to Comment:**
- File headers for complex modules with purpose and context
- Inline comments for business logic and workarounds
- TODOs for known technical debt
- @ts-expect-error with explanation for necessary type violations

**JSDoc/TSDoc:**
- Used for exported functions and interfaces
- Example: `/** * Vitest Test Setup * * Global test configuration and mocks for Isometry tests. */`
- Include purpose, parameters, and usage examples

## Function Design

**Size:**
- Functions kept focused and under 100 lines
- Complex functions broken into smaller helpers
- Single responsibility principle

**Parameters:**
- TypeScript interfaces for complex parameter objects
- Optional parameters clearly marked with `?`
- Destructured parameters in React components
- Default values for optional parameters

**Return Values:**
- Explicit return types for public functions
- Use `void` for side-effect functions
- Promise types for async operations
- `QueryState<T>` pattern for data-fetching hooks

## Module Design

**Exports:**
- Named exports preferred: `export function compile()`, `export interface SlashCommand`
- Default exports for React components
- Barrel files minimal - direct imports preferred

**Context Pattern:**
```typescript
const Context = createContext<T | undefined>(undefined);

export function Provider({ children }) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useHook() {
  const context = useContext(Context);
  if (!context) throw new Error('useHook must be used within Provider');
  return context;
}
```

## TypeScript Configuration

**Strict Settings:**
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- `isolatedModules: true`

**Type Patterns:**
- Union types for enums: `type ViewMode = 'grid' | 'list'`
- Generic constraints where appropriate
- Interface composition with extends
- Readonly arrays for immutable data

## React Conventions

**Component Structure:**
- Props interfaces defined above component
- Functional components with TypeScript
- Use `React.ReactNode` for children props
- Context validation in hooks with descriptive error messages

**Hook Patterns:**
- Custom hooks follow `use*` naming
- Proper dependency arrays in useEffect/useMemo
- State management with TypeScript generics
- Error boundaries for component error handling

---

*Convention analysis: 2026-01-25*