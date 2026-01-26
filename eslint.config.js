import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
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
        // ES modules don't have __dirname and __filename
        // When needed, they must be created from import.meta.url
      }
    },
    rules: {
      'no-console': 'off',
      'no-redeclare': 'off' // Allow redeclaration for ES module __dirname/__filename workarounds
    }
  },
  {
    ignores: ['node_modules', 'dist', '*.js', 'native/**', 'src/dsl/grammar/parser.cjs', '**/*.d.ts'],
  }
);
