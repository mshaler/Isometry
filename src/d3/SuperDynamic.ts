/**
 * SuperDynamic D3.js Engine - Core axis repositioning system
 *
 * Section 2.2 of SuperGrid specification: Drag-and-drop axis repositioning
 * that enables "any axis maps to any plane" as direct manipulation.
 *
 * Architecture: sql.js + D3.js direct rendering without bridge overhead
 * Performance target: Grid reflow < 500ms at 60fps
 *
 * @module d3/SuperDynamic
 */

import * as d3 from 'd3';
import type { ViewAxisMapping } from '../types/views';
import type {
  SuperDynamicConfig,
  DragState,
  GridReflowOptions
} from '../types/supergrid';

export interface SuperDynamicEngine {
  /** Initialize the engine with container and config */
  init(container: HTMLElement, config: SuperDynamicConfig): void;

  /** Update axis assignments and trigger reflow */
  updateAxisMapping(mapping: ViewAxisMapping): Promise<void>;

  /** Start drag operation for an axis */
  startDrag(axisId: string, sourceSlot: 'x' | 'y' | 'z', event: MouseEvent): void;

  /** Handle axis drop onto target slot */
  handleDrop(sourceAxis: string, targetSlot: 'x' | 'y' | 'z'): Promise<void>;

  /** Cancel current drag operation */
  cancelDrag(): void;

  /** Destroy the engine and clean up */
  destroy(): void;
}

export class SuperDynamicD3Engine implements SuperDynamicEngine {
  private container: HTMLElement | null = null;
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private config: SuperDynamicConfig | null = null;
  private dragState: DragState | null = null;
  private currentMapping: ViewAxisMapping = {};
  private animationFrame: number | null = null;
  private ghostElement: HTMLElement | null = null;

  // Event handlers for external communication
  private onAxisChange: ((mapping: ViewAxisMapping) => void) | null = null;
  private onReflowStart: (() => void) | null = null;
  private onReflowComplete: (() => void) | null = null;

  init(container: HTMLElement, config: SuperDynamicConfig): void {
    this.container = container;
    this.config = config;
    this.setupSVGCanvas();
    this.setupDropZones();
    this.bindEventHandlers();
  }

  private setupSVGCanvas(): void {
    if (!this.container || !this.config) return;

    // Create SVG container for D3 rendering
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('class', 'superdynamic-svg')
      .attr('width', this.config.width)
      .attr('height', this.config.height)
      .style('position', 'absolute')
      .style('top', 0)
      .style('left', 0)
      .style('pointer-events', 'none');

    // Create visual layers
    this.svg.append('g').attr('class', 'reflow-overlay');
    this.svg.append('g').attr('class', 'drop-indicators');
    this.svg.append('g').attr('class', 'connection-lines');
  }

  private setupDropZones(): void {
    if (!this.container || !this.config) return;

    // Create HTML drop zones for each axis slot
    const axisSlots = ['x', 'y', 'z'] as const;

    axisSlots.forEach(slot => {
      const slotConfig = this.config!.axisSlots[slot];
      if (!slotConfig) return;

      const dropZone = document.createElement('div');
      dropZone.className = `superdynamic-drop-zone superdynamic-drop-zone--${slot}`;
      dropZone.dataset.axisSlot = slot;

      // Position based on slot configuration
      Object.assign(dropZone.style, {
        position: 'absolute',
        left: `${slotConfig.x}px`,
        top: `${slotConfig.y}px`,
        width: `${slotConfig.width}px`,
        height: `${slotConfig.height}px`,
        border: '2px dashed transparent',
        borderRadius: '4px',
        transition: 'all 0.2s ease',
        zIndex: '10'
      });

      // Add drop event handlers
      this.setupDropZoneHandlers(dropZone, slot);
      this.container!.appendChild(dropZone);
    });
  }

