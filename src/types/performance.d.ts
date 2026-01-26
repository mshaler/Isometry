// Enhanced Performance interfaces for strict TypeScript compliance
interface PerformanceMetrics {
  [key: string]: number | PerformanceMetricValue;
}

interface PerformanceMetricValue {
  average: number;
  min: number;
  max: number;
  latest: number;
  samples: number;
}

interface D3PerformanceStats {
  [key: string]: number | PerformanceMetricValue;
}

interface WebKitEventDetail {
  message: unknown;
  data?: unknown;
}

interface ProcessInfo {
  pid: number;
  command: string;
  args: string[];
}
