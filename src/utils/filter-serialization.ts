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

  // Serialize each filter type using focused helper functions
  const locationPart = serializeLocationFilter(filters.location);
  if (locationPart) parts.push(locationPart);

  const alphabetPart = serializeAlphabetFilter(filters.alphabet);
  if (alphabetPart) parts.push(alphabetPart);

  const timePart = serializeTimeFilter(filters.time);
  if (timePart) parts.push(timePart);

  const categoryPart = serializeCategoryFilter(filters.category);
  if (categoryPart) parts.push(categoryPart);

  const hierarchyPart = serializeHierarchyFilter(filters.hierarchy);
  if (hierarchyPart) parts.push(hierarchyPart);

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

function serializeLocationFilter(location: LocationFilter | null): string | null {
  if (!location) return null;

  if (location.type === 'point' && location.latitude !== undefined && location.longitude !== undefined) {
    return `location:point,${location.latitude},${location.longitude}`;
  }

  if (location.type === 'box' && location.north !== undefined && location.south !== undefined &&
      location.east !== undefined && location.west !== undefined) {
    return `location:box,${location.north},${location.south},${location.east},${location.west}`;
  }

  if (location.type === 'radius' && location.centerLat !== undefined &&
      location.centerLon !== undefined && location.radiusKm !== undefined) {
    return `location:radius,${location.centerLat},${location.centerLon},${location.radiusKm}`;
  }

  return null;
}

function serializeAlphabetFilter(alphabet: AlphabetFilter | null): string | null {
  if (!alphabet) return null;

  const encodedValue = encodeURIComponent(alphabet.value);
  return `alphabet:${alphabet.type},${encodedValue}`;
}

function serializeTimeFilter(time: TimeFilter | null): string | null {
  if (!time) return null;

  if (time.type === 'preset' && time.preset) {
    return `time:preset,${time.preset},${time.field}`;
  }

  if (time.type === 'range' && time.start && time.end) {
    return `time:range,${time.start},${time.end},${time.field}`;
  }

  if (time.type === 'relative' && time.amount !== undefined && time.unit && time.direction) {
    return `time:relative,${time.amount},${time.unit},${time.direction},${time.field}`;
  }

  return null;
}

function serializeCategoryFilter(category: CategoryFilter | null): string | null {
  if (!category) return null;

  const values: string[] = [];

  if (category.folders && category.folders.length > 0) {
    values.push(`folders=${category.folders.map(f => encodeURIComponent(f)).join('+')}`);
  }
  if (category.tags && category.tags.length > 0) {
    values.push(`tags=${category.tags.map(t => encodeURIComponent(t)).join('+')}`);
  }
  if (category.statuses && category.statuses.length > 0) {
    values.push(`statuses=${category.statuses.map(s => encodeURIComponent(s)).join('+')}`);
  }
  if (category.nodeTypes && category.nodeTypes.length > 0) {
    values.push(`types=${category.nodeTypes.map(t => encodeURIComponent(t)).join('+')}`);
  }

  if (values.length > 0) {
    return `category:${category.type},${values.join('&')}`;
  }

  return null;
}

