// Isometry v13.0 — Phase 163 Projection State Machine
// Pure transition functions over the Projection type.
// Reference equality contract: no-op transitions return the EXACT input reference.
//
// Requirements: PROJ-01, PROJ-02, PROJ-03, PROJ-04, PROJ-05, PROJ-06, PROJ-07

// ---------------------------------------------------------------------------
// String literal union types (D-01, D-03)
// ---------------------------------------------------------------------------

export type CanvasType = 'Explorer' | 'View' | 'Editor';
export type CanvasBinding = 'Bound' | 'Unbound';
export type ZoneRole = 'primary' | 'secondary' | 'tertiary';

// ---------------------------------------------------------------------------
// Projection interface (D-02)
// All fields readonly; enabledTabIds is ReadonlyArray for JSON round-trip safety.
// ---------------------------------------------------------------------------

export interface Projection {
	readonly canvasType: CanvasType;
	readonly canvasBinding: CanvasBinding;
	readonly zoneRole: ZoneRole;
	readonly canvasId: string;
	readonly activeTabId: string;
	readonly enabledTabIds: ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// ValidationResult discriminated union (D-05)
// Used by Plan 02's validateProjection (not implemented here).
// ---------------------------------------------------------------------------

export type ValidationResult = { valid: true } | { valid: false; reason: string };

// ---------------------------------------------------------------------------
// CanvasComponent interface (D-02, Phase 164)
// Plug-in contract that canvas implementations must satisfy.
// SuperWidget calls mount/destroy via this interface; never imports concrete classes.
// ---------------------------------------------------------------------------

export interface CanvasComponent {
  mount(container: HTMLElement): void;
  destroy(): void;
  onProjectionChange?(proj: Projection): void;
}

// ---------------------------------------------------------------------------
// Transition functions (D-04, D-06)
// Guard paths MUST return the input reference directly — never spread on no-op.
// ---------------------------------------------------------------------------

/**
 * Switch the active tab to `tabId`.
 * Returns original reference if tabId is not in enabledTabIds or is already active.
 */
export function switchTab(proj: Projection, tabId: string): Projection {
	if (!proj.enabledTabIds.includes(tabId)) return proj;
	if (proj.activeTabId === tabId) return proj;
	return { ...proj, activeTabId: tabId };
}

/**
 * Transition to a new canvas by setting canvasId and canvasType together.
 * Returns original reference if both values are already current (no-op).
 */
export function setCanvas(proj: Projection, canvasId: string, canvasType: CanvasType): Projection {
	if (proj.canvasId === canvasId && proj.canvasType === canvasType) return proj;
	return { ...proj, canvasId, canvasType };
}

/**
 * Set the canvas binding.
 * 'Bound' is only valid when canvasType is 'View'; returns original reference otherwise.
 * Returns original reference if binding is already current.
 */
export function setBinding(proj: Projection, binding: CanvasBinding): Projection {
	if (binding === 'Bound' && proj.canvasType !== 'View') return proj;
	if (proj.canvasBinding === binding) return proj;
	return { ...proj, canvasBinding: binding };
}

/**
 * Toggle a tab's enabled state.
 * - If tabId is NOT in enabledTabIds: adds it (new Projection).
 * - If tabId IS in enabledTabIds AND is the current activeTabId: returns original reference (guard).
 * - If tabId IS in enabledTabIds AND is NOT activeTabId: removes it (new Projection).
 */
export function toggleTabEnabled(proj: Projection, tabId: string): Projection {
	const isEnabled = proj.enabledTabIds.includes(tabId);

	if (isEnabled) {
		// Guard: never remove the active tab
		if (proj.activeTabId === tabId) return proj;
		return { ...proj, enabledTabIds: proj.enabledTabIds.filter((id) => id !== tabId) };
	}

	// Tab is not currently enabled — add it
	return { ...proj, enabledTabIds: [...proj.enabledTabIds, tabId] };
}

// ---------------------------------------------------------------------------
// validateProjection (D-05)
// Returns first violation only. Check order is intentional:
//   1. enabledTabIds.length === 0 must come before activeTabId membership check
//      (empty array makes the includes() check vacuously false, masking the real error)
//   2. activeTabId in enabledTabIds
//   3. Bound binding on non-View canvas type
//   4. empty canvasId
// Never throws — all invalid states return {valid: false, reason}.
// ---------------------------------------------------------------------------

/**
 * Validate a Projection, returning the first violation found.
 * Returns {valid: true} for a well-formed Projection.
 * Never throws — invalid states return {valid: false, reason}.
 */
export function validateProjection(proj: Projection): ValidationResult {
	if (proj.enabledTabIds.length === 0)
		return { valid: false, reason: 'enabledTabIds must not be empty' };
	if (!proj.enabledTabIds.includes(proj.activeTabId))
		return { valid: false, reason: 'activeTabId must be in enabledTabIds' };
	if (proj.canvasBinding === 'Bound' && proj.canvasType !== 'View')
		return { valid: false, reason: 'Bound binding requires View canvas type' };
	if (proj.canvasId === '')
		return { valid: false, reason: 'canvasId must not be empty' };
	return { valid: true };
}
