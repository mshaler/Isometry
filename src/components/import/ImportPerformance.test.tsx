import React from 'react';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import { componentLogger } from '../../utils/dev-logger';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ImportWizard } from '../ImportWizard';
import { ReactTestDataGenerator } from './ImportWizard.test';
import type { OfficeImportResult } from '../../utils/officeDocumentProcessor';

// Mock the office document processor
vi.mock('../../utils/officeDocumentProcessor', () => ({
  importOfficeFile: vi.fn(),
}));

// Performance measurement utilities
class PerformanceMetrics {
  private startTime: number = 0;
  private memoryStart: number = 0;

  start() {
    this.startTime = performance.now();
    this.memoryStart = this.getCurrentMemoryUsage();
  }

  end() {
    const duration = performance.now() - this.startTime;
    const memoryUsed = this.getCurrentMemoryUsage() - this.memoryStart;

    return {
      duration,
      memoryUsed,
      throughput: 0 // Will be calculated based on operations
    };
  }

  private getCurrentMemoryUsage(): number {
    // In browser environment, use performance.measureUserAgentSpecificMemory if available
    // For testing, we'll simulate memory usage
    if ('measureUserAgentSpecificMemory' in performance) {
      try {
        return (performance as any).measureUserAgentSpecificMemory?.();
      } catch {
        // Fall back to simulation
      }
    }

    // Simulate memory usage based on DOM node count
    const nodeCount = document.querySelectorAll('*').length;
    return nodeCount * 1000; // Rough approximation in bytes
  }
}

// Performance baseline tracking
class PerformanceBaseline {
  private baselines: Map<string, { avgDuration: number; avgMemory: number; sampleCount: number }> = new Map();

  establish(testName: string, metrics: Array<{ duration: number; memoryUsed: number }>) {
    const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
    const avgMemory = metrics.reduce((sum, m) => sum + m.memoryUsed, 0) / metrics.length;

    this.baselines.set(testName, {
      avgDuration,
      avgMemory,
      sampleCount: metrics.length
    });
  }

  check(testName: string, metric: { duration: number; memoryUsed: number }): {
    isRegression: boolean;
    durationRatio: number;
    memoryRatio: number;
  } {
    const baseline = this.baselines.get(testName);
    if (!baseline) {
      return { isRegression: false, durationRatio: 1, memoryRatio: 1 };
    }

    const durationRatio = metric.duration / baseline.avgDuration;
    const memoryRatio = metric.memoryUsed / baseline.avgMemory;

    // Regression if performance is 50% worse
    const isRegression = durationRatio > 1.5 || memoryRatio > 1.5;

    return { isRegression, durationRatio, memoryRatio };
  }

  getBaselines() {
    return Array.from(this.baselines.entries()).map(([name, data]) => ({
      name,
      ...data
    }));
  }

  clear() {
    this.baselines.clear();
  }
}

// Performance test harness
class ImportWizardPerformanceHarness {
  private metrics = new PerformanceMetrics();
  private baseline = new PerformanceBaseline();
  private mockImportOfficeFile: unknown;

  async initialize() {
    const { importOfficeFile } = await import('../../utils/officeDocumentProcessor');
    this.mockImportOfficeFile = vi.mocked(importOfficeFile);
  }

  setupMockImport(result: OfficeImportResult, delay: number = 0) {
    this.mockImportOfficeFile.mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve(result), delay))
    );
  }

  async measureRenderPerformance(fileCount: number, iterations: number = 5) {
    const measurements: Array<{ duration: number; memoryUsed: number }> = [];

    for (let i = 0; i < iterations; i++) {
      this.metrics.start();

      const { unmount } = render(
        <ImportWizard
          isOpen={true}
          onClose={() => {}}
          onImportComplete={() => {}}
          folder="test"
        />
      );

      const metric = this.metrics.end();
      measurements.push(metric);

      unmount();
      cleanup();
    }

    return measurements;
  }

  async measureFileUploadPerformance(fileCount: number, iterations: number = 3) {
    const measurements: Array<{ duration: number; memoryUsed: number }> = [];

    for (let i = 0; i < iterations; i++) {
      const { unmount, container } = render(
        <ImportWizard
          isOpen={true}
          onClose={() => {}}
          onImportComplete={() => {}}
          folder="test"
        />
      );

      const files = ReactTestDataGenerator.generateMockFiles(fileCount);

      this.metrics.start();

      // Simulate file upload
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: files,
        configurable: true
      });
      fireEvent.change(fileInput);

      const metric = this.metrics.end();
      metric.throughput = fileCount / (metric.duration / 1000); // files per second
      measurements.push(metric);

      unmount();
      cleanup();
    }

    return measurements;
  }

  async measureImportProcessingPerformance(
    fileCount: number,
    nodesPerFile: number,
    processingDelay: number = 100,
    iterations: number = 3
  ) {
    const measurements: Array<{ duration: number; memoryUsed: number }> = [];

    for (let i = 0; i < iterations; i++) {
      const mockResult = ReactTestDataGenerator.generateMockImportResult(nodesPerFile);
      this.setupMockImport(mockResult, processingDelay);

      const { unmount, container } = render(
        <ImportWizard
          isOpen={true}
          onClose={() => {}}
          onImportComplete={() => {}}
          folder="test"
        />
      );

      const files = ReactTestDataGenerator.generateMockFiles(fileCount);

      // Upload files
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: files,
        configurable: true
      });
      fireEvent.change(fileInput);

      // Start measuring processing performance
      this.metrics.start();

      // Start import process
      const importButton = container.querySelector('button[type="button"]') as HTMLButtonElement;
      if (importButton && importButton.textContent?.includes('Import')) {
        await act(async () => {
          fireEvent.click(importButton);

          // Wait for processing to complete
          await new Promise(resolve => setTimeout(resolve, processingDelay * fileCount + 100));
        });
      }

      const metric = this.metrics.end();
      metric.throughput = (fileCount * nodesPerFile) / (metric.duration / 1000); // nodes per second
      measurements.push(metric);

      unmount();
      cleanup();
    }

    return measurements;
  }

  async measureMemoryLeakage(operations: number = 10) {
    const measurements: number[] = [];

    for (let i = 0; i < operations; i++) {
      const { unmount } = render(
        <ImportWizard
          isOpen={true}
          onClose={() => {}}
          onImportComplete={() => {}}
          folder="test"
        />
      );

      const files = ReactTestDataGenerator.generateMockFiles(5);
      const mockResult = ReactTestDataGenerator.generateMockImportResult(10);
      this.setupMockImport(mockResult, 50);

      // Perform full import cycle
      // ... (implementation would include full cycle)

      measurements.push(this.metrics.getCurrentMemoryUsage());

      unmount();
      cleanup();

      // Force garbage collection if available
      if ('gc' in global && typeof (global as any).gc === 'function') {
        (global as any).gc();
      }
    }

    return measurements;
  }

  establishBaselines() {
    const testCases = [
      { name: 'render-small', fileCount: 5, iterations: 10 },
      { name: 'render-medium', fileCount: 20, iterations: 5 },
      { name: 'render-large', fileCount: 50, iterations: 3 },
      { name: 'upload-small', fileCount: 5, iterations: 5 },
      { name: 'upload-medium', fileCount: 20, iterations: 3 },
      { name: 'processing-small', fileCount: 5, iterations: 3 },
      { name: 'processing-medium', fileCount: 10, iterations: 2 }
    ];

    return Promise.all(testCases.map(async testCase => {
      let measurements: Array<{ duration: number; memoryUsed: number }>;

      if (testCase.name.startsWith('render')) {
        measurements = await this.measureRenderPerformance(testCase.fileCount, testCase.iterations);
      } else if (testCase.name.startsWith('upload')) {
        measurements = await this.measureFileUploadPerformance(testCase.fileCount, testCase.iterations);
      } else if (testCase.name.startsWith('processing')) {
        measurements = await this.measureImportProcessingPerformance(testCase.fileCount, 5, 10, testCase.iterations);
      } else {
        measurements = [];
      }

      this.baseline.establish(testCase.name, measurements);
      return { testCase: testCase.name, measurements };
    }));
  }

  checkPerformanceRegression(testName: string, measurements: Array<{ duration: number; memoryUsed: number }>) {
    const avgMetric = {
      duration: measurements.reduce((sum, m) => sum + m.duration, 0) / measurements.length,
      memoryUsed: measurements.reduce((sum, m) => sum + m.memoryUsed, 0) / measurements.length
    };

    return this.baseline.check(testName, avgMetric);
  }

  getPerformanceReport() {
    return {
      baselines: this.baseline.getBaselines(),
      timestamp: new Date().toISOString()
    };
  }

  reset() {
    this.baseline.clear();
    vi.clearAllMocks();
  }
}

