// Isometry v6.0 — Phase 74: PerfTrace utility unit tests
//
// Requirements: PROF-01, PROF-02, PROF-03
// Tests compile-away instrumentation wrapper over performance.mark/measure.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// __PERF_INSTRUMENTATION__ must be true in test env (not production).
// Vite's define constant is not processed by vitest unless added to vitest.config.
// We declare the global here as true so the module code branches correctly.
declare const __PERF_INSTRUMENTATION__: boolean;

// Polyfill: node environment has performance but we need to ensure it's fresh.
// Import after stubbing so the module picks up the global.
import { clearTraces, endTrace, getTraces, startTrace } from '../../src/profiling/PerfTrace';

describe('PerfTrace', () => {
  beforeEach(() => {
    // Reset performance entries between tests
    performance.clearMarks();
    performance.clearMeasures();
  });

  afterEach(() => {
    performance.clearMarks();
    performance.clearMeasures();
  });

  describe('startTrace / endTrace / getTraces', () => {
    it('creates a measure with duration >= 0 after startTrace + endTrace', () => {
      startTrace('test:basic');
      endTrace('test:basic');
      const entries = getTraces('test:basic');
      expect(entries.length).toBe(1);
      expect(entries[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('accumulates multiple measures for the same name', () => {
      startTrace('test:multi');
      endTrace('test:multi');
      startTrace('test:multi');
      endTrace('test:multi');
      const entries = getTraces('test:multi');
      expect(entries.length).toBe(2);
    });

    it('returns empty array for a name that has no traces', () => {
      const entries = getTraces('test:nonexistent');
      expect(entries).toEqual([]);
    });

    it('does not mix measures from different names', () => {
      startTrace('test:alpha');
      endTrace('test:alpha');
      startTrace('test:beta');
      endTrace('test:beta');
      expect(getTraces('test:alpha').length).toBe(1);
      expect(getTraces('test:beta').length).toBe(1);
    });
  });

  describe('clearTraces', () => {
    it('removes all marks and measures so getTraces returns empty array', () => {
      startTrace('test:clear');
      endTrace('test:clear');
      expect(getTraces('test:clear').length).toBe(1);
      clearTraces();
      expect(getTraces('test:clear')).toEqual([]);
    });
  });

  describe('PerformanceEntry shape', () => {
    it('entry has name, duration, and entryType === measure', () => {
      startTrace('test:shape');
      endTrace('test:shape');
      const entry = getTraces('test:shape')[0];
      expect(entry.name).toBe('test:shape');
      expect(entry.entryType).toBe('measure');
      expect(typeof entry.duration).toBe('number');
    });
  });
});
