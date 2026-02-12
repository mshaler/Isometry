/**
 * Deterministic Source ID Generation
 *
 * Generates collision-resistant source IDs using SHA-256 hash of
 * (normalized filePath + sorted frontmatter JSON).
 *
 * Same input always produces same output (idempotent re-imports).
 */
import { createHash } from 'crypto';

/**
 * Generate a deterministic source_id from file path and frontmatter.
 *
 * Algorithm:
 * 1. Normalize file path (lowercase, forward slashes)
 * 2. Sort frontmatter keys for consistent stringification
 * 3. Create composite key: `${normalizedPath}:${sortedFrontmatterJSON}`
 * 4. SHA-256 hash, truncate to 16 hex chars
 * 5. Prefix with source name
 *
 * @param filePath - Original file path (will be normalized)
 * @param frontmatter - Parsed YAML frontmatter object
 * @param source - Source identifier prefix (default: 'alto')
 * @returns Deterministic source_id like "alto-a1b2c3d4e5f67890"
 */
export function generateDeterministicSourceId(
  filePath: string,
  frontmatter: Record<string, unknown>,
  source: string = 'alto'
): string {
  // Normalize file path: lowercase, forward slashes only
  const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');

  // Sort frontmatter keys for consistent JSON stringification
  const sortedKeys = Object.keys(frontmatter).sort();
  const sortedFrontmatter: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sortedFrontmatter[key] = frontmatter[key];
  }
  const frontmatterStr = JSON.stringify(sortedFrontmatter);

  // Composite key: path + frontmatter
  const compositeKey = `${normalizedPath}:${frontmatterStr}`;

  // SHA-256 hash, truncate to 16 chars for readability
  const hash = createHash('sha256')
    .update(compositeKey)
    .digest('hex')
    .substring(0, 16);

  return `${source}-${hash}`;
}

/**
 * Simple string hash for fallback cases (non-cryptographic).
 * Used when frontmatter is unavailable or for legacy compatibility.
 *
 * @param str - String to hash
 * @returns 32-bit hash as hex string
 */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}
