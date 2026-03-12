/// <reference types="vite/client" />

// Phase 74: Compile-time constant for PerfTrace instrumentation.
// True in dev/test builds; false (and tree-shaken) in production.
declare const __PERF_INSTRUMENTATION__: boolean;
