import { describe, it, expect, beforeEach } from 'vitest';
import { OutputBuffer } from '../outputBuffer';

describe('OutputBuffer', () => {
  let buffer: OutputBuffer;

  beforeEach(() => {
    buffer = new OutputBuffer(100); // 100 byte limit for tests
  });

  it('appends data correctly', () => {
    buffer.append('hello');
    buffer.append(' world');
    expect(buffer.getAll()).toBe('hello world');
    expect(buffer.size()).toBe(11);
  });

  it('evicts old data when over limit', () => {
    const chunk = 'x'.repeat(60);
    buffer.append(chunk);
    buffer.append(chunk); // Should evict first chunk

    expect(buffer.size()).toBeLessThanOrEqual(100);
    expect(buffer.getAll().length).toBeLessThanOrEqual(100);
  });

  it('handles single chunk larger than max', () => {
    const largeChunk = 'x'.repeat(200);
    buffer.append(largeChunk);

    expect(buffer.size()).toBe(100);
    expect(buffer.getAll().length).toBe(100);
  });

  it('clears buffer', () => {
    buffer.append('data');
    buffer.clear();

    expect(buffer.getAll()).toBe('');
    expect(buffer.size()).toBe(0);
  });

  it('handles empty append', () => {
    buffer.append('');
    expect(buffer.getAll()).toBe('');
    expect(buffer.size()).toBe(0);
  });

  it('uses default 64KB max size', () => {
    const defaultBuffer = new OutputBuffer();
    const largeData = 'x'.repeat(64 * 1024 + 100);
    defaultBuffer.append(largeData);

    expect(defaultBuffer.size()).toBe(64 * 1024);
  });

  it('correctly evicts multiple chunks to make room', () => {
    // Add 5 chunks of 25 bytes each (125 total, but limit is 100)
    buffer.append('a'.repeat(25));
    buffer.append('b'.repeat(25));
    buffer.append('c'.repeat(25));
    buffer.append('d'.repeat(25));
    buffer.append('e'.repeat(25));

    // Should have evicted at least one chunk
    expect(buffer.size()).toBeLessThanOrEqual(100);
    // Most recent data should be present
    expect(buffer.getAll()).toContain('e'.repeat(25));
  });
});
