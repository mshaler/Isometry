# Stack Research

**Domain:** Error Elimination for Hybrid React/Swift Applications
**Researched:** 2026-01-26
**Confidence:** HIGH

## Recommended Stack

### Core Error Detection Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Biome | 2.3.11+ | TypeScript/React linting & formatting | 10-100x faster than ESLint/Prettier, all-in-one toolchain, 340+ rules from ESLint ecosystem |
| TypeScript | 5.0+ | Type safety with strict mode | Essential for catching sql.js removal issues, null checks, undefined handling |
| SwiftLint | 0.63.0+ | Swift style and convention enforcement | Industry standard for Swift projects, prevents common Swift pitfalls |
| SwiftFormat | 0.58.1+ | Swift code formatting | Complements SwiftLint by auto-fixing style violations, removes cognitive load |

### Dead Code Elimination Tools

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Knip | 5.43.0+ | Dead code detection for JS/TS | Primary tool for finding unused exports, dependencies, and files |
| TypeScript Remove (tsr) | 1.0+ | Automated dead code removal | After Knip identifies dead code, tsr can safely remove it |
| ts-unused-exports | 10.1+ | Export-specific analysis | Fallback when Knip's analysis is insufficient |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| TypeScript Strict Mode | Compile-time error detection | Enable all strict flags: noImplicitAny, strictNullChecks, strictFunctionTypes |
| Xcode Static Analyzer | Swift compile-time analysis | Built into Xcode, catches memory issues and logic errors |
| Tree-shaking (Vite/Webpack) | Bundle optimization | Removes unused code at build time, complements source-level cleanup |

## Installation

```bash
# React/TypeScript error elimination
npm install -D @biomejs/biome typescript@^5.0
npm install -D knip tsr ts-unused-exports

# Swift tools (via Homebrew - recommended for team consistency)
brew install swiftlint swiftformat

# Or via Swift Package Manager (for project-specific versions)
# Add to Package.swift dependencies:
# .package(url: "https://github.com/realm/SwiftLint", from: "0.63.0")
# .package(url: "https://github.com/nicklockwood/SwiftFormat", from: "0.58.1")
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Biome | ESLint + Prettier | Large existing ESLint config with custom rules; need typescript-eslint type checking |
| Knip | ts-prune | Legacy projects that can't migrate; ts-prune is now in maintenance mode |
| SwiftLint | No linting | Never - Swift projects should always use SwiftLint for consistency |
| TypeScript strict | Gradual typing | Only during migration phase; strict mode is mandatory for error elimination |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| sql.js references | Being removed from codebase | Native SQLite bridge to Swift layer |
| ESLint + Prettier combo | Performance bottleneck (45s vs 0.8s for 10k files) | Biome all-in-one toolchain |
| Manual dead code detection | Error-prone and time-consuming | Automated tools: Knip + tsr |
| TypeScript any types | Defeats type safety purpose | Explicit typing with strict mode enabled |

## Stack Patterns by Variant

**If migrating from ESLint:**
- Use Biome's migration tool: `npx @biomejs/biome migrate eslint`
- Enable all Biome rules that match existing ESLint config
- Because Biome provides 97% Prettier compatibility with better performance

**If sql.js cleanup is primary goal:**
- Use Knip to identify all sql.js imports and dependencies
- Use tsr with `--write` flag to remove detected dead code
- Because automated removal is safer than manual refactoring

**If Swift warnings are blocking builds:**
- Enable SwiftLint as build phase in Xcode
- Use SwiftFormat pre-commit hook for consistent formatting
- Because Swift compilation strictness catches runtime issues early

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Biome 2.3.11 | TypeScript 5.0+ | Full type-aware linting requires TS 5.0+ |
| SwiftLint 0.63.0 | Swift 5.9+ | Matches Isometry's current Swift version requirement |
| Knip 5.43.0 | Node.js 18+ | Requires modern Node for performance optimizations |
| tsr 1.0+ | TypeScript 4.0+ | Peer dependency, works with existing TS versions |

## Configuration for Isometry

### Biome Configuration (biome.json)
```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "error"
      },
      "correctness": {
        "noUnusedImports": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  },
  "files": {
    "include": ["src/**/*.ts", "src/**/*.tsx"],
    "ignore": ["dist/**", "node_modules/**"]
  }
}
```

### TypeScript Strict Configuration (tsconfig.json)
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### SwiftLint Configuration (.swiftlint.yml)
```yaml
opt_in_rules:
  - explicit_init
  - force_unwrapping
  - unused_import
  - unused_declaration
disabled_rules:
  - line_length  # Handled by SwiftFormat
analyzer_rules:
  - unused_import
  - unused_declaration
```

## Sources

- [Biome GitHub Releases](https://github.com/biomejs/biome/releases) — Current version verification
- [SwiftLint GitHub](https://github.com/realm/SwiftLint) — Swift linting best practices
- [Knip Documentation](https://knip.dev) — Dead code detection methodology
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html) — Strict mode configuration
- Performance benchmarks: Biome vs ESLint (2026 community analysis) — MEDIUM confidence

---
*Stack research for: Hybrid React/Swift Error Elimination*
*Researched: 2026-01-26*