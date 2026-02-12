/**
 * Frontmatter Parser using gray-matter
 *
 * Replaces custom regex-based parser with full YAML 1.2 spec support.
 * Handles nested objects, multi-line strings, anchors/aliases.
 */
import matter from 'gray-matter';
import YAML from 'yaml';

export interface ParsedFrontmatter {
  /** Parsed YAML frontmatter as key-value object */
  frontmatter: Record<string, unknown>;
  /** Markdown body content after frontmatter */
  body: string;
  /** Raw YAML string (without delimiters) for debugging */
  raw: string;
}

/**
 * Parse YAML frontmatter from markdown content.
 * Uses gray-matter with yaml package for full YAML 1.2 spec support.
 *
 * @param content - Raw markdown string with YAML frontmatter
 * @returns Parsed frontmatter and body, or null if no valid frontmatter
 */
export function parseFrontmatter(content: string): ParsedFrontmatter | null {
  try {
    const result = matter(content, {
      engines: {
        yaml: {
          parse: (str: string) => YAML.parse(str),
          stringify: (obj: unknown) => YAML.stringify(obj)
        }
      }
    });

    // gray-matter returns empty object for missing frontmatter
    // We consider this valid (file has no frontmatter)
    return {
      frontmatter: result.data as Record<string, unknown>,
      body: result.content,
      raw: result.matter || ''
    };
  } catch (error) {
    console.error('YAML parsing error:', error);
    return null;
  }
}
