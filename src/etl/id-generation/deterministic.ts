/**
 * Deterministic Source ID Generation
 *
 * Generates collision-resistant source IDs using a hash of
 * (normalized filePath + sorted frontmatter JSON).
 *
 * Same input always produces same output (idempotent re-imports).
 *
 * Uses browser-compatible hashing (no Node.js crypto dependency).
 */

/**
 * Browser-compatible SHA-256-like hash using multiple rounds of FNV-1a.
 * Produces a 16-character hex string (64 bits of entropy).
 *
 * Not cryptographically secure, but sufficient for deterministic IDs
 * where collision resistance (not security) is the goal.
 */
function browserHash(str: string): string {
  // FNV-1a constants for 32-bit
  const FNV_PRIME = 0x01000193;
  const FNV_OFFSET = 0x811c9dc5;

  // Generate 4 different hashes by using different seeds/salts
  const hashes: number[] = [];

  for (let round = 0; round < 4; round++) {
    let hash = FNV_OFFSET ^ round;
    const input = `${round}:${str}`;

    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, FNV_PRIME);
    }

    hashes.push(hash >>> 0); // Ensure unsigned 32-bit
  }

  // Combine into 16 hex chars (4 chars per hash)
  return hashes.map(h => (h >>> 0).toString(16).padStart(4, '0').slice(-4)).join('');
}

/**
 * Generate a deterministic source_id from file path and frontmatter.
 *
 * Algorithm:
 * 1. Normalize file path (lowercase, forward slashes)
 * 2. Sort frontmatter keys for consistent stringification
 * 3. Create composite key: `${normalizedPath}:${sortedFrontmatterJSON}`
 * 4. Hash and truncate to 16 hex chars
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
  source: string = 'alto',
  fallbackContent: string = ''
): string {
  // Normalize file path: lowercase, forward slashes only
  const normalizedPath = (filePath || '').trim().toLowerCase().replace(/\\/g, '/');

  // Sort frontmatter keys for consistent JSON stringification
  const sortedKeys = Object.keys(frontmatter).sort();
  const sortedFrontmatter: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sortedFrontmatter[key] = frontmatter[key];
  }
  const frontmatterStr = JSON.stringify(sortedFrontmatter);

  // Robust fallback for missing path/frontmatter
  const fallbackIdentity = [
    frontmatter.id,
    frontmatter.source_id,
    frontmatter.title,
    frontmatter.name,
    frontmatter.created,
    frontmatter.modified,
    fallbackContent ? browserHash(fallbackContent) : null,
  ]
    .filter((v) => v != null && String(v).trim().length > 0)
    .map(String)
    .join('|');

  // Composite key: normalizedPath + frontmatter + fallback identity
  const compositeKey = `${normalizedPath || '__no_path__'}:${frontmatterStr}:${fallbackIdentity || '__no_identity__'}`;

  // Browser-compatible hash, 16 hex chars
  const hash = browserHash(compositeKey);

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
