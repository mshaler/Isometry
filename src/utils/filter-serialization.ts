import type {
  FilterState,
  LocationFilter,
  AlphabetFilter,
  TimeFilter,
  CategoryFilter,
  HierarchyFilter,
  TimePreset
} from '../types/filter';

/**
 * Serialize filters to URL-safe string format
 * Format: axis:value;axis:value;...
 *
 * Examples:
 * - alphabet:test
 * - time:2024-01-01,2024-12-31
 * - category:work,personal
 * - location:37.7749,-122.4194,10km
 * - hierarchy:3-5
 */
export function serializeFilters(filters: FilterState): string {
  const parts: string[] = [];

  // Location filter
  if (filters.location) {
    const loc = filters.location;
    if (loc.type === 'point' && loc.latitude !== undefined && loc.longitude !== undefined) {
      parts.push(`location:point,${loc.latitude},${loc.longitude}`);
    } else if (loc.type === 'box' && loc.north !== undefined && loc.south !== undefined && loc.east !== undefined && loc.west !== undefined) {
      parts.push(`location:box,${loc.north},${loc.south},${loc.east},${loc.west}`);
    } else if (loc.type === 'radius' && loc.centerLat !== undefined && loc.centerLon !== undefined && loc.radiusKm !== undefined) {
      parts.push(`location:radius,${loc.centerLat},${loc.centerLon},${loc.radiusKm}`);
    }
  }

  // Alphabet filter
  if (filters.alphabet) {
    const alpha = filters.alphabet;
    const encodedValue = encodeURIComponent(alpha.value);
    parts.push(`alphabet:${alpha.type},${encodedValue}`);
  }

  // Time filter
  if (filters.time) {
    const time = filters.time;
    if (time.type === 'preset' && time.preset) {
      parts.push(`time:preset,${time.preset},${time.field}`);
    } else if (time.type === 'range' && time.start && time.end) {
      parts.push(`time:range,${time.start},${time.end},${time.field}`);
    } else if (time.type === 'relative' && time.amount !== undefined && time.unit && time.direction) {
      parts.push(`time:relative,${time.amount},${time.unit},${time.direction},${time.field}`);
    }
  }

  // Category filter
  if (filters.category) {
    const cat = filters.category;
    const values: string[] = [];

    if (cat.folders && cat.folders.length > 0) {
      values.push(`folders=${cat.folders.map(f => encodeURIComponent(f)).join('+')}`);
    }
    if (cat.tags && cat.tags.length > 0) {
      values.push(`tags=${cat.tags.map(t => encodeURIComponent(t)).join('+')}`);
    }
    if (cat.statuses && cat.statuses.length > 0) {
      values.push(`statuses=${cat.statuses.map(s => encodeURIComponent(s)).join('+')}`);
    }
    if (cat.nodeTypes && cat.nodeTypes.length > 0) {
      values.push(`types=${cat.nodeTypes.map(t => encodeURIComponent(t)).join('+')}`);
    }

    if (values.length > 0) {
      parts.push(`category:${cat.type},${values.join('&')}`);
    }
  }

  // Hierarchy filter
  if (filters.hierarchy) {
    const hier = filters.hierarchy;
    if (hier.type === 'priority' && hier.minPriority !== undefined && hier.maxPriority !== undefined) {
      parts.push(`hierarchy:priority,${hier.minPriority}-${hier.maxPriority}`);
    } else if (hier.type === 'top-n' && hier.limit !== undefined && hier.sortBy) {
      parts.push(`hierarchy:top-n,${hier.limit},${hier.sortBy}`);
    } else if (hier.type === 'range' && hier.minPriority !== undefined && hier.maxPriority !== undefined && hier.sortBy) {
      parts.push(`hierarchy:range,${hier.minPriority}-${hier.maxPriority},${hier.sortBy}`);
    }
  }

  return parts.join(';');
}

/**
 * Deserialize filters from URL string
 * Returns empty filters if parsing fails (graceful degradation)
 */
export function deserializeFilters(urlString: string): FilterState {
  const filters: FilterState = {
    location: null,
    alphabet: null,
    time: null,
    category: null,
    hierarchy: null,
    dsl: null,
  };

  if (!urlString || urlString.trim() === '') {
    return filters;
  }

  try {
    const parts = urlString.split(';');

    for (const part of parts) {
      const colonIndex = part.indexOf(':');
      if (colonIndex === -1) continue;

      const axis = part.substring(0, colonIndex);
      const value = part.substring(colonIndex + 1);

      try {
        switch (axis) {
          case 'location':
            filters.location = parseLocationFilter(value);
            break;
          case 'alphabet':
            filters.alphabet = parseAlphabetFilter(value);
            break;
          case 'time':
            filters.time = parseTimeFilter(value);
            break;
          case 'category':
            filters.category = parseCategoryFilter(value);
            break;
          case 'hierarchy':
            filters.hierarchy = parseHierarchyFilter(value);
            break;
        }
      } catch (error) {
        console.warn(`Failed to parse ${axis} filter: ${value}`, error);
        // Continue with other filters
      }
    }
  } catch (error) {
    console.warn('Failed to deserialize filters:', error);
    // Return empty filters on parse error
  }

  return filters;
}

