/**
 * Hierarchical correlation ID generation system
 *
 * Provides unique correlation IDs for transaction tracking and debugging with
 * hierarchical child operation support. Uses nanoid for short, URL-safe identifiers.
 *
 * Format:
 * - Parent transaction: tx_abc123
 * - Child operation: tx_abc123.001
 */

import { nanoid } from 'nanoid';

// Configuration constants
const TX_PREFIX = 'tx_';
const ID_LENGTH = 8; // Short but unique enough for debugging
const CHILD_ID_PADDING = 3; // Zero-pad to 3 digits: 001, 002, etc.

/**
 * Generate a new parent transaction correlation ID
 *
 * @returns Unique transaction ID in format: tx_abc123
 */
export function generateCorrelationId(): string {
  const uniqueId = nanoid(ID_LENGTH);
  return `${TX_PREFIX}${uniqueId}`;
}

/**
 * Create a child operation ID based on parent correlation ID
 *
 * @param parentId Parent transaction correlation ID
 * @param sequence Child operation sequence number (1-based)
 * @returns Child correlation ID in format: tx_abc123.001
 */
export function createChildId(parentId: string, sequence: number): string {
  // Validate parent ID format
  if (!parentId.startsWith(TX_PREFIX)) {
    throw new Error(`Invalid parent ID format: ${parentId}. Must start with '${TX_PREFIX}'`);
  }

  if (sequence < 1) {
    throw new Error(`Invalid sequence number: ${sequence}. Must be >= 1`);
  }

  // Format sequence number with zero padding
  const paddedSequence = sequence.toString().padStart(CHILD_ID_PADDING, '0');

  return `${parentId}.${paddedSequence}`;
}

/**
 * Parse correlation ID to extract components
 *
 * @param correlationId Full correlation ID to parse
 * @returns Parsed components or null if invalid format
 */
export function parseCorrelationId(correlationId: string): {
  parentId: string;
  sequence?: number;
  isChild: boolean;
} | null {
  if (!correlationId.startsWith(TX_PREFIX)) {
    return null;
  }

  // Check for child ID pattern (contains dot)
  const parts = correlationId.split('.');

  if (parts.length === 1) {
    // Parent ID only
    return {
      parentId: correlationId,
      isChild: false
    };
  } else if (parts.length === 2) {
    // Child ID
    const parentId = parts[0];
    const sequenceStr = parts[1];
    const sequence = parseInt(sequenceStr, 10);

    if (isNaN(sequence)) {
      return null;
    }

    return {
      parentId,
      sequence,
      isChild: true
    };
  }

  // Invalid format (too many dots)
  return null;
}

/**
 * Extract parent ID from any correlation ID (parent or child)
 *
 * @param correlationId Correlation ID to extract parent from
 * @returns Parent correlation ID or null if invalid
 */
export function extractParentId(correlationId: string): string | null {
  const parsed = parseCorrelationId(correlationId);
  return parsed ? parsed.parentId : null;
}

/**
 * Check if correlation ID is a child operation ID
 *
 * @param correlationId Correlation ID to check
 * @returns True if this is a child operation ID
 */
export function isChildId(correlationId: string): boolean {
  const parsed = parseCorrelationId(correlationId);
  return parsed ? parsed.isChild : false;
}

/**
 * Utility class for managing correlation ID sequences
 *
 * Tracks sequence numbers for child operation generation within
 * a parent transaction context.
 */
export class CorrelationSequence {
  private parentId: string;
  private currentSequence: number = 0;

  constructor(parentId: string) {
    // Validate parent ID
    const parsed = parseCorrelationId(parentId);
    if (!parsed || parsed.isChild) {
      throw new Error(`Invalid parent correlation ID: ${parentId}`);
    }

    this.parentId = parentId;
  }

  /**
   * Generate next child correlation ID in sequence
   *
   * @returns Next child correlation ID
   */
  next(): string {
    this.currentSequence++;
    return createChildId(this.parentId, this.currentSequence);
  }

  /**
   * Get current sequence number
   */
  getCurrentSequence(): number {
    return this.currentSequence;
  }

  /**
   * Get parent correlation ID
   */
  getParentId(): string {
    return this.parentId;
  }

  /**
   * Reset sequence to start over
   */
  reset(): void {
    this.currentSequence = 0;
  }
}

/**
 * Create a new correlation sequence for a transaction
 *
 * @returns New correlation sequence with generated parent ID
 */
export function createCorrelationSequence(): CorrelationSequence {
  const parentId = generateCorrelationId();
  return new CorrelationSequence(parentId);
}

/**
 * Debug utilities for correlation ID analysis
 */
export const CorrelationDebug = {
  /**
   * Get human-readable description of correlation ID
   */
  describe(correlationId: string): string {
    const parsed = parseCorrelationId(correlationId);

    if (!parsed) {
      return `Invalid correlation ID: ${correlationId}`;
    }

    if (parsed.isChild) {
      return `Child operation #${parsed.sequence} of transaction ${parsed.parentId}`;
    } else {
      return `Transaction ${parsed.parentId}`;
    }
  },

  /**
   * Validate correlation ID format
   */
  validate(correlationId: string): boolean {
    return parseCorrelationId(correlationId) !== null;
  },

  /**
   * Generate example correlation IDs for testing
   */
  examples(): string[] {
    const parent = generateCorrelationId();
    return [
      parent,
      createChildId(parent, 1),
      createChildId(parent, 2),
      createChildId(parent, 10)
    ];
  }
};