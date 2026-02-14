/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // =========================================================================
    // Architectural boundaries (five-layer model)
    // =========================================================================
    {
      name: 'db-no-import-components',
      comment: 'Data layer (src/db) must not import from UI components',
      severity: 'error',
      from: { path: '^src/db/' },
      to: { path: '^src/components/' },
    },
    {
      name: 'types-only-import-types',
      comment: 'Type definitions should not import runtime code except other types',
      severity: 'warn',
      from: { path: '^src/types/' },
      to: {
        path: '^src/',
        pathNot: '^src/types/',
      },
    },
    {
      name: 'utils-no-import-components',
      comment: 'Utils must not depend on components (inverted dependency)',
      severity: 'error',
      from: { path: '^src/utils/' },
      to: { path: '^src/components/' },
    },
    {
      name: 'utils-no-import-contexts',
      comment: 'Utils must not depend on React contexts',
      severity: 'error',
      from: { path: '^src/utils/' },
      to: { path: '^src/contexts/' },
    },

    // =========================================================================
    // Circular dependency detection
    // =========================================================================
    {
      name: 'no-circular',
      comment: 'No circular dependencies allowed',
      severity: 'warn',
      from: {},
      to: { circular: true },
    },

    // =========================================================================
    // Orphan detection
    // =========================================================================
    {
      name: 'no-orphans',
      comment: 'Files must be reachable from entry points',
      severity: 'info',
      from: {
        orphan: true,
        pathNot: [
          '\\.test\\.tsx?$',
          '\\.spec\\.tsx?$',
          '\\.d\\.ts$',
          '^src/test/',
          '^src/examples/',
          '^src/types/',
        ],
      },
      to: {},
    },

    // =========================================================================
    // D3/React boundary (architectural truth: "D3 shows truth, React changes it")
    // =========================================================================
    {
      name: 'd3-no-import-react-state',
      comment: 'D3 modules should not import React state management (ThemeContext allowed for styling)',
      severity: 'warn',
      from: { path: '^src/d3/' },
      to: {
        path: '^src/(contexts|state)/',
        pathNot: '^src/contexts/ThemeContext\\.tsx$',
      },
    },
  ],

  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: './tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/[^/]+',
      },
    },
    exclude: {
      path: [
        'node_modules',
        'dist',
        'native',
        '\\.test\\.tsx?$',
        '\\.spec\\.tsx?$',
      ],
    },
  },
};