  private setupDropZoneHandlers(dropZone: HTMLElement, slot: 'x' | 'y' | 'z'): void {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.highlightDropZone(slot, true);
    });

    dropZone.addEventListener('dragleave', (e) => {
      // Only remove highlight if actually leaving the zone
      const rect = dropZone.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;

      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        this.highlightDropZone(slot, false);
      }
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.highlightDropZone(slot, false);

      if (this.dragState) {
        this.handleDrop(this.dragState.axisId, slot);
      }
    });
  }

  private highlightDropZone(slot: 'x' | 'y' | 'z', highlight: boolean): void {
    const dropZone = this.container?.querySelector(`.superdynamic-drop-zone--${slot}`) as HTMLElement;
    if (!dropZone) return;

    if (highlight) {
      dropZone.style.borderColor = '#6366f1';
      dropZone.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';

      // Add visual indicator with D3
      this.showDropIndicator(slot);
    } else {
      dropZone.style.borderColor = 'transparent';
      dropZone.style.backgroundColor = 'transparent';

      // Remove D3 indicator
      this.hideDropIndicator(slot);
    }
  }

  private showDropIndicator(slot: 'x' | 'y' | 'z'): void {
    if (!this.svg || !this.config) return;

    const slotConfig = this.config.axisSlots[slot];
    if (!slotConfig) return;

    const indicators = this.svg.select('.drop-indicators');

    // Remove existing indicator for this slot
    indicators.select(`.drop-indicator--${slot}`).remove();

    // Create new drop indicator
    const indicator = indicators
      .append('g')
      .attr('class', `drop-indicator drop-indicator--${slot}`);

    // Animated drop target visual
    const rect = indicator
      .append('rect')
      .attr('x', slotConfig.x)
      .attr('y', slotConfig.y)
      .attr('width', slotConfig.width)
      .attr('height', slotConfig.height)
      .attr('fill', 'none')
      .attr('stroke', '#6366f1')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5')
      .attr('rx', 4);

    // Animate dash offset for visual feedback
    rect.attr('stroke-dashoffset', 10)
        .transition()
        .duration(1000)
        .ease(d3.easeLinear)
        .attr('stroke-dashoffset', 0)
        .on('end', function() {
          d3.select(this).attr('stroke-dashoffset', 10);
        });
  }

  private hideDropIndicator(slot: 'x' | 'y' | 'z'): void {
    if (!this.svg) return;

    this.svg.select('.drop-indicators')
           .select(`.drop-indicator--${slot}`)
           .transition()
           .duration(200)
           .style('opacity', 0)
           .remove();
  }

  private bindEventHandlers(): void {
    if (!this.container) return;

    // Global mouse event handlers for drag operations
    document.addEventListener('mousemove', this.handleGlobalMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleGlobalMouseUp.bind(this));

    // Keyboard shortcuts
    document.addEventListener('keydown', this.handleKeydown.bind(this));
  }

  startDrag(axisId: string, sourceSlot: 'x' | 'y' | 'z', event: MouseEvent): void {
    if (!this.config) return;

    this.dragState = {
      axisId,
      sourceSlot,
      startPosition: { x: event.clientX, y: event.clientY },
      currentPosition: { x: event.clientX, y: event.clientY },
      isDragging: true,
      startTime: performance.now()
    };

    // Create ghost element for visual feedback
    this.createGhostElement(axisId, event);

    // Start reflow preview if enabled
    if (this.config.enableReflowPreview) {
      this.startReflowPreview();
    }

    // Emit drag start event
    if (this.onReflowStart) {
      this.onReflowStart();
    }
  }

  private createGhostElement(axisId: string, event: MouseEvent): void {
    if (!this.container) return;

    this.ghostElement = document.createElement('div');
    this.ghostElement.className = 'superdynamic-ghost';
    this.ghostElement.textContent = this.getAxisDisplayName(axisId);

    Object.assign(this.ghostElement.style, {
      position: 'fixed',
      left: `${event.clientX - 50}px`,
      top: `${event.clientY - 15}px`,
      padding: '4px 12px',
      background: '#6366f1',
      color: 'white',
      borderRadius: '4px',
      fontSize: '14px',
      pointerEvents: 'none',
      zIndex: '1000',
      opacity: '0.9',
      transform: 'scale(1.1)',
      transition: 'transform 0.2s ease',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
    });

    document.body.appendChild(this.ghostElement);

    // Animate ghost appearance
    requestAnimationFrame(() => {
      if (this.ghostElement) {
        this.ghostElement.style.transform = 'scale(1)';
      }
    });
  }

  private getAxisDisplayName(axisId: string): string {
    // Extract display name from axis mapping
    const axis = Object.values(this.currentMapping).find(a => a && a.facet === axisId);
    return axis?.label || axisId;
  }

  private handleGlobalMouseMove(event: MouseEvent): void {
    if (!this.dragState || !this.ghostElement) return;

    // Update drag state
    this.dragState.currentPosition = { x: event.clientX, y: event.clientY };

    // Update ghost position
    this.ghostElement.style.left = `${event.clientX - 50}px`;
    this.ghostElement.style.top = `${event.clientY - 15}px`;

    // Update drop zone highlighting based on mouse position
    this.updateDropZoneHighlighting(event);
  }

  private updateDropZoneHighlighting(event: MouseEvent): void {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const dropZone = element?.closest('.superdynamic-drop-zone') as HTMLElement;

    if (dropZone) {
      const slot = dropZone.dataset.axisSlot as 'x' | 'y' | 'z';

      // Highlight only this zone
      ['x', 'y', 'z'].forEach(s => {
        this.highlightDropZone(s as 'x' | 'y' | 'z', s === slot);
      });
    } else {
      // Clear all highlights
      ['x', 'y', 'z'].forEach(s => {
        this.highlightDropZone(s as 'x' | 'y' | 'z', false);
      });
    }
  }

  private handleGlobalMouseUp(event: MouseEvent): void {
    if (!this.dragState) return;

    // Find drop target
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const dropZone = element?.closest('.superdynamic-drop-zone') as HTMLElement;

    if (dropZone) {
      const targetSlot = dropZone.dataset.axisSlot as 'x' | 'y' | 'z';
      this.handleDrop(this.dragState.axisId, targetSlot);
    } else {
      this.cancelDrag();
    }
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.dragState) {
      this.cancelDrag();
    }
  }

  async handleDrop(sourceAxis: string, targetSlot: 'x' | 'y' | 'z'): Promise<void> {
    if (!this.dragState || !this.config) return;

    const duration = performance.now() - this.dragState.startTime;

    // Clear drag state first
    const oldMapping = { ...this.currentMapping };
    this.cleanup();

    try {
      // Create new axis mapping
      const newMapping = this.computeNewMapping(sourceAxis, targetSlot, oldMapping);

      // Trigger grid reflow with animation
      await this.animateGridReflow(oldMapping, newMapping);

      // Update internal state
      this.currentMapping = newMapping;

      // Notify external listeners
      if (this.onAxisChange) {
        this.onAxisChange(newMapping);
      }

      // Emit completion event
      if (this.onReflowComplete) {
        this.onReflowComplete();
      }

      console.log(`SuperDynamic: Axis drop completed in ${duration.toFixed(1)}ms`);

    } catch (error) {
      console.error('SuperDynamic: Drop operation failed', error);

      // Restore previous mapping on error
      this.currentMapping = oldMapping;
      if (this.onAxisChange) {
        this.onAxisChange(oldMapping);
      }
    }
  }

  private computeNewMapping(
    sourceAxis: string,
    targetSlot: 'x' | 'y' | 'z',
    oldMapping: ViewAxisMapping
  ): ViewAxisMapping {
    // Find the source axis in current mapping
    let sourceSlot: 'x' | 'y' | 'z' | null = null;
    if (oldMapping.xAxis?.facet === sourceAxis) sourceSlot = 'x';
    else if (oldMapping.yAxis?.facet === sourceAxis) sourceSlot = 'y';
    else if (oldMapping.zAxis?.facet === sourceAxis) sourceSlot = 'z';

    const newMapping = { ...oldMapping };

    if (sourceSlot) {
      // Axis swap: move source axis to target slot
      const sourceAxisConfig = oldMapping[`${sourceSlot}Axis`];
      const targetAxisConfig = oldMapping[`${targetSlot}Axis`];

      // Clear source slot
      delete newMapping[`${sourceSlot}Axis`];

      // Move source to target
      if (sourceAxisConfig) {
        newMapping[`${targetSlot}Axis`] = sourceAxisConfig as any;
      }

      // Move target to source (if target had content)
      if (targetAxisConfig && sourceSlot !== targetSlot) {
        newMapping[`${sourceSlot}Axis`] = targetAxisConfig as any;
      }
    } else {
      // New axis assignment from available pool
      // This would require access to available axes list
      // For now, create a basic axis configuration
      newMapping[`${targetSlot}Axis`] = {
        latchDimension: this.inferLATCHDimension(sourceAxis),
        facet: sourceAxis,
        label: this.getAxisDisplayName(sourceAxis)
      } as any;
    }

    return newMapping;
  }

  private inferLATCHDimension(facet: string): 'L' | 'A' | 'T' | 'C' | 'H' {
    // Infer LATCH dimension from facet name
    const facetLower = facet.toLowerCase();

    if (facetLower.includes('location') || facetLower.includes('place') ||
        facetLower.includes('geo') || facetLower.includes('address')) {
      return 'L';
    }
    if (facetLower.includes('name') || facetLower.includes('title') ||
        facetLower.includes('alpha') || facetLower.includes('sort')) {
      return 'A';
    }
    if (facetLower.includes('time') || facetLower.includes('date') ||
        facetLower.includes('created') || facetLower.includes('modified') ||
        facetLower.includes('year') || facetLower.includes('month')) {
      return 'T';
    }
    if (facetLower.includes('category') || facetLower.includes('tag') ||
        facetLower.includes('type') || facetLower.includes('status') ||
        facetLower.includes('folder')) {
      return 'C';
    }
    if (facetLower.includes('priority') || facetLower.includes('importance') ||
        facetLower.includes('level') || facetLower.includes('rank') ||
        facetLower.includes('hierarchy')) {
      return 'H';
    }

    // Default fallback
    return 'C';
  }

  private async animateGridReflow(
    _oldMapping: ViewAxisMapping,
    _newMapping: ViewAxisMapping,
    options?: GridReflowOptions
  ): Promise<void> {
    if (!this.svg || !this.config) return;

    const config = { ...this.config.defaultReflowOptions, ...options };

    // Create reflow overlay
    const overlay = this.svg.select('.reflow-overlay');

    // Clear any existing reflow animation
    overlay.selectAll('*').remove();

    // Create visual feedback during reflow
    const reflowRect = overlay
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', this.config.width)
      .attr('height', this.config.height)
      .attr('fill', 'rgba(99, 102, 241, 0.05)')
      .attr('stroke', 'rgba(99, 102, 241, 0.2)')
      .attr('stroke-width', 2)
      .attr('opacity', 0);

    // Animate overlay appearance
    await new Promise<void>((resolve) => {
      reflowRect
        .transition()
        .duration(config.duration / 4)
        .ease(d3.easeQuadOut)
        .attr('opacity', 1)
        .transition()
        .duration(config.duration * 3 / 4)
        .ease(d3.easeQuadOut)
        .attr('opacity', 0)
        .on('end', () => {
          overlay.selectAll('*').remove();
          resolve();
        });
    });
  }

  private startReflowPreview(): void {
    // Show preview of how grid will change during drag
    // This could highlight affected cells, show connection lines, etc.
    // Implementation depends on grid structure
  }

  cancelDrag(): void {
    this.cleanup();

    // Clear all drop zone highlights
    ['x', 'y', 'z'].forEach(slot => {
      this.highlightDropZone(slot as 'x' | 'y' | 'z', false);
    });

    console.log('SuperDynamic: Drag operation cancelled');
  }

  private cleanup(): void {
    // Clear drag state
    this.dragState = null;

    // Remove ghost element
    if (this.ghostElement) {
      this.ghostElement.remove();
      this.ghostElement = null;
    }

    // Cancel animation frame if active
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  async updateAxisMapping(mapping: ViewAxisMapping): Promise<void> {
    if (!this.config) return;

    const oldMapping = this.currentMapping;
    this.currentMapping = mapping;

    // Animate transition to new mapping
    await this.animateGridReflow(oldMapping, mapping);
  }

  // Event handler setters
  setAxisChangeHandler(handler: (mapping: ViewAxisMapping) => void): void {
    this.onAxisChange = handler;
  }

  setReflowStartHandler(handler: () => void): void {
    this.onReflowStart = handler;
  }

  setReflowCompleteHandler(handler: () => void): void {
    this.onReflowComplete = handler;
  }

  destroy(): void {
    this.cleanup();

    // Remove event listeners
    document.removeEventListener('mousemove', this.handleGlobalMouseMove);
    document.removeEventListener('mouseup', this.handleGlobalMouseUp);
    document.removeEventListener('keydown', this.handleKeydown);

    // Remove SVG
    if (this.svg) {
      this.svg.remove();
      this.svg = null;
    }

    // Clear drop zones
    if (this.container) {
      this.container.querySelectorAll('.superdynamic-drop-zone').forEach(el => el.remove());
    }

    // Reset state
    this.container = null;
    this.config = null;
    this.currentMapping = {};
    this.onAxisChange = null;
    this.onReflowStart = null;
    this.onReflowComplete = null;
  }
}

/**
 * Factory function to create SuperDynamic engine instance
 */
export function createSuperDynamicEngine(
  container: HTMLElement,
  config: SuperDynamicConfig
): SuperDynamicEngine {
  const engine = new SuperDynamicD3Engine();
  engine.init(container, config);
  return engine;
}

/**
 * Default SuperDynamic configuration
 */
export const DEFAULT_SUPERDYNAMIC_CONFIG: SuperDynamicConfig = {
  width: 800,
  height: 600,
  enableReflowPreview: true,
  axisSlots: {
    x: { x: 400, y: 500, width: 200, height: 60 },
    y: { x: 50, y: 200, width: 200, height: 60 },
    z: { x: 400, y: 300, width: 200, height: 60 }
  },
  defaultReflowOptions: {
    duration: 400,
    easing: 'ease-out',
    enablePreview: true,
    preserveSelection: true
  }
};