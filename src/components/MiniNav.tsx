/**
 * MiniNav - GridBlock 1: Control panel for SuperGrid navigation
 *
 * Provides view switching, axis-to-plane mapping, origin pattern selection,
 * and zoom controls. This is the "meta-tool" interface inspired by Lotus Improv's
 * dimension pane and Interface Builder's inspector palette.
 *
 * Key UX principle: MiniNav manipulates the grid's coordinate system, not the data.
 *
 * @module components/MiniNav
 */

import type { CoordinateSystem, OriginPattern } from '../types/coordinates';
import type { PAFVState } from '../types/pafv';
import { ViewType } from '../types/views';
import ViewSwitcher from './ViewSwitcher';
import AxisNavigator from './AxisNavigator';
import OriginPatternSelector from './OriginPatternSelector';
import ZoomControls from './ZoomControls';
import '../styles/MiniNav.css';

export interface MiniNavProps {
  /** Current coordinate system configuration */
  coordinateSystem: CoordinateSystem;

  /** Current PAFV state (axis mappings + view mode) */
  pafvState: PAFVState;

  /** Callback when PAFV state changes (axis mapping) */
  onPAFVChange: (newState: PAFVState) => void;

  /** Callback when origin pattern changes */
  onOriginChange: (pattern: OriginPattern) => void;

  /** Callback when zoom level changes */
  onZoom: (scale: number) => void;
}

/**
 * MiniNav component - main control panel for SuperGrid.
 *
 * Layout: Fixed sidebar with 4 stacked sections:
 * 1. ViewSwitcher (Grid | List | Kanban)
 * 2. AxisNavigator (Drag LATCH axes to planes)
 * 3. OriginPatternSelector (Anchor | Bipolar)
 * 4. ZoomControls (+/- buttons + scale display)
 *
 * @example
 * ```tsx
 * <MiniNav
 *   coordinateSystem={coords.coordinateSystem}
 *   pafvState={pafv.state}
 *   onPAFVChange={pafv.setState}
 *   onOriginChange={coords.setOriginPattern}
 *   onZoom={coords.setScale}
 * />
 * ```
 */
export function MiniNav({
  coordinateSystem,
  pafvState,
  onPAFVChange,
  onOriginChange,
  onZoom,
}: MiniNavProps) {
  return (
    <aside className="mininav" role="navigation" aria-label="SuperGrid Navigation">
      <div className="mininav-container">
        {/* Section 1: View Mode Toggle */}
        <section className="mininav-section">
          <h2 className="mininav-section-title">View</h2>
          <ViewSwitcher
            currentView={pafvState.viewMode === 'grid' ? ViewType.SUPERGRID : ViewType.LIST}
            onViewChange={(mode) => {
              // Map ViewType to PAFVState viewMode
              if (mode === ViewType.SUPERGRID) {
                onPAFVChange({ ...pafvState, viewMode: 'grid' });
              } else if (mode === ViewType.LIST) {
                onPAFVChange({ ...pafvState, viewMode: 'list' });
              }
            }}
          />
        </section>

        {/* Section 2: Axis Navigation (Drag & Drop) */}
        <section className="mininav-section">
          <h2 className="mininav-section-title">Axes</h2>
          <AxisNavigator pafvState={pafvState} onPAFVChange={onPAFVChange} />
        </section>

        {/* Section 3: Origin Pattern Selection */}
        <section className="mininav-section">
          <h2 className="mininav-section-title">Origin</h2>
          <OriginPatternSelector
            currentPattern={coordinateSystem.pattern}
            onPatternChange={onOriginChange}
          />
        </section>

        {/* Section 4: Zoom Controls */}
        <section className="mininav-section">
          <h2 className="mininav-section-title">Zoom</h2>
          <ZoomControls currentScale={coordinateSystem.scale} onZoom={onZoom} />
        </section>
      </div>
    </aside>
  );
}

export default MiniNav;
