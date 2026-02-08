/**
 * MiniNavDemo - Standalone demo for testing MiniNav component
 *
 * Demonstrates MiniNav with useCoordinates and usePAFV hooks.
 * For development and testing purposes.
 *
 * @module components/MiniNavDemo
 */

import MiniNav from './MiniNav';
import { useCoordinates } from '@/hooks';
import { usePAFV } from '../hooks/data/usePAFV';
import { PAFVProvider } from '../state/PAFVContext';
import type { AxisMapping } from '../types/pafv';

/**
 * Inner demo component (must be wrapped in PAFVProvider).
 */
function MiniNavDemoInner() {
  // Initialize coordinate system hook
  const coords = useCoordinates({
    initialPattern: 'anchor',
    initialScale: 1.0,
    initialWidth: 1024,
    initialHeight: 768,
  });

  // Initialize PAFV state hook
  const pafv = usePAFV();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* MiniNav sidebar */}
      <MiniNav
        coordinateSystem={coords.coordinateSystem}
        pafvState={pafv.state}
        onPAFVChange={(newState) => {
          // Check if view mode changed
          if (newState.viewMode !== pafv.state.viewMode) {
            pafv.setViewMode(newState.viewMode);
            return;
          }

          // Handle mapping changes - compare with current state
          const currentMappingKeys = new Set(
            pafv.state.mappings.map((m: AxisMapping) => `${m.plane}:${m.axis}:${m.facet}`)
          );
          const newMappingKeys = new Set(
            newState.mappings.map((m: AxisMapping) => `${m.plane}:${m.axis}:${m.facet}`)
          );

          // Find added/changed mappings
          newState.mappings.forEach((mapping: AxisMapping) => {
            const key = `${mapping.plane}:${mapping.axis}:${mapping.facet}`;
            if (!currentMappingKeys.has(key)) {
              pafv.setMapping(mapping);
            }
          });

          // Find removed mappings
          pafv.state.mappings.forEach((mapping) => {
            const key = `${mapping.plane}:${mapping.axis}:${mapping.facet}`;
            if (!newMappingKeys.has(key)) {
              pafv.removeMapping(mapping.plane);
            }
          });
        }}
        onOriginChange={coords.setOriginPattern}
        onZoom={coords.setScale}
      />

      {/* Main content area (offset by MiniNav width) */}
      <main
        style={{
          marginLeft: '240px',
          flex: 1,
          padding: '24px',
          background: 'var(--cb-bg-base)',
        }}
      >
        <div
          style={{
            maxWidth: '600px',
            background: 'var(--cb-bg-raised)',
            padding: '24px',
            borderRadius: '8px',
            boxShadow: 'var(--cb-shadow-md)',
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--cb-font-sans)',
              fontSize: 'var(--cb-text-2xl)',
              fontWeight: 'var(--cb-font-weight-semibold)',
              color: 'var(--cb-fg-primary)',
              marginBottom: '16px',
            }}
          >
            MiniNav Demo
          </h1>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              fontFamily: 'var(--cb-font-sans)',
              fontSize: 'var(--cb-text-sm)',
              color: 'var(--cb-fg-secondary)',
            }}
          >
            <section>
              <h2
                style={{
                  fontSize: 'var(--cb-text-base)',
                  fontWeight: 'var(--cb-font-weight-semibold)',
                  color: 'var(--cb-fg-primary)',
                  marginBottom: '8px',
                }}
              >
                Current State
              </h2>
              <pre
                style={{
                  background: 'var(--cb-bg-base)',
                  padding: '12px',
                  borderRadius: '4px',
                  border: '1px solid var(--cb-border-default)',
                  fontFamily: 'var(--cb-font-mono)',
                  fontSize: 'var(--cb-text-xs)',
                  overflow: 'auto',
                }}
              >
                {JSON.stringify(
                  {
                    viewMode: pafv.state.viewMode,
                    mappings: pafv.state.mappings,
                    originPattern: coords.originPattern,
                    scale: coords.scale,
                  },
                  null,
                  2
                )}
              </pre>
            </section>

            <section>
              <h2
                style={{
                  fontSize: 'var(--cb-text-base)',
                  fontWeight: 'var(--cb-font-weight-semibold)',
                  color: 'var(--cb-fg-primary)',
                  marginBottom: '8px',
                }}
              >
                Instructions
              </h2>
              <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
                <li>Click view buttons to switch between Grid and List</li>
                <li>Drag LATCH axes to plane drop zones (X, Y, Color, Size)</li>
                <li>Select facet from dropdown after assigning axis</li>
                <li>Click origin pattern buttons to switch Anchor/Bipolar</li>
                <li>Use +/- buttons to zoom in/out</li>
                <li>Click zoom percentage to reset to 100%</li>
              </ul>
            </section>

            <section>
              <h2
                style={{
                  fontSize: 'var(--cb-text-base)',
                  fontWeight: 'var(--cb-font-weight-semibold)',
                  color: 'var(--cb-fg-primary)',
                  marginBottom: '8px',
                }}
              >
                Testing Checklist
              </h2>
              <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
                <li>✓ MiniNav renders in fixed sidebar</li>
                <li>✓ ViewSwitcher shows Grid/List/Kanban (Kanban disabled)</li>
                <li>✓ AxisNavigator shows draggable LATCH axes</li>
                <li>✓ Drag-and-drop works smoothly</li>
                <li>✓ Facet dropdown appears after axis assignment</li>
                <li>✓ OriginPatternSelector shows Anchor/Bipolar</li>
                <li>✓ ZoomControls show +/- and current zoom</li>
                <li>✓ State updates visible in JSON display</li>
              </ul>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Demo component showing MiniNav in action.
 * Wrapped with PAFVProvider for state management.
 *
 * @example
 * ```tsx
 * // In App.tsx or a route
 * <MiniNavDemo />
 * ```
 */
export function MiniNavDemo() {
  return (
    <PAFVProvider>
      <MiniNavDemoInner />
    </PAFVProvider>
  );
}

export default MiniNavDemo;
