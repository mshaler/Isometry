/**
 * HeaderKeyboardController - Keyboard navigation for SuperStack headers
 *
 * Implements WCAG 2.4.3 keyboard navigation patterns:
 * - Arrow keys: Navigate between headers (siblings and parent/child)
 * - Enter/Space: Toggle collapse on focused header
 * - Tab: Enter header navigation
 * - Escape: Exit header navigation
 *
 * Phase 91-02: Keyboard Navigation for Headers
 */

import * as d3 from 'd3';

/**
 * Configuration for keyboard navigation behavior.
 */
export interface HeaderKeyboardConfig {
  /** Enable/disable keyboard navigation */
  enableKeyboardNavigation: boolean;
}

/**
 * Callbacks for keyboard-triggered header interactions.
 */
export interface HeaderKeyboardCallbacks {
  /** Called when focus changes to a different header */
  onFocusChange: (headerId: string | null) => void;
  /** Called when Enter/Space toggles collapse on focused header */
  onToggle: (headerId: string) => void;
  /** Called when a header is selected via keyboard */
  onSelect: (headerId: string) => void;
}

/**
 * Parsed header key for navigation relationships.
 * Key format: "{axis}_{level}_{pathJoinedByPipe}"
 * Example: "x_0_Work" or "y_1_Work|Active"
 */
interface ParsedHeaderKey {
  axis: 'x' | 'y';
  level: number;
  path: string[];
  fullPath: string;
}

/**
 * Controller for keyboard navigation within SuperStack headers.
 * Follows patterns from GridSelectionController for consistency.
 */
export class HeaderKeyboardController {
  private container: d3.Selection<SVGElement, unknown, null, undefined>;
  private config: HeaderKeyboardConfig;
  private callbacks: HeaderKeyboardCallbacks;
  private focusedHeaderId: string | null = null;
  private headerIds: string[] = []; // Ordered list for navigation

  constructor(
    container: d3.Selection<SVGElement, unknown, null, undefined>,
    config: HeaderKeyboardConfig,
    callbacks: HeaderKeyboardCallbacks
  ) {
    this.container = container;
    this.config = config;
    this.callbacks = callbacks;

    this.setupKeyboardHandlers();
  }

  /**
   * Set the ordered list of header IDs for navigation.
   * Should be called when header trees change.
   */
  public setHeaderIds(ids: string[]): void {
    this.headerIds = ids;
  }

  /**
   * Focus the container to enable keyboard navigation.
   * Called when Tab enters the header area.
   */
  public focus(): void {
    const node = this.container.node();
    if (node) {
      node.focus();
      // Focus first header if none focused
      if (!this.focusedHeaderId && this.headerIds.length > 0) {
        this.focusHeader(this.headerIds[0]);
      }
    }
  }

  /**
   * Get the currently focused header ID.
   */
  public getFocusedHeaderId(): string | null {
    return this.focusedHeaderId;
  }

  /**
   * Cleanup event listeners.
   */
  public destroy(): void {
    this.container.on('keydown.header-keyboard', null);
    this.container.on('focus.header-keyboard', null);
  }

  /**
   * Setup keyboard event handlers on the container.
   */
  private setupKeyboardHandlers(): void {
    this.container
      .attr('tabindex', '0')
      .attr('role', 'treegrid')
      .attr('aria-label', 'SuperGrid headers')
      .on('keydown.header-keyboard', (event: KeyboardEvent) => {
        if (!this.config.enableKeyboardNavigation) return;
        this.handleKeydown(event);
      })
      .on('focus.header-keyboard', () => {
        // When container receives focus, focus first header if none selected
        if (!this.focusedHeaderId && this.headerIds.length > 0) {
          this.focusHeader(this.headerIds[0]);
        }
      });
  }

