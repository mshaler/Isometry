/**
 * Sanitize ANSI escape sequences to prevent xterm.js RCE vulnerabilities.
 * Specifically blocks DCS (Device Control String) sequences that could
 * be exploited for code execution.
 *
 * @see https://doyensec.com/resources/Doyensec_Terminal_Emulators_RCE_blog.pdf
 */
export function sanitizeAnsiEscapes(data: string): string {
  // DCS sequences start with ESC P or 0x90
  // They're terminated by ST (ESC \ or 0x9c)
  // Block entire DCS sequences

  // Pattern matches:
  // ESC P ... ESC \    (7-bit DCS)
  // 0x90 ... 0x9C      (8-bit DCS)
  // eslint-disable-next-line no-control-regex
  const dcsPattern = /\x1bP[^\x1b]*\x1b\\|\x90[^\x9c]*\x9c/g;

  // Also block OSC 52 (clipboard write) which could be abused
  // eslint-disable-next-line no-control-regex
  const osc52Pattern = /\x1b\]52;[^;]*;[^\x07\x1b]*(?:\x07|\x1b\\)/g;

  // Block DECSC/DECRC manipulation sequences that could affect state
  // eslint-disable-next-line no-control-regex
  const stateManipPattern = /\x1b7|\x1b8|\x1b\[s|\x1b\[u/g;

  return data
    .replace(dcsPattern, '[DCS blocked]')
    .replace(osc52Pattern, '[OSC52 blocked]')
    .replace(stateManipPattern, '');
}

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
   * Append data to buffer, evicting oldest entries if over limit.
   * Sanitizes ANSI escape sequences before buffering.
   */
  append(data: string): void {
    // Sanitize ANSI escapes before buffering
    const sanitized = sanitizeAnsiEscapes(data);
    const dataSize = sanitized.length;

    // If single chunk exceeds max, truncate it
    if (dataSize > this.maxSize) {
      this.buffer = [sanitized.slice(-this.maxSize)];
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

    this.buffer.push(sanitized);
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