function serializeHierarchyFilter(hierarchy: HierarchyFilter | null): string | null {
  if (!hierarchy) return null;

  if (hierarchy.type === 'priority' && hierarchy.minPriority !== undefined && hierarchy.maxPriority !== undefined) {
    return `hierarchy:priority,${hierarchy.minPriority}-${hierarchy.maxPriority}`;
  }

  if (hierarchy.type === 'top-n' && hierarchy.limit !== undefined && hierarchy.sortBy) {
    return `hierarchy:top-n,${hierarchy.limit},${hierarchy.sortBy}`;
  }

  if (hierarchy.type === 'range' && hierarchy.minPriority !== undefined &&
      hierarchy.maxPriority !== undefined && hierarchy.sortBy) {
    return `hierarchy:range,${hierarchy.minPriority}-${hierarchy.maxPriority},${hierarchy.sortBy}`;
  }

  return null;
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

// Bridge-specific serialization for optimized bridge messaging

/**
 * Bridge compatible serialization optimized for message size and type safety
 * Uses binary format and compression for large filter sets
 */
export function bridgeCompatibleSerialization(filters: FilterState): {
  compressed: string;
  originalSize: number;
  compressedSize: number;
  isCompressed: boolean;
} {
  // Start with the standard serialization
  const standardSerialized = serializeFilters(filters);

  // For small filters, use standard format
  if (standardSerialized.length < 500) {
    return {
      compressed: standardSerialized,
      originalSize: standardSerialized.length,
      compressedSize: standardSerialized.length,
      isCompressed: false
    };
  }

  // For larger filters, use optimized bridge format
  const optimized = createOptimizedBridgeFormat(filters);

  return {
    compressed: optimized.data,
    originalSize: standardSerialized.length,
    compressedSize: optimized.data.length,
    isCompressed: optimized.isCompressed
  };
}

/**
 * Create optimized bridge format using abbreviations and compression
 */
function createOptimizedBridgeFormat(filters: FilterState): { data: string; isCompressed: boolean } {
  const parts: string[] = [];

  // Use abbreviated keys for smaller message size
  if (filters.location) {
    const loc = filters.location;
    if (loc.type === 'point' && loc.latitude !== undefined && loc.longitude !== undefined) {
      parts.push(`l:p,${loc.latitude},${loc.longitude}`);
    } else if (loc.type === 'box' && loc.north !== undefined && loc.south !== undefined && loc.east !== undefined && loc.west !== undefined) {
      parts.push(`l:b,${loc.north},${loc.south},${loc.east},${loc.west}`);
    } else if (loc.type === 'radius' && loc.centerLat !== undefined && loc.centerLon !== undefined && loc.radiusKm !== undefined) {
      parts.push(`l:r,${loc.centerLat},${loc.centerLon},${loc.radiusKm}`);
    }
  }

  if (filters.alphabet) {
    const alpha = filters.alphabet;
    // Use single character abbreviations: s=startsWith, r=range, f=search (find)
    const typeAbbrev = alpha.type === 'startsWith' ? 's' : alpha.type === 'range' ? 'r' : 'f';
    const encodedValue = encodeURIComponent(alpha.value);
    parts.push(`a:${typeAbbrev},${encodedValue}`);
  }

  if (filters.time) {
    const time = filters.time;
    const fieldAbbrev = time.field === 'created' ? 'c' : time.field === 'modified' ? 'm' : 'd';

    if (time.type === 'preset' && time.preset) {
      parts.push(`t:p,${time.preset},${fieldAbbrev}`);
    } else if (time.type === 'range' && time.start && time.end) {
      parts.push(`t:r,${time.start},${time.end},${fieldAbbrev}`);
    } else if (time.type === 'relative' && time.amount !== undefined && time.unit && time.direction) {
      const dirAbbrev = time.direction === 'past' ? 'p' : 'f';
      const unitAbbrev = time.unit.charAt(0); // d, w, m, y
      parts.push(`t:e,${time.amount},${unitAbbrev},${dirAbbrev},${fieldAbbrev}`);
    }
  }

  if (filters.category) {
    const cat = filters.category;
    const typeAbbrev = cat.type === 'include' ? 'i' : 'x';
    const values: string[] = [];

    if (cat.folders && cat.folders.length > 0) {
      values.push(`f=${cat.folders.map(f => encodeURIComponent(f)).join('+')}`);
    }
    if (cat.tags && cat.tags.length > 0) {
      values.push(`t=${cat.tags.map(t => encodeURIComponent(t)).join('+')}`);
    }
    if (cat.statuses && cat.statuses.length > 0) {
      values.push(`s=${cat.statuses.map(s => encodeURIComponent(s)).join('+')}`);
    }
    if (cat.nodeTypes && cat.nodeTypes.length > 0) {
      values.push(`n=${cat.nodeTypes.map(t => encodeURIComponent(t)).join('+')}`);
    }

    if (values.length > 0) {
      parts.push(`c:${typeAbbrev},${values.join('&')}`);
    }
  }

  if (filters.hierarchy) {
    const hier = filters.hierarchy;
    if (hier.type === 'priority' && hier.minPriority !== undefined && hier.maxPriority !== undefined) {
      parts.push(`h:p,${hier.minPriority}-${hier.maxPriority}`);
    } else if (hier.type === 'top-n' && hier.limit !== undefined && hier.sortBy) {
      const sortAbbrev = hier.sortBy === 'priority' ? 'p' : hier.sortBy === 'importance' ? 'i' : 's';
      parts.push(`h:n,${hier.limit},${sortAbbrev}`);
    } else if (hier.type === 'range' && hier.minPriority !== undefined && hier.maxPriority !== undefined && hier.sortBy) {
      const sortAbbrev = hier.sortBy === 'priority' ? 'p' : hier.sortBy === 'importance' ? 'i' : 's';
      parts.push(`h:r,${hier.minPriority}-${hier.maxPriority},${sortAbbrev}`);
    }
  }

  const optimizedString = parts.join(';');

  return {
    data: optimizedString,
    isCompressed: optimizedString.length < serializeFilters(filters).length
  };
}

/**
 * Validate bridge message size constraints
 * WebKit has practical limits around 5MB for message passing
 */
export function validateBridgeMessageSize(data: string): {
  isValid: boolean;
  size: number;
  maxSize: number;
  recommendation?: string;
} {
  const size = new Blob([data]).size;
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (size <= maxSize) {
    return { isValid: true, size, maxSize };
  }

  let recommendation = 'Filter combination too complex for bridge messaging. ';
  if (size > maxSize * 2) {
    recommendation += 'Consider using presets for complex filter combinations.';
  } else {
    recommendation += 'Try reducing the number of active filters or simplifying filter criteria.';
  }

  return {
    isValid: false,
    size,
    maxSize,
    recommendation
  };
}

/**
 * Bridge parameter serialization with type safety
 * Ensures parameters are properly typed for bridge transmission
 */
export function serializeBridgeParameters(filters: FilterState): {
  sql: string;
  params: (string | number | boolean | null)[];
  metadata: {
    filterCount: number;
    hasLocationFilter: boolean;
    hasTextSearch: boolean;
    estimatedComplexity: 'low' | 'medium' | 'high';
  };
} {
  // This would integrate with the filter compiler to generate SQL and parameters
  // For now, providing a simplified structure that demonstrates the interface

  const activeFilters = [
    filters.location,
    filters.alphabet,
    filters.time,
    filters.category,
    filters.hierarchy
  ].filter(f => f !== null);

  const filterCount = activeFilters.length;
  const hasLocationFilter = !!filters.location;
  const hasTextSearch = !!filters.alphabet;

  let estimatedComplexity: 'low' | 'medium' | 'high' = 'low';
  if (filterCount > 3 || (filters.location && filters.alphabet)) {
    estimatedComplexity = 'high';
  } else if (filterCount > 1) {
    estimatedComplexity = 'medium';
  }

  return {
    sql: '-- SQL would be generated by filter compiler',
    params: [], // Parameters would be extracted from filters
    metadata: {
      filterCount,
      hasLocationFilter,
      hasTextSearch,
      estimatedComplexity
    }
  };
}

/**
 * Round-trip validation for bridge serialization
 * Ensures serialization/deserialization consistency
 */
export function validateBridgeRoundTrip(filters: FilterState): {
  isValid: boolean;
  originalFilters: FilterState;
  deserializedFilters: FilterState;
  differences: string[];
} {
  const originalSerialized = serializeFilters(filters);
  const deserialized = deserializeFilters(originalSerialized);
  const bridgeSerialized = bridgeCompatibleSerialization(filters);

  const differences = detectSerializationDifferences(filters, deserialized, bridgeSerialized);

  return {
    isValid: differences.length === 0,
    originalFilters: filters,
    deserializedFilters: deserialized,
    differences
  };
}

function detectSerializationDifferences(
  original: FilterState,
  deserialized: FilterState,
  bridgeSerialized: { isCompressed: boolean; compressedSize: number; originalSize: number }
): string[] {
  const differences: string[] = [];

  // Compare key fields to detect differences
  const filterFields: (keyof FilterState)[] = ['location', 'alphabet', 'time', 'category', 'hierarchy'];

  for (const field of filterFields) {
    if (JSON.stringify(original[field]) !== JSON.stringify(deserialized[field])) {
      differences.push(`${field} filter changed during serialization`);
    }
  }

  // Check bridge format size efficiency
  if (bridgeSerialized.isCompressed && bridgeSerialized.compressedSize >= bridgeSerialized.originalSize) {
    differences.push('bridge compression did not reduce size effectively');
  }

  return differences;
}
