import type { PAFVState, AxisMapping, Plane, LATCHAxis, DensityLevel, EncodingConfig } from '../types/pafv';
import { DEFAULT_PAFV } from '../types/pafv';

/**
 * Serialize PAFV state to URL-safe string
 * Format: "x=time.year&y=category.tag&view=grid&density=2&color=priority&size=importance"
 *
 * @param state - PAFV state to serialize
 * @returns URL-safe query string (without leading ?)
 */
export function serializePAFV(state: PAFVState): string {
  const params = new URLSearchParams();

  // Serialize axis mappings
  for (const mapping of state.mappings) {
    const value = `${mapping.axis}.${mapping.facet}`;
    params.set(mapping.plane, value);
  }

  // Serialize view mode
  params.set('view', state.viewMode);

  // Serialize density level
  params.set('density', String(state.densityLevel));

  // Serialize color encoding
  if (state.colorEncoding) {
    params.set('colorEnc', `${state.colorEncoding.property}.${state.colorEncoding.type}`);
  }

  // Serialize size encoding
  if (state.sizeEncoding) {
    params.set('sizeEnc', `${state.sizeEncoding.property}.${state.sizeEncoding.type}`);
  }

  return params.toString();
}

/**
 * Deserialize URL string to PAFV state
 * Handles invalid/missing params gracefully (fallback to defaults)
 *
 * @param urlString - URL query string (e.g., "x=time.year&y=category.tag&view=grid")
 * @returns PAFVState object
 */
export function deserializePAFV(urlString: string): PAFVState {
  const params = new URLSearchParams(urlString);
  const mappings: AxisMapping[] = [];

  // Valid planes and axes for validation
  const validPlanes: Plane[] = ['x', 'y', 'color', 'size', 'shape'];
  const validAxes: LATCHAxis[] = ['location', 'alphabet', 'time', 'category', 'hierarchy'];

  // Parse axis mappings from URL params
  for (const plane of validPlanes) {
    const value = params.get(plane);
    if (value) {
      const [axis, facet] = value.split('.');

      // Validate axis is a valid LATCH axis
      if (validAxes.includes(axis as LATCHAxis) && facet) {
        mappings.push({
          plane,
          axis: axis as LATCHAxis,
          facet,
        });
      } else {
        console.warn(`Invalid PAFV mapping in URL: ${plane}=${value}`);
      }
    }
  }

  // Get view mode (default to 'grid')
  const viewMode = params.get('view');
  const validViewMode = viewMode === 'list' || viewMode === 'grid' ? viewMode : 'grid';

  // Get density level (default to 2 - Extent Density)
  const densityParam = params.get('density');
  const parsedDensity = densityParam ? parseInt(densityParam, 10) : 2;
  const validDensityLevel: DensityLevel =
    (parsedDensity >= 1 && parsedDensity <= 4) ? parsedDensity as DensityLevel : 2;

  // Parse color encoding
  const colorEncParam = params.get('colorEnc');
  let colorEncoding: EncodingConfig | null = null;
  if (colorEncParam) {
    const [property, type] = colorEncParam.split('.');
    if (property && type && ['categorical', 'numeric', 'ordinal'].includes(type)) {
      colorEncoding = {
        property,
        type: type as EncodingConfig['type'],
      };
    }
  }

  // Parse size encoding
  const sizeEncParam = params.get('sizeEnc');
  let sizeEncoding: EncodingConfig | null = null;
  if (sizeEncParam) {
    const [property, type] = sizeEncParam.split('.');
    if (property && type && ['categorical', 'numeric', 'ordinal'].includes(type)) {
      sizeEncoding = {
        property,
        type: type as EncodingConfig['type'],
      };
    }
  }

  // If no valid mappings found, use defaults
  if (mappings.length === 0) {
    return DEFAULT_PAFV;
  }

  return {
    mappings,
    viewMode: validViewMode,
    densityLevel: validDensityLevel,
    colorEncoding,
    sizeEncoding,
    sortConfig: null, // Sort not persisted to URL
  };
}

