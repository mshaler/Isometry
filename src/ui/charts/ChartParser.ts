// Isometry v5 -- Phase 65 Chart Config Parser
// Simple line-by-line key:value parser for YAML-style chart config blocks.
//
// No YAML library needed -- chart configs are flat key-value pairs.
// Handles comments (#), empty lines, whitespace trimming, boolean/number coercion.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Valid chart types supported by the rendering pipeline. */
export type ChartType = 'bar' | 'pie' | 'line' | 'scatter';

/** Parsed chart configuration after validation. */
export interface ChartConfig {
	type: ChartType;
	x?: string;
	y?: string;
	value?: string;
	color?: string;
	title?: string;
	legend?: boolean;
	limit?: number;
}

/** Error result when chart config is invalid. */
export interface ChartParseError {
	error: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_CHART_TYPES = new Set<string>(['bar', 'pie', 'line', 'scatter']);

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse a YAML-style chart config text into a validated ChartConfig.
 *
 * Parsing rules:
 *   - Split by newlines, trim each line
 *   - Skip empty lines and lines starting with # (comments)
 *   - Split on first : to get key/value pairs, trim both
 *   - Lines without : are silently ignored (tolerant parsing)
 *   - Validate type, required fields per chart type
 *   - Coerce boolean (legend) and number (limit) values
 *
 * @param text - Raw text from fenced chart code block
 * @returns ChartConfig on success, ChartParseError on validation failure
 */
export function parseChartConfig(text: string): ChartConfig | ChartParseError {
	// Step 1: Parse raw key-value pairs
	const raw: Record<string, string> = {};
	for (const line of text.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const colonIdx = trimmed.indexOf(':');
		if (colonIdx === -1) continue;
		const key = trimmed.slice(0, colonIdx).trim();
		const value = trimmed.slice(colonIdx + 1).trim();
		if (key) raw[key] = value;
	}

	// Step 2: Validate type is present
	if (!raw['type']) {
		return { error: 'Missing required key: type' };
	}

	// Step 3: Validate chart type
	const chartType = raw['type'];
	if (!VALID_CHART_TYPES.has(chartType)) {
		return { error: `Unknown chart type: ${chartType}` };
	}

	// Step 4: Validate required fields per chart type
	const type = chartType as ChartType;

	switch (type) {
		case 'bar':
		case 'line': {
			if (!raw['x']) {
				return { error: `${type === 'bar' ? 'Bar' : 'Line'} chart requires x field` };
			}
			break;
		}
		case 'pie': {
			if (!raw['value']) {
				return { error: 'Pie chart requires value field' };
			}
			break;
		}
		case 'scatter': {
			if (!raw['x'] || !raw['y']) {
				return { error: 'Scatter chart requires both x and y fields' };
			}
			break;
		}
	}

	// Step 5: Build validated config
	const config: ChartConfig = { type };

	if (raw['x']) config.x = raw['x'];
	if (raw['color']) config.color = raw['color'];
	if (raw['title']) config.title = raw['title'];
	if (raw['value']) config.value = raw['value'];

	// y defaults to 'count' for bar/line when omitted
	if (raw['y']) {
		config.y = raw['y'];
	} else if (type === 'bar' || type === 'line') {
		config.y = 'count';
	}

	// Boolean coercion for legend
	if (raw['legend'] !== undefined) {
		config.legend = raw['legend'] === 'true';
	}

	// Number coercion for limit
	if (raw['limit'] !== undefined) {
		const parsed = Number.parseInt(raw['limit'], 10);
		if (!Number.isNaN(parsed)) {
			config.limit = parsed;
		}
	}

	return config;
}
