/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

// Declare modules for raw SQL imports
declare module '*.sql?raw' {
  const content: string;
  export default content;
}

// Extend ImportMetaEnv interface for our environment variables
interface ImportMetaEnv {
  readonly VITE_ANTHROPIC_API_KEY?: string;
  // add other VITE_ variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
