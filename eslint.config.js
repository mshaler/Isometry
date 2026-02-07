import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // ==========================================================================
  // TypeScript source files
  // ==========================================================================
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      sonarjs,
    },
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // --- Level 2: Basic lint rules ---
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',

      // --- Level 3: Complexity rules (sonarjs) ---
      'sonarjs/cognitive-complexity': ['warn', 20],       // warn at 20, tighten later
      'complexity': ['warn', 15],                          // cyclomatic complexity

      // --- Level 4: Max line length ---
      'max-len': ['error', {
        code: 120,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
        ignoreComments: false,        // long comments are still hard to read
      }],

      // --- Level 5: Max file length ---
      'max-lines': ['warn', {
        max: 300,
        skipBlankLines: true,
        skipComments: true,
      }],

      // --- Additional structural rules ---
      'max-params': ['warn', 4],                           // functions with >4 params need an options object
      'max-depth': ['warn', 4],                            // max nesting depth
      'no-nested-ternary': 'warn',                         // ternary inside ternary is unreadable (ratchet to error later)
    },
  },

  // ==========================================================================
  // JS files (server, scripts)
  // ==========================================================================
  {
    files: ['src/**/*.js', 'src/server/**/*.js'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      }
    },
    rules: {
      'no-console': 'off',
      'no-redeclare': 'off',
    }
  },

  // ==========================================================================
  // Test files — relaxed rules
  // ==========================================================================
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/test/**/*.{ts,tsx}'],
    rules: {
      'max-lines': 'off',                                 // test files can be long
      'max-len': ['error', { code: 150, ignoreStrings: true, ignoreUrls: true }],
      'sonarjs/cognitive-complexity': 'off',               // test setup can be complex
      '@typescript-eslint/no-explicit-any': 'off',         // mocking often needs any
    },
  },

  // ==========================================================================
  // Ignores
  // ==========================================================================
  {
    ignores: [
      'node_modules',
      'dist',
      '*.js',                          // root-level config files
      'native/**',
      'src/dsl/grammar/parser.cjs',    // generated file
      '**/*.d.ts',
      'src/test-sql-*.js',             // standalone test scripts, not app code
    ],
  }
);
