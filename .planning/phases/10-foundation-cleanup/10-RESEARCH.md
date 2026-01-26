# Phase 10: Foundation Cleanup - Research

**Researched:** 2026-01-26
**Domain:** TypeScript/ESLint production code quality and cleanup
**Confidence:** HIGH

## Summary

Foundation Cleanup focuses on achieving production-ready code quality through comprehensive error elimination, type safety enforcement, and dependency cleanup. Current analysis shows 2 errors and 176 warnings in ESLint output, with primary issues being unused variables and explicit `any` types. The codebase has successfully eliminated sql.js dependencies but retains some documentation references that need cleanup.

The standard approach involves upgrading to ESLint's modern flat config with strict TypeScript rules, implementing comprehensive unused variable handling patterns, eliminating all explicit `any` types through safer alternatives, and removing unused dependencies. Modern tooling in 2025 emphasizes strict type checking with proper escape mechanisms for edge cases.

**Primary recommendation:** Implement ESLint strict-type-checked preset with flat config, systematic `any` elimination using `unknown` and type guards, and comprehensive unused variable cleanup using underscore prefix convention.

## Standard Stack

The established libraries/tools for TypeScript/ESLint production cleanup:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @typescript-eslint/eslint-plugin | ^8.x | TypeScript-specific linting | Industry standard for TS projects |
| @typescript-eslint/parser | ^8.x | TypeScript AST parsing | Required for type-aware linting |
| eslint | ^9.x | JavaScript/TypeScript linting | De facto standard linter |
| typescript | ^5.x | Type checking and compilation | Essential for type safety |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| globals | ^15.x | Environment globals definition | Mixed Node/browser projects |
| depcheck | ^1.x | Unused dependency detection | Dependency cleanup |
| @eslint/js | ^9.x | Core ESLint recommended rules | Base configuration |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ESLint 9 flat config | Legacy .eslintrc | Flat config is future-proof, better TypeScript support |
| @typescript-eslint strict | Basic recommended | Strict catches more issues but requires higher TS proficiency |
| unknown type | any type | unknown is safer but requires more type guards |

**Installation:**
```bash
npm install --save-dev @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint typescript
```

## Architecture Patterns

### Recommended ESLint Flat Config Structure
```
eslint.config.js          # Flat config with environment-specific rules
├── TypeScript rules       # Strict type checking for .ts/.tsx
├── JavaScript rules       # Node.js globals for .js files
└── Ignores               # node_modules, dist, native/
```

### Pattern 1: Mixed Environment Configuration
**What:** Separate rule sets for browser/Node.js environments using flat config
**When to use:** Projects with both frontend React and backend server code
**Example:**
```typescript
// Source: ESLint flat config documentation + Advanced Frontends 2025
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  ...tseslint.configs.strictTypeChecked,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { project: './tsconfig.json' }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['src/server/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' }
  }
);
```

### Pattern 2: Unused Variable Handling
**What:** Underscore prefix convention for intentionally unused parameters
**When to use:** Function parameters required by interface but not used
**Example:**
```typescript
// Source: typescript-eslint documentation
// Good: Use underscore prefix for unused params
function handleEvent(_event: Event, data: any): void {
  console.log(data);
}

// Bad: Triggers no-unused-vars warning
function handleEvent(event: Event, data: any): void {
  console.log(data);
}
```

### Pattern 3: any Type Elimination
**What:** Replace explicit `any` with `unknown` and type guards
**When to use:** External API responses, legacy code migration
**Example:**
```typescript
// Source: TypeScript Best Practices 2025
// Good: Use unknown with type guards
function processResponse(data: unknown): ProcessedData {
  if (typeof data === 'object' && data !== null && 'id' in data) {
    return { id: (data as { id: string }).id };
  }
  throw new Error('Invalid response format');
}

// Bad: Explicit any bypasses type checking
function processResponse(data: any): ProcessedData {
  return { id: data.id };
}
```

### Anti-Patterns to Avoid
- **Legacy .eslintrc format:** ESLint 10 will deprecate old config format
- **Blanket `any` usage:** Use `unknown` with type guards instead
- **Disabled rule inheritance:** Fix issues rather than suppress warnings

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unused dependency detection | Custom package.json parser | depcheck | Handles complex dependency trees, peer deps |
| Environment globals setup | Manual global definitions | globals package | Comprehensive, maintained definitions |
| TypeScript strict config | Custom rule combinations | tseslint.configs.strictTypeChecked | Expert-curated rule set |
| Type guards for unknown | Custom type checking | Built-in type predicates | Better inference, performance |

**Key insight:** Modern ESLint and TypeScript tooling has mature ecosystem solutions that handle edge cases and complex scenarios better than custom implementations.

