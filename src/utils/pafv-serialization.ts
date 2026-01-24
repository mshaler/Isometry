import type { PAFVState, AxisMapping, Plane, LATCHAxis } from '../types/pafv';
import { DEFAULT_PAFV } from '../types/pafv';

/**
 * Serialize PAFV state to URL-safe string
 * Format: "x=time.year&y=category.tag&view=grid"
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

  // If no valid mappings found, use defaults
  if (mappings.length === 0) {
    return DEFAULT_PAFV;
  }

  return {
    mappings,
    viewMode: validViewMode,
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