function parseLocationFilter(value: string): LocationFilter | null {
  const parts = value.split(',');
  const type = parts[0];

  if (type === 'point' && parts.length === 3) {
    return {
      type: 'point',
      latitude: parseFloat(parts[1]),
      longitude: parseFloat(parts[2]),
    };
  } else if (type === 'box' && parts.length === 5) {
    return {
      type: 'box',
      north: parseFloat(parts[1]),
      south: parseFloat(parts[2]),
      east: parseFloat(parts[3]),
      west: parseFloat(parts[4]),
    };
  } else if (type === 'radius' && parts.length === 4) {
    return {
      type: 'radius',
      centerLat: parseFloat(parts[1]),
      centerLon: parseFloat(parts[2]),
      radiusKm: parseFloat(parts[3]),
    };
  }

  return null;
}

function parseAlphabetFilter(value: string): AlphabetFilter | null {
  const parts = value.split(',');
  if (parts.length !== 2) return null;

  const type = parts[0] as 'startsWith' | 'range' | 'search';
  const searchValue = decodeURIComponent(parts[1]);

  return {
    type,
    value: searchValue,
  };
}

function parseTimeFilter(value: string): TimeFilter | null {
  const parts = value.split(',');
  if (parts.length < 2) return null;

  const type = parts[0] as 'preset' | 'range' | 'relative';
  const field = parts[parts.length - 1] as 'created' | 'modified' | 'due';

  if (type === 'preset' && parts.length === 3) {
    return {
      type: 'preset',
      preset: parts[1] as TimePreset,
      field,
    };
  } else if (type === 'range' && parts.length === 4) {
    return {
      type: 'range',
      start: parts[1],
      end: parts[2],
      field,
    };
  } else if (type === 'relative' && parts.length === 5) {
    return {
      type: 'relative',
      amount: parseInt(parts[1], 10),
      unit: parts[2] as 'day' | 'week' | 'month' | 'year',
      direction: parts[3] as 'past' | 'future',
      field,
    };
  }

  return null;
}

function parseCategoryFilter(value: string): CategoryFilter | null {
  const parts = value.split(',');
  if (parts.length !== 2) return null;

  const type = parts[0] as 'include' | 'exclude';
  const valuesPart = parts[1];

  const filter: CategoryFilter = {
    type,
  };

  // Parse key=value pairs separated by &
  const kvPairs = valuesPart.split('&');
  for (const pair of kvPairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) continue;

    const key = pair.substring(0, eqIndex);
    const values = pair.substring(eqIndex + 1).split('+').map(v => decodeURIComponent(v));

    switch (key) {
      case 'folders':
        filter.folders = values;
        break;
      case 'tags':
        filter.tags = values;
        break;
      case 'statuses':
        filter.statuses = values;
        break;
      case 'types':
        filter.nodeTypes = values;
        break;
    }
  }

  return filter;
}

function parseHierarchyFilter(value: string): HierarchyFilter | null {
  const parts = value.split(',');
  if (parts.length < 2) return null;

  const type = parts[0] as 'priority' | 'top-n' | 'range';

  if (type === 'priority' && parts.length === 2) {
    const [min, max] = parts[1].split('-').map(n => parseInt(n, 10));
    return {
      type: 'priority',
      minPriority: min,
      maxPriority: max,
    };
  } else if (type === 'top-n' && parts.length === 3) {
    return {
      type: 'top-n',
      limit: parseInt(parts[1], 10),
      sortBy: parts[2] as 'priority' | 'importance' | 'sortOrder',
    };
  } else if (type === 'range' && parts.length === 3) {
    const [min, max] = parts[1].split('-').map(n => parseInt(n, 10));
    return {
      type: 'range',
      minPriority: min,
      maxPriority: max,
      sortBy: parts[2] as 'priority' | 'importance' | 'sortOrder',
    };
  }

  return null;
}

/**
 * Validate that serialized filter string is within URL length limits
 * Returns true if safe to use in URL
 */
export function validateFilterURLLength(filterString: string): boolean {
  // Conservative limit: 1500 chars (leaving room for other URL params)
  // Browser limits vary (IE: 2083, Chrome/Firefox: ~65k)
  return filterString.length <= 1500;
}

/**
 * Check if filters are empty (all null)
 */
export function isEmptyFilters(filters: FilterState): boolean {
  return !filters.location &&
         !filters.alphabet &&
         !filters.time &&
         !filters.category &&
         !filters.hierarchy &&
         !filters.dsl;
}
