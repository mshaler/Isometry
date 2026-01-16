/// <reference types="vite/client" />

// Declare modules for raw SQL imports
declare module '*.sql?raw' {
  const content: string;
  export default content;
}