/**
 * Get axis mapping for a specific plane
 *
 * @param state - PAFV state
 * @param plane - Plane to lookup (e.g., 'x', 'y')
 * @returns AxisMapping or null if not found
 */
export function getMappingForPlane(state: PAFVState, plane: Plane): AxisMapping | null {
  return state.mappings.find(m => m.plane === plane) ?? null;
}

/**
 * Get plane for a specific axis
 *
 * @param state - PAFV state
 * @param axis - LATCH axis to lookup
 * @returns Plane or null if not found
 */
export function getPlaneForAxis(state: PAFVState, axis: LATCHAxis): Plane | null {
  const mapping = state.mappings.find(m => m.axis === axis);
  return mapping ? mapping.plane : null;
}

/**
 * Update or add an axis mapping
 *
 * @param state - Current PAFV state
 * @param mapping - New axis mapping to set
 * @returns Updated PAFV state
 */
export function setMapping(state: PAFVState, mapping: AxisMapping): PAFVState {
  // Remove any existing mapping for this plane
  const filteredMappings = state.mappings.filter(m => m.plane !== mapping.plane);

  return {
    ...state,
    mappings: [...filteredMappings, mapping],
  };
}

/**
 * Remove axis mapping for a plane
 *
 * @param state - Current PAFV state
 * @param plane - Plane to remove mapping from
 * @returns Updated PAFV state
 */
export function removeMapping(state: PAFVState, plane: Plane): PAFVState {
  return {
    ...state,
    mappings: state.mappings.filter(m => m.plane !== plane),
  };
}

/**
 * Remove a specific facet mapping from a plane (for stacked axes)
 *
 * @param state - Current PAFV state
 * @param plane - Plane to remove mapping from
 * @param facet - Specific facet to remove
 * @returns Updated PAFV state
 */
export function removeFacetFromPlane(state: PAFVState, plane: Plane, facet: string): PAFVState {
  return {
    ...state,
    mappings: state.mappings.filter(m => !(m.plane === plane && m.facet === facet)),
  };
}

/**
 * Get all axis mappings for a specific plane (for stacked axes)
 *
 * @param state - PAFV state
 * @param plane - Plane to lookup
 * @returns Array of AxisMappings for that plane (may be empty)
 */
export function getMappingsForPlane(state: PAFVState, plane: Plane): AxisMapping[] {
  return state.mappings.filter(m => m.plane === plane);
}

/**
 * Add a mapping to a plane without replacing existing (for stacked axes)
 *
 * @param state - Current PAFV state
 * @param mapping - New axis mapping to add
 * @returns Updated PAFV state
 */
export function addMappingToPlane(state: PAFVState, mapping: AxisMapping): PAFVState {
  // Check if this exact mapping already exists
  const exists = state.mappings.some(
    m => m.plane === mapping.plane && m.axis === mapping.axis && m.facet === mapping.facet
  );

  if (exists) {
    return state;
  }

  return {
    ...state,
    mappings: [...state.mappings, mapping],
  };
}

/**
 * Reorder mappings within a plane (for stacked axes)
 *
 * @param state - Current PAFV state
 * @param plane - Plane to reorder within
 * @param fromIndex - Source index within the plane's mappings
 * @param toIndex - Target index within the plane's mappings
 * @returns Updated PAFV state
 */
export function reorderMappingsInPlane(
  state: PAFVState,
  plane: Plane,
  fromIndex: number,
  toIndex: number
): PAFVState {
  // Get all mappings for this plane
  const planeMappings = getMappingsForPlane(state, plane);

  if (fromIndex < 0 || fromIndex >= planeMappings.length ||
      toIndex < 0 || toIndex >= planeMappings.length) {
    return state;
  }

  // Reorder the plane mappings
  const reordered = [...planeMappings];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);

  // Get mappings for other planes
  const otherMappings = state.mappings.filter(m => m.plane !== plane);

  return {
    ...state,
    mappings: [...otherMappings, ...reordered],
  };
}