## Common Pitfalls

### Pitfall 1: Upgrading to Flat Config Too Aggressively
**What goes wrong:** Breaking existing configuration without testing migration
**Why it happens:** Flat config syntax is significantly different from legacy format
**How to avoid:** Use typescript-eslint migration guide, test incrementally
**Warning signs:** Sudden rule failures, unrecognized configuration options

### Pitfall 2: Over-strict Type Checking in Legacy Code
**What goes wrong:** Applying strictTypeChecked to poorly-typed legacy code causes overwhelming errors
**Why it happens:** Legacy code may have fundamental type safety issues
**How to avoid:** Migrate gradually using `@typescript-eslint/no-explicit-any` warnings first
**Warning signs:** Hundreds of type errors, team resistance to fixes

### Pitfall 3: Incorrect Unused Variable Configuration
**What goes wrong:** Legitimate unused parameters get flagged or vice versa
**Why it happens:** argsIgnorePattern doesn't match team conventions
**How to avoid:** Establish consistent underscore prefix convention
**Warning signs:** Frequent ESLint disable comments, inconsistent variable naming

### Pitfall 4: Mixed Environment Global Conflicts
**What goes wrong:** Node.js and browser globals conflict causing undefined variable errors
**Why it happens:** Improper globals configuration in flat config
**How to avoid:** Use file-specific configuration with appropriate globals
**Warning signs:** 'process is not defined' in browser code, 'window is not defined' in Node

## Code Examples

Verified patterns from official sources:

### ESLint Flat Config Migration
```javascript
// Source: ESLint flat config migration guide
// Before (.eslintrc.js)
module.exports = {
  env: { browser: true, node: true },
  extends: ['@typescript-eslint/recommended'],
  rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] }
};

// After (eslint.config.js)
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  }
);
```

### Unknown Type Usage
```typescript
// Source: TypeScript handbook + avoiding anys blog
function parseJSON(text: string): unknown {
  return JSON.parse(text);
}

function processUser(userData: unknown): User {
  if (typeof userData === 'object' && userData !== null) {
    const obj = userData as Record<string, unknown>;
    if (typeof obj.name === 'string' && typeof obj.id === 'number') {
      return { name: obj.name, id: obj.id };
    }
  }
  throw new Error('Invalid user data');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| .eslintrc config | Flat config (eslint.config.js) | ESLint 9.0 (2024) | Better TypeScript integration, clearer inheritance |
| any type escape hatches | unknown with type guards | TypeScript 3.0+ | Safer type narrowing, better inference |
| Environment via env property | globals package + languageOptions | ESLint flat config | More explicit, no hidden global injection |
| Separate lint commands | Unified flat config | ESLint 9.0 | Single configuration for multiple environments |

**Deprecated/outdated:**
- .eslintrc format: Will be removed in ESLint 10.0
- env property: Replaced by languageOptions.globals in flat config
- any as escape mechanism: unknown is preferred for type safety

## Open Questions

Things that couldn't be fully resolved:

1. **Legacy sql.js Reference Cleanup**
   - What we know: Documentation and comments reference sql.js but no functional dependencies remain
   - What's unclear: Whether these references serve historical/migration documentation value
   - Recommendation: Remove functional references, preserve key migration history in dedicated docs

2. **Unused Dependencies Impact**
   - What we know: depcheck identifies node-pty, react-leaflet as unused dependencies
   - What's unclear: Whether these are planned for near-future features or truly unused
   - Recommendation: Audit each unused dependency for planned usage before removal

3. **ESLint Environment Warning**
   - What we know: `eslint-env` comments trigger deprecation warnings in flat config
   - What's unclear: All locations where these comments exist in the codebase
   - Recommendation: Search and replace with appropriate global definitions

## Sources

### Primary (HIGH confidence)
- ESLint flat config migration guide - Official documentation
- typescript-eslint.io/users/configs/ - Official TypeScript ESLint configurations
- TypeScript handbook (typescriptlang.org) - Official TypeScript documentation

### Secondary (MEDIUM confidence)
- Advanced Frontends "Modern Linting in 2025" - Verified with official sources
- DEV Community "TypeScript Best Practices 2025" - Cross-referenced with official docs
- Medium migration guides - Verified against official ESLint/TypeScript docs

### Tertiary (LOW confidence)
- GitHub discussions on environment configuration - Community solutions
- Stack Overflow patterns - Need official verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official documentation and established packages
- Architecture: HIGH - Verified patterns from official sources
- Pitfalls: MEDIUM - Based on common migration experiences and documentation warnings

**Research date:** 2026-01-26
**Valid until:** 2026-02-26 (30 days for stable tooling, but ESLint 10 may affect timelines)