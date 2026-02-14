/**
 * Circular buffer for terminal output replay on reconnection.
 * Stores last N bytes of output (default: 64KB).
 * Thread-safe for single-writer use case (PTY output handler).
 */
export class OutputBuffer {
  private buffer: string[] = [];
  private totalSize = 0;
  private readonly maxSize: number;

  constructor(maxSizeBytes: number = 64 * 1024) {
    this.maxSize = maxSizeBytes;
  }

  /**
   * Append data to buffer, evicting oldest entries if over limit
   */
  append(data: string): void {
    const dataSize = data.length;

    // If single chunk exceeds max, truncate it
    if (dataSize > this.maxSize) {
      this.buffer = [data.slice(-this.maxSize)];
      this.totalSize = this.maxSize;
      return;
    }

    // Evict oldest entries until we have room
    while (this.totalSize + dataSize > this.maxSize && this.buffer.length > 0) {
      const removed = this.buffer.shift();
      if (removed) {
        this.totalSize -= removed.length;
      }
    }

    this.buffer.push(data);
    this.totalSize += dataSize;
  }

  /**
   * Get all buffered output as single string for replay
   */
  getAll(): string {
    return this.buffer.join('');
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer = [];
    this.totalSize = 0;
  }

  /**
   * Get current buffer size in bytes
   */
  size(): number {
    return this.totalSize;
  }
}