  /**
   * Handle keyboard events for navigation and interaction.
   * Follows GridSelectionController pattern.
   */
  private handleKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        this.focusNext();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.focusPrev();
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.focusChild(); // Move to first child header
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.focusParent(); // Move to parent header
        break;
      case 'Enter':
      case ' ': // Space
        event.preventDefault();
        if (this.focusedHeaderId) {
          this.callbacks.onToggle(this.focusedHeaderId);
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.callbacks.onFocusChange(null);
        this.focusedHeaderId = null;
        break;
      case 'Home':
        event.preventDefault();
        this.focusFirst();
        break;
      case 'End':
        event.preventDefault();
        this.focusLast();
        break;
      default:
        // No action for other keys
        break;
    }
  }

  /**
   * Focus a specific header by ID.
   */
  private focusHeader(headerId: string): void {
    this.focusedHeaderId = headerId;
    this.callbacks.onFocusChange(headerId);

    // Programmatically focus the DOM element
    const element = this.container
      .select(`[data-header-id="${headerId}"]`)
      .node() as SVGGElement | null;

    if (element) {
      element.focus();
    }
  }

  /**
   * Move focus to the next sibling at the same level.
   * Uses linear navigation through headerIds array.
   */
  private focusNext(): void {
    if (!this.focusedHeaderId || this.headerIds.length === 0) {
      if (this.headerIds.length > 0) {
        this.focusHeader(this.headerIds[0]);
      }
      return;
    }

    const parsed = this.parseHeaderKey(this.focusedHeaderId);
    if (!parsed) return;

    // Find siblings at the same level and axis
    const siblings = this.headerIds.filter((id) => {
      const p = this.parseHeaderKey(id);
      return p && p.axis === parsed.axis && p.level === parsed.level;
    });

    const currentIndex = siblings.indexOf(this.focusedHeaderId);
    if (currentIndex >= 0 && currentIndex < siblings.length - 1) {
      this.focusHeader(siblings[currentIndex + 1]);
    }
  }

  /**
   * Move focus to the previous sibling at the same level.
   */
  private focusPrev(): void {
    if (!this.focusedHeaderId || this.headerIds.length === 0) {
      if (this.headerIds.length > 0) {
        this.focusHeader(this.headerIds[this.headerIds.length - 1]);
      }
      return;
    }

    const parsed = this.parseHeaderKey(this.focusedHeaderId);
    if (!parsed) return;

    // Find siblings at the same level and axis
    const siblings = this.headerIds.filter((id) => {
      const p = this.parseHeaderKey(id);
      return p && p.axis === parsed.axis && p.level === parsed.level;
    });

    const currentIndex = siblings.indexOf(this.focusedHeaderId);
    if (currentIndex > 0) {
      this.focusHeader(siblings[currentIndex - 1]);
    }
  }

  /**
   * Move focus to the first child header (if expanded).
   * Child headers have level + 1 and path that starts with current path.
   */
  private focusChild(): void {
    if (!this.focusedHeaderId) return;

    const parsed = this.parseHeaderKey(this.focusedHeaderId);
    if (!parsed) return;

    // Find first child: same axis, level + 1, path starts with current path
    const child = this.headerIds.find((id) => {
      const p = this.parseHeaderKey(id);
      if (!p || p.axis !== parsed.axis || p.level !== parsed.level + 1) {
        return false;
      }
      // Child path should start with parent path
      return (
        p.path.length === parsed.path.length + 1 &&
        parsed.path.every((segment, i) => p.path[i] === segment)
      );
    });

    if (child) {
      this.focusHeader(child);
    }
  }

  /**
   * Move focus to the parent header.
   * Parent has level - 1 and path that is a prefix of current path.
   */
  private focusParent(): void {
    if (!this.focusedHeaderId) return;

    const parsed = this.parseHeaderKey(this.focusedHeaderId);
    if (!parsed || parsed.level === 0) return; // Already at root level

    // Find parent: same axis, level - 1, path is prefix of current path
    const parentPath = parsed.path.slice(0, -1);
    const parentKey = `${parsed.axis}_${parsed.level - 1}_${parentPath.join('|')}`;

    if (this.headerIds.includes(parentKey)) {
      this.focusHeader(parentKey);
    }
  }

  /**
   * Move focus to the first header.
   */
  private focusFirst(): void {
    if (this.headerIds.length > 0) {
      this.focusHeader(this.headerIds[0]);
    }
  }

  /**
   * Move focus to the last header.
   */
  private focusLast(): void {
    if (this.headerIds.length > 0) {
      this.focusHeader(this.headerIds[this.headerIds.length - 1]);
    }
  }

  /**
   * Parse a header key into its components.
   * Key format: "{axis}_{level}_{pathJoinedByPipe}"
   * Example: "x_0_Work" or "y_1_Work|Active"
   */
  private parseHeaderKey(key: string): ParsedHeaderKey | null {
    const parts = key.split('_');
    if (parts.length < 3) return null;

    const axis = parts[0] as 'x' | 'y';
    if (axis !== 'x' && axis !== 'y') return null;

    const level = parseInt(parts[1], 10);
    if (isNaN(level)) return null;

    // Rejoin everything after axis and level (handles values containing underscores)
    const pathPart = parts.slice(2).join('_');
    const path = pathPart.split('|');

    return {
      axis,
      level,
      path,
      fullPath: pathPart,
    };
  }
}
