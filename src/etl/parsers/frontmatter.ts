/**
 * Frontmatter Parser
 *
 * Browser-safe YAML frontmatter parsing without Node-only dependencies.
 * Handles nested objects and multi-line values via yaml package.
 */
import YAML from 'yaml';

export interface ParsedFrontmatter {
  /** Parsed YAML frontmatter as key-value object */
  frontmatter: Record<string, unknown>;
  /** Markdown body content after frontmatter */
  body: string;
  /** Raw YAML string (without delimiters) for debugging */
  raw: string;
}

let didWarnLenientFallback = false;

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseScalar(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed.length === 0) return '';

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((item) => parseScalar(item));
  }

  return trimmed;
}

/**
 * Best-effort parser for malformed YAML frontmatter.
 * Extracts top-level keys and tolerates multi-line quoted values.
 */
function parseLenientFrontmatter(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = raw.split(/\r?\n/);
  const keyValuePattern = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/;
  let multilineKey: string | null = null;
  let multilineQuote: '"' | "'" | null = null;
  let multilineBuffer = '';

  const flushMultiline = () => {
    if (multilineKey) {
      result[multilineKey] = multilineBuffer;
    }
    multilineKey = null;
    multilineQuote = null;
    multilineBuffer = '';
  };

  for (const line of lines) {
    if (multilineKey && multilineQuote) {
      const quoteIndex = line.indexOf(multilineQuote);
      if (quoteIndex >= 0) {
        multilineBuffer += `\n${line.slice(0, quoteIndex)}`;
        flushMultiline();
        continue;
      }
      multilineBuffer += `\n${line}`;
      continue;
    }

    const match = line.match(keyValuePattern);
    if (!match) continue;

    const key = match[1];
    const rawValue = (match[2] || '').trim();

    if ((rawValue.startsWith('"') && !rawValue.endsWith('"')) ||
        (rawValue.startsWith("'") && !rawValue.endsWith("'"))) {
      multilineKey = key;
      multilineQuote = rawValue[0] as '"' | "'";
      multilineBuffer = rawValue.slice(1);
      continue;
    }

    result[key] = parseScalar(rawValue);
  }

  flushMultiline();
  return result;
}

/**
 * Parse YAML frontmatter from markdown content.
 * Uses explicit frontmatter delimiters and yaml package for parsing.
 *
 * @param content - Raw markdown string with YAML frontmatter
 * @returns Parsed frontmatter and body, or null if no valid frontmatter
 */
export function parseFrontmatter(content: string): ParsedFrontmatter | null {
  try {
    const source = content.startsWith('\uFEFF') ? content.slice(1) : content;
    const openingMatch = source.match(/^---[ \t]*\r?(?:\n|$)/);

    // Missing opening delimiter is valid; treat as body-only markdown.
    if (!openingMatch) {
      return {
        frontmatter: {},
        body: source,
        raw: ''
      };
    }

    const start = openingMatch[0].length;
    const remainder = source.slice(start);
    const closingRegex = /^(---|\.{3})[ \t]*\r?$/m;
    const closingMatch = closingRegex.exec(remainder);

    // Unclosed frontmatter block is treated as body-only markdown for compatibility.
    if (!closingMatch || closingMatch.index === undefined) {
      return {
        frontmatter: {},
        body: source,
        raw: ''
      };
    }

    const raw = remainder.slice(0, closingMatch.index);
    let bodyStart = start + closingMatch.index + closingMatch[0].length;
    if (source.startsWith('\r\n', bodyStart)) {
      bodyStart += 2;
    } else if (source[bodyStart] === '\n') {
      bodyStart += 1;
    }

    let frontmatter: Record<string, unknown>;
    if (raw.trim().length === 0) {
      frontmatter = {};
    } else {
      try {
        frontmatter = toRecord(YAML.parse(raw));
      } catch (strictError) {
        frontmatter = parseLenientFrontmatter(raw);
        if (!didWarnLenientFallback) {
          didWarnLenientFallback = true;
          console.warn(
            'YAML parse fallback enabled for malformed frontmatter records'
          );
        }
        if (Object.keys(frontmatter).length === 0) {
          throw strictError;
        }
      }
    }

    return {
      frontmatter,
      body: source.slice(bodyStart),
      raw
    };
  } catch (error) {
    // Log more context for debugging YAML issues
    const preview = content.slice(0, 200).replace(/\n/g, '\\n');
    console.error('YAML parsing error:', error);
    console.error('YAML content preview:', preview);
    return null;
  }
}