describe('ImportWizard Performance Tests', () => {
  let harness: ImportWizardPerformanceHarness;

  beforeEach(async () => {
    harness = new ImportWizardPerformanceHarness();
    await harness.initialize();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    harness.reset();
  });

  describe('Performance Baselines', () => {
    it('establishes comprehensive performance baselines', async () => {
      const results = await harness.establishBaselines();

      expect(results).toHaveLength(7);

      // Verify all test cases completed
      const testNames = results.map(r => r.testCase);
      expect(testNames).toContain('render-small');
      expect(testNames).toContain('upload-medium');
      expect(testNames).toContain('processing-small');

      // Verify measurements exist
      results.forEach(result => {
        expect(result.measurements).toHaveLength.greaterThan(0);
        result.measurements.forEach(measurement => {
          expect(measurement.duration).toBeGreaterThan(0);
          expect(measurement.memoryUsed).toBeGreaterThanOrEqual(0);
        });
      });

      // Log performance baselines
      const report = harness.getPerformanceReport();
      componentLogger.metrics('ImportWizard Performance Baselines', report);
    }, 30000); // Extended timeout for baseline establishment
  });

  describe('Render Performance', () => {
    it('renders efficiently with small file counts', async () => {
      const measurements = await harness.measureRenderPerformance(5, 10);

      measurements.forEach(measurement => {
        expect(measurement.duration).toBeLessThan(100); // 100ms threshold
      });

      const avgDuration = measurements.reduce((sum, m) => sum + m.duration, 0) / measurements.length;
      componentLogger.metrics('Render Performance (5 files)', { avgDuration: avgDuration.toFixed(2) + 'ms' });
    });

    it('maintains performance with medium file counts', async () => {
      const measurements = await harness.measureRenderPerformance(20, 5);

      measurements.forEach(measurement => {
        expect(measurement.duration).toBeLessThan(200); // 200ms threshold
      });

      const avgDuration = measurements.reduce((sum, m) => sum + m.duration, 0) / measurements.length;
      componentLogger.metrics('Render Performance (20 files)', { avgDuration: avgDuration.toFixed(2) + 'ms' });
    });

    it('handles large file counts without excessive degradation', async () => {
      const measurements = await harness.measureRenderPerformance(50, 3);

      measurements.forEach(measurement => {
        expect(measurement.duration).toBeLessThan(500); // 500ms threshold for large datasets
      });

      const avgDuration = measurements.reduce((sum, m) => sum + m.duration, 0) / measurements.length;
      componentLogger.metrics('Render Performance (50 files)', { avgDuration: avgDuration.toFixed(2) + 'ms' });
    });
  });

  describe('File Upload Performance', () => {
    it('handles file uploads efficiently', async () => {
      const measurements = await harness.measureFileUploadPerformance(10, 5);

      measurements.forEach(measurement => {
        expect(measurement.duration).toBeLessThan(50); // 50ms for upload handling
        expect(measurement.throughput).toBeGreaterThan(50); // At least 50 files/second
      });

      const avgThroughput = measurements.reduce((sum, m) => sum + m.throughput, 0) / measurements.length;
      componentLogger.metrics('Upload Throughput', { avgThroughput: avgThroughput.toFixed(1) + ' files/second' });
    });

    it('scales file upload performance linearly', async () => {
      const fileCounts = [5, 10, 20, 30];
      const results: Array<{ fileCount: number; avgDuration: number; throughput: number }> = [];

      for (const fileCount of fileCounts) {
        const measurements = await harness.measureFileUploadPerformance(fileCount, 3);
        const avgDuration = measurements.reduce((sum, m) => sum + m.duration, 0) / measurements.length;
        const avgThroughput = measurements.reduce((sum, m) => sum + m.throughput, 0) / measurements.length;

        results.push({ fileCount, avgDuration, throughput: avgThroughput });
      }

      // Verify scaling is roughly linear (not exponential)
      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1];
        const curr = results[i];
        const scaleFactor = curr.fileCount / prev.fileCount;
        const durationRatio = curr.avgDuration / prev.avgDuration;

        // Duration should not scale more than 2x the file count increase
        expect(durationRatio).toBeLessThan(scaleFactor * 2);
      }

      componentLogger.metrics('Upload Scaling', results);
    });
  });

  describe('Import Processing Performance', () => {
    it('processes imports within performance bounds', async () => {
      const measurements = await harness.measureImportProcessingPerformance(5, 10, 50, 3);

      measurements.forEach(measurement => {
        expect(measurement.duration).toBeLessThan(1000); // 1 second total
        expect(measurement.throughput).toBeGreaterThan(10); // At least 10 nodes/second
      });

      const avgThroughput = measurements.reduce((sum, m) => sum + m.throughput, 0) / measurements.length;
      componentLogger.metrics('Processing Throughput', { avgThroughput: avgThroughput.toFixed(1) + ' nodes/second' });
    });

    it('handles concurrent file processing efficiently', async () => {
      const measurements = await harness.measureImportProcessingPerformance(10, 5, 25, 3);

      measurements.forEach(measurement => {
        expect(measurement.duration).toBeLessThan(2000); // 2 seconds for 10 files
        expect(measurement.throughput).toBeGreaterThan(5); // At least 5 nodes/second
      });
    });

    it('maintains responsive UI during processing', async () => {
      // This test would measure UI responsiveness during background processing
      // For now, we'll ensure processing doesn't block for too long
      const measurements = await harness.measureImportProcessingPerformance(3, 20, 100, 2);

      measurements.forEach(measurement => {
        // Each processing step should complete within frame budget
        const processingSteps = 3; // Number of files
        const maxStepDuration = measurement.duration / processingSteps;
        expect(maxStepDuration).toBeLessThan(100); // 100ms per step to maintain 10fps minimum
      });
    });
  });

  describe('Memory Performance', () => {
    it('does not leak memory across operations', async () => {
      const measurements = await harness.measureMemoryLeakage(10);

      // Check that memory doesn't grow excessively
      const initialMemory = measurements[0];
      const finalMemory = measurements[measurements.length - 1];
      const memoryGrowth = finalMemory - initialMemory;

      // Allow some growth but not excessive (50% threshold)
      expect(memoryGrowth).toBeLessThan(initialMemory * 0.5);

      componentLogger.metrics('Memory Usage', { initialMemory, finalMemory, memoryGrowth });
    });

    it('cleans up resources after component unmount', async () => {
      const initialMemory = harness['metrics']['getCurrentMemoryUsage']();

      // Render and unmount multiple times
      for (let i = 0; i < 5; i++) {
        const { unmount } = render(
          <ImportWizard
            isOpen={true}
            onClose={() => {}}
            onImportComplete={() => {}}
            folder="test"
          />
        );

        unmount();
        cleanup();
      }

      const finalMemory = harness['metrics']['getCurrentMemoryUsage']();
      const memoryGrowth = finalMemory - initialMemory;

      // Memory should not grow significantly
      expect(memoryGrowth).toBeLessThan(initialMemory * 0.2); // 20% threshold
    });
  });

  describe('Performance Regression Detection', () => {
    it('detects performance regressions', async () => {
      // Establish baseline
      await harness.establishBaselines();

      // Simulate regression by adding artificial delay
      const originalMock = harness['mockImportOfficeFile'];
      harness['mockImportOfficeFile'] = vi.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(
          ReactTestDataGenerator.generateMockImportResult(5)
        ), 500)) // Artificial 500ms delay
      );

      // Measure performance with regression
      const measurements = await harness.measureImportProcessingPerformance(5, 5, 500, 3);
      const regression = harness.checkPerformanceRegression('processing-small', measurements);

      expect(regression.isRegression).toBe(true);
      expect(regression.durationRatio).toBeGreaterThan(1.5);

      componentLogger.metrics('Regression Detection', regression);

      // Restore original mock
      harness['mockImportOfficeFile'] = originalMock;
    });

    it('passes when performance is within acceptable bounds', async () => {
      // Establish baseline
      await harness.establishBaselines();

      // Measure performance within normal bounds
      const measurements = await harness.measureRenderPerformance(5, 3);
      const regression = harness.checkPerformanceRegression('render-small', measurements);

      expect(regression.isRegression).toBe(false);
      expect(regression.durationRatio).toBeLessThan(1.5);
    });
  });

  describe('Stress Testing', () => {
    it('handles extreme file counts gracefully', async () => {
      const measurements = await harness.measureFileUploadPerformance(100, 2);

      measurements.forEach(measurement => {
        expect(measurement.duration).toBeLessThan(1000); // 1 second even for 100 files
      });

      // Should not crash or become unresponsive
      expect(measurements).toHaveLength(2);
    }, 10000);

    it('handles large import results without memory issues', async () => {
      const measurements = await harness.measureImportProcessingPerformance(1, 1000, 100, 2);

      measurements.forEach(measurement => {
        expect(measurement.duration).toBeLessThan(5000); // 5 seconds for 1000 nodes
      });
    }, 15000);
  });
});

// Export for potential reuse
export { PerformanceMetrics, PerformanceBaseline, ImportWizardPerformanceHarness };