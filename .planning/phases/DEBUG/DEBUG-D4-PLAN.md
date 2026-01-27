---
phase: D4
plan: DEBUG-D4
type: execute
wave: 1
depends_on: ["DEBUG-D1", "DEBUG-D2", "DEBUG-D3"]
files_modified: [
  "package.json",
  "vite.config.ts",
  "src/utils/",
  "src/components/",
  "src/services/",
  "src/hooks/",
  ".gitignore",
  "tsconfig.json"
]
autonomous: true

must_haves:
  truths:
    - "Bundle size optimized with tree-shaking and dead code elimination"
    - "Large files are modularized and properly organized"
    - "Unused dependencies are identified and removed"
    - "Build performance is optimized with proper configuration"
    - "Code organization follows established patterns"
  artifacts:
    - path: "src/utils/"
      provides: "Utility function modularization"
      pattern: "export.*function|export.*const"
    - path: "vite.config.ts"
      provides: "Bundle optimization configuration"
      pattern: "build.*optimization|rollup.*treeshake"
    - path: "package.json"
      provides: "Dependency cleanup"
      pattern: "dependencies|devDependencies"
    - path: "src/components/"
      provides: "Component organization validation"
      pattern: "export.*default|export.*function"
  key_links:
    - from: "Bundle analysis"
      to: "dependency optimization"
      via: "webpack-bundle-analyzer or vite-bundle-analyzer"
      pattern: "bundle-analyzer.*analyze"
    - from: "Large file detection"
      to: "code splitting"
      via: "dynamic imports"
      pattern: "import\\(.*\\)|React\\.lazy"
---

<objective>
Final DEBUG phase focusing on code organization, bundle size optimization, and build performance enhancement.

Purpose: Achieve optimal code organization with minimal bundle size, clean dependency trees, and enhanced build performance for production deployment excellence.

Output: Production-optimized codebase with excellent organization, minimal bundle size, clean dependencies, and enhanced build performance.
</objective>

<execution_context>
@/Users/mshaler/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mshaler/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/DEBUG/DEBUG-D3-SUMMARY.md

# DEBUG Foundation Excellence Established
✅ DEBUG-D1: Test infrastructure with >97% performance improvement
✅ DEBUG-D2: Memory leak detection with comprehensive timer/listener cleanup
✅ DEBUG-D3: Console statement optimization with 58 migrated to structured logger

# Current Codebase Analysis
@package.json (dependency analysis for unused packages)
@vite.config.ts (build configuration optimization)
@src/utils/ (utility function organization and tree-shaking)
@src/components/ (component size and organization analysis)
@src/services/ (service layer optimization)
@src/hooks/ (custom hook organization)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Bundle Size Analysis and Dependency Audit</name>
  <files>
    package.json
    vite.config.ts
  </files>
  <action>
    Comprehensive bundle analysis and dependency cleanup:

    **Package.json Dependency Audit:**
    - Analyze all dependencies and devDependencies for actual usage
    - Identify unused packages using depcheck or similar analysis
    - Remove outdated packages with known security vulnerabilities
    - Verify all dependencies are actually imported/used in codebase
    - Check for duplicate dependencies with different versions

    **Bundle Size Analysis:**
    - Install and configure vite-bundle-analyzer for bundle visualization
    - Identify largest bundle chunks and optimization opportunities
    - Analyze tree-shaking effectiveness for imported libraries
    - Detect opportunities for dynamic imports and code splitting
    - Document current bundle size as baseline for optimization

    **Vite Configuration Optimization:**
    - Enable aggressive tree-shaking with proper sideEffects configuration
    - Configure build.rollupOptions for optimal chunk splitting
    - Add bundle size limits and warnings for large chunks
    - Optimize minification settings for production builds
    - Configure proper source map handling for debugging vs. size

    Pattern: Remove unused dependencies, optimize build configuration, enable tree-shaking.
    Avoid: Keeping unused packages, inefficient bundling, large monolithic chunks.
  </action>
  <verify>
    npm ls --depth=0
    npx depcheck
    npm run build && ls -la dist/
    grep -n "sideEffects\|treeshake\|rollupOptions" vite.config.ts
  </verify>
  <done>Bundle size baseline established, unused dependencies removed, and build configuration optimized for tree-shaking and efficient bundling</done>
</task>

<task type="auto">
  <name>Task 2: Large File Analysis and Code Organization</name>
  <files>
    src/utils/
    src/components/
    src/services/
    src/hooks/
  </files>
  <action>
    Systematic large file analysis and modularization:

    **File Size Analysis:**
    - Identify files >500 lines that could benefit from modularization
    - Analyze function/component complexity and coupling
    - Find opportunities for utility function extraction
    - Detect code duplication across large files
    - Map import/export relationships for optimization

    **Utility Function Organization:**
    - Review src/utils/ for proper modularization and tree-shaking
    - Ensure each utility is properly exported and typed
    - Combine related utilities into logical modules
    - Extract common patterns into reusable utility functions
    - Verify utilities are properly tree-shakeable

    **Component Organization Validation:**
    - Analyze component file sizes and complexity
    - Verify proper component composition over large monoliths
    - Check for unnecessary component re-renders or heavy computation
    - Validate proper prop interfaces and TypeScript usage
    - Ensure components follow established patterns

    **Service Layer Optimization:**
    - Review service classes for proper modularization
    - Ensure services are properly singleton where appropriate
    - Validate service interfaces and dependency injection
    - Check for proper error handling and logging integration
    - Optimize service initialization and cleanup

    Pattern: Small, focused modules with clear responsibilities and proper exports.
    Avoid: Large monolithic files, unclear module boundaries, poor tree-shaking.
  </action>
  <verify>
    find src/ -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -n | tail -20
    grep -r "export" src/utils/ | wc -l
    grep -r "default export\|export default" src/components/ | wc -l
    find src/ -name "*.ts" -o -name "*.tsx" -exec grep -l "TODO\|FIXME\|XXX" {} \;
  </verify>
  <done>Large files analyzed and modularized where appropriate, utility functions properly organized, and code organization follows established patterns</done>
</task>

<task type="auto">
  <name>Task 3: Build Performance Enhancement and Final Optimization</name>
  <files>
    vite.config.ts
    tsconfig.json
    .gitignore
  </files>
  <action>
    Build performance optimization and final configuration cleanup:

    **TypeScript Configuration Optimization:**
    - Review tsconfig.json for optimal build performance settings
    - Enable incremental compilation with tsBuildInfoFile
    - Optimize moduleResolution and target settings
    - Configure proper exclude patterns for faster compilation
    - Ensure strict type checking while maintaining build speed

    **Vite Configuration Enhancement:**
    - Optimize dev server configuration for development speed
    - Configure proper caching strategies for dependencies
    - Add build performance monitoring and reporting
    - Optimize HMR (Hot Module Replacement) configuration
    - Configure proper asset handling and optimization

    **Build Artifact Optimization:**
    - Ensure .gitignore properly excludes build artifacts
    - Configure proper dist/ directory structure
    - Optimize asset compression and caching headers
    - Add build size reporting and tracking
    - Configure proper environment variable handling

    **Performance Monitoring Setup:**
    - Add build time tracking and reporting
    - Configure bundle size monitoring with limits
    - Set up automated performance regression detection
    - Add development server startup time optimization
    - Configure proper error reporting during builds

    Pattern: Fast incremental builds, optimized caching, proper artifact handling.
    Avoid: Slow builds, cache invalidation issues, bloated build artifacts.
  </action>
  <verify>
    npm run build --verbose
    grep -n "incremental\|tsBuildInfoFile" tsconfig.json
    grep -n "cache\|hmr\|server" vite.config.ts
    ls -la dist/ && du -sh dist/*
  </verify>
  <done>Build performance optimized with fast incremental compilation, proper caching, and efficient artifact generation</done>
</task>

</tasks>

<verification>
## Code Organization and Bundle Optimization Validation

1. **Bundle Size Verification:**
   ```bash
   # Verify bundle size optimization
   npm run build && ls -lah dist/
   npx vite-bundle-analyzer dist/

   # Check dependency usage
   npx depcheck
   npm audit --audit-level moderate
   ```

2. **File Organization Audit:**
   ```bash
   # Analyze large files and complexity
   find src/ -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -n | tail -10

   # Verify proper exports and tree-shaking
   grep -r "export" src/utils/ | grep -v test
   grep -r "sideEffects" package.json vite.config.ts
   ```

3. **Build Performance Validation:**
   ```bash
   # Test build performance
   time npm run build
   time npm run dev &
   sleep 5 && kill $!

   # Verify TypeScript compilation speed
   time npx tsc --noEmit
   ```

4. **Dependency Health Check:**
   ```bash
   # Verify no unused dependencies
   npx depcheck --ignores="@types/*,vite,typescript"

   # Check for outdated packages
   npm outdated
   ```
</verification>

<success_criteria>
- [ ] Bundle size reduced through tree-shaking and dependency optimization
- [ ] Large files (>500 lines) analyzed and modularized where beneficial
- [ ] All unused dependencies identified and removed from package.json
- [ ] Build performance enhanced with optimized TypeScript and Vite configuration
- [ ] Code organization follows established patterns with proper exports
- [ ] Development server startup time optimized for efficient workflow
- [ ] Production build artifacts properly optimized and compressed
- [ ] Bundle analysis reveals efficient chunk splitting and tree-shaking
</success_criteria>

<output>
After completion, create `.planning/phases/DEBUG/DEBUG-D4-SUMMARY.md`
</output>