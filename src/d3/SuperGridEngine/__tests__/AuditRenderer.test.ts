/**
 * AuditRenderer Tests - TDD for SuperAudit computed value highlighting
 *
 * Tests cover:
 * - ValueSource type validation
 * - CellAuditInfo tracking
 * - AuditState management with recent changes cleanup
 * - Overlay tinting for computed/enriched/formula cells
 * - CRUD flash animations (create=green, update=blue, delete=red)
 * - Audit toggle enable/disable
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  AuditRenderer,
  type ValueSource,
  type CellAuditInfo,
  type AuditState,
  createAuditState,
  getAuditTintColor,
  getIndicatorColor,
  CRUD_FLASH_COLORS,
  AUDIT_TINT_COLORS,
} from '../AuditRenderer';

describe('AuditRenderer Types', () => {
  describe('ValueSource', () => {
    it('should accept valid source types', () => {
      const sources: ValueSource[] = ['raw', 'computed', 'enriched', 'formula'];
      expect(sources).toHaveLength(4);
    });
  });

  describe('CellAuditInfo', () => {
    it('should create valid audit info for raw cells', () => {
      const info: CellAuditInfo = {
        source: 'raw',
      };
      expect(info.source).toBe('raw');
      expect(info.computedAt).toBeUndefined();
    });

    it('should create valid audit info for computed cells', () => {
      const info: CellAuditInfo = {
        source: 'computed',
        computedAt: '2026-02-13T00:00:00Z',
      };
      expect(info.source).toBe('computed');
      expect(info.computedAt).toBeDefined();
    });

    it('should create valid audit info for formula cells', () => {
      const info: CellAuditInfo = {
        source: 'formula',
        formula: 'SUM(A1:A10)',
        computedAt: '2026-02-13T00:00:00Z',
      };
      expect(info.source).toBe('formula');
      expect(info.formula).toBe('SUM(A1:A10)');
    });

    it('should create valid audit info for enriched cells', () => {
      const info: CellAuditInfo = {
        source: 'enriched',
        enrichedBy: 'alto-importer',
      };
      expect(info.source).toBe('enriched');
      expect(info.enrichedBy).toBe('alto-importer');
    });
  });

  describe('AuditState', () => {
    it('should create default audit state', () => {
      const state = createAuditState();
      expect(state.enabled).toBe(false);
      expect(state.showFormulas).toBe(false);
      expect(state.recentChanges.size).toBe(0);
    });

    it('should track recent changes', () => {
      const state = createAuditState();
      state.recentChanges.set('cell-1', { type: 'create', timestamp: Date.now() });
      state.recentChanges.set('cell-2', { type: 'update', timestamp: Date.now() });

      expect(state.recentChanges.size).toBe(2);
      expect(state.recentChanges.get('cell-1')?.type).toBe('create');
    });
  });
});

describe('Audit Color Functions', () => {
  describe('getAuditTintColor', () => {
    it('should return blue tint for computed cells', () => {
      expect(getAuditTintColor('computed')).toBe(AUDIT_TINT_COLORS.computed);
    });

    it('should return green tint for enriched cells', () => {
      expect(getAuditTintColor('enriched')).toBe(AUDIT_TINT_COLORS.enriched);
    });

    it('should return purple tint for formula cells', () => {
      expect(getAuditTintColor('formula')).toBe(AUDIT_TINT_COLORS.formula);
    });

    it('should return transparent for raw cells', () => {
      expect(getAuditTintColor('raw')).toBe('transparent');
    });
  });

  describe('getIndicatorColor', () => {
    it('should return solid blue for computed cells', () => {
      expect(getIndicatorColor('computed')).toBe('#3B82F6');
    });

    it('should return solid green for enriched cells', () => {
      expect(getIndicatorColor('enriched')).toBe('#10B981');
    });

    it('should return solid purple for formula cells', () => {
      expect(getIndicatorColor('formula')).toBe('#8B5CF6');
    });

    it('should return transparent for raw cells', () => {
      expect(getIndicatorColor('raw')).toBe('transparent');
    });
  });

  describe('CRUD_FLASH_COLORS', () => {
    it('should have green for create', () => {
      expect(CRUD_FLASH_COLORS.create).toBe('#10B981');
    });

    it('should have blue for update', () => {
      expect(CRUD_FLASH_COLORS.update).toBe('#3B82F6');
    });

    it('should have red for delete', () => {
      expect(CRUD_FLASH_COLORS.delete).toBe('#EF4444');
    });
  });
});

describe('AuditRenderer', () => {
  let renderer: AuditRenderer;

  beforeEach(() => {
    renderer = new AuditRenderer();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with disabled state', () => {
      const state = renderer.getState();
      expect(state.enabled).toBe(false);
    });
  });

  describe('setEnabled', () => {
    it('should enable audit mode', () => {
      renderer.setEnabled(true);
      expect(renderer.getState().enabled).toBe(true);
    });

    it('should disable audit mode', () => {
      renderer.setEnabled(true);
      renderer.setEnabled(false);
      expect(renderer.getState().enabled).toBe(false);
    });
  });

  describe('setShowFormulas', () => {
    it('should enable formula display', () => {
      renderer.setShowFormulas(true);
      expect(renderer.getState().showFormulas).toBe(true);
    });
  });

  describe('trackChange', () => {
    it('should track create change', () => {
      renderer.trackChange('cell-1', 'create');
      const state = renderer.getState();

      expect(state.recentChanges.has('cell-1')).toBe(true);
      expect(state.recentChanges.get('cell-1')?.type).toBe('create');
    });

    it('should track update change', () => {
      renderer.trackChange('cell-2', 'update');
      const state = renderer.getState();

      expect(state.recentChanges.get('cell-2')?.type).toBe('update');
    });

    it('should track delete change', () => {
      renderer.trackChange('cell-3', 'delete');
      const state = renderer.getState();

      expect(state.recentChanges.get('cell-3')?.type).toBe('delete');
    });

    it('should clean up old changes after 2 seconds', () => {
      renderer.trackChange('cell-1', 'create');

      expect(renderer.getState().recentChanges.has('cell-1')).toBe(true);

      // Advance time by 2 seconds
      vi.advanceTimersByTime(2000);

      expect(renderer.getState().recentChanges.has('cell-1')).toBe(false);
    });

    it('should update timestamp when same cell changes again', () => {
      renderer.trackChange('cell-1', 'create');
      const firstTimestamp = renderer.getState().recentChanges.get('cell-1')?.timestamp;

      vi.advanceTimersByTime(500);

      renderer.trackChange('cell-1', 'update');
      const secondTimestamp = renderer.getState().recentChanges.get('cell-1')?.timestamp;

      expect(secondTimestamp).toBeGreaterThan(firstTimestamp!);
      expect(renderer.getState().recentChanges.get('cell-1')?.type).toBe('update');
    });
  });

  describe('getAuditInfo', () => {
    it('should return undefined for cells without audit info', () => {
      expect(renderer.getAuditInfo('unknown-cell')).toBeUndefined();
    });

    it('should return audit info after setting it', () => {
      const info: CellAuditInfo = {
        source: 'computed',
        computedAt: '2026-02-13T00:00:00Z',
      };

      renderer.setAuditInfo('cell-1', info);

      expect(renderer.getAuditInfo('cell-1')).toEqual(info);
    });
  });

  describe('clearAllAuditInfo', () => {
    it('should clear all cell audit info', () => {
      renderer.setAuditInfo('cell-1', { source: 'computed' });
      renderer.setAuditInfo('cell-2', { source: 'enriched' });

      renderer.clearAllAuditInfo();

      expect(renderer.getAuditInfo('cell-1')).toBeUndefined();
      expect(renderer.getAuditInfo('cell-2')).toBeUndefined();
    });
  });

  describe('shouldRenderOverlay', () => {
    it('should return false when audit disabled', () => {
      renderer.setEnabled(false);
      renderer.setAuditInfo('cell-1', { source: 'computed' });

      expect(renderer.shouldRenderOverlay('cell-1')).toBe(false);
    });

    it('should return false for raw cells', () => {
      renderer.setEnabled(true);
      renderer.setAuditInfo('cell-1', { source: 'raw' });

      expect(renderer.shouldRenderOverlay('cell-1')).toBe(false);
    });

    it('should return true for computed cells when enabled', () => {
      renderer.setEnabled(true);
      renderer.setAuditInfo('cell-1', { source: 'computed' });

      expect(renderer.shouldRenderOverlay('cell-1')).toBe(true);
    });

    it('should return true for enriched cells when enabled', () => {
      renderer.setEnabled(true);
      renderer.setAuditInfo('cell-1', { source: 'enriched' });

      expect(renderer.shouldRenderOverlay('cell-1')).toBe(true);
    });

    it('should return true for formula cells when enabled', () => {
      renderer.setEnabled(true);
      renderer.setAuditInfo('cell-1', { source: 'formula' });

      expect(renderer.shouldRenderOverlay('cell-1')).toBe(true);
    });
  });

  describe('hasRecentChange', () => {
    it('should return false for cells without recent changes', () => {
      expect(renderer.hasRecentChange('cell-1')).toBe(false);
    });

    it('should return true for cells with recent changes', () => {
      renderer.trackChange('cell-1', 'create');
      expect(renderer.hasRecentChange('cell-1')).toBe(true);
    });

    it('should return false after cleanup timeout', () => {
      renderer.trackChange('cell-1', 'create');
      vi.advanceTimersByTime(2000);

      expect(renderer.hasRecentChange('cell-1')).toBe(false);
    });
  });

  describe('getRecentChangeType', () => {
    it('should return undefined for cells without changes', () => {
      expect(renderer.getRecentChangeType('cell-1')).toBeUndefined();
    });

    it('should return change type for tracked cells', () => {
      renderer.trackChange('cell-1', 'create');
      expect(renderer.getRecentChangeType('cell-1')).toBe('create');

      renderer.trackChange('cell-2', 'update');
      expect(renderer.getRecentChangeType('cell-2')).toBe('update');
    });
  });

  describe('getFlashColor', () => {
    it('should return undefined for cells without recent changes', () => {
      expect(renderer.getFlashColor('cell-1')).toBeUndefined();
    });

    it('should return green for create operations', () => {
      renderer.trackChange('cell-1', 'create');
      expect(renderer.getFlashColor('cell-1')).toBe(CRUD_FLASH_COLORS.create);
    });

    it('should return blue for update operations', () => {
      renderer.trackChange('cell-1', 'update');
      expect(renderer.getFlashColor('cell-1')).toBe(CRUD_FLASH_COLORS.update);
    });

    it('should return red for delete operations', () => {
      renderer.trackChange('cell-1', 'delete');
      expect(renderer.getFlashColor('cell-1')).toBe(CRUD_FLASH_COLORS.delete);
    });
  });

  describe('getOverlayColor', () => {
    it('should return transparent for cells without audit info', () => {
      expect(renderer.getOverlayColor('cell-1')).toBe('transparent');
    });

    it('should return blue tint for computed cells', () => {
      renderer.setAuditInfo('cell-1', { source: 'computed' });
      expect(renderer.getOverlayColor('cell-1')).toBe(AUDIT_TINT_COLORS.computed);
    });

    it('should return green tint for enriched cells', () => {
      renderer.setAuditInfo('cell-1', { source: 'enriched' });
      expect(renderer.getOverlayColor('cell-1')).toBe(AUDIT_TINT_COLORS.enriched);
    });

    it('should return purple tint for formula cells', () => {
      renderer.setAuditInfo('cell-1', { source: 'formula' });
      expect(renderer.getOverlayColor('cell-1')).toBe(AUDIT_TINT_COLORS.formula);
    });
  });

  describe('getCellIndicatorColor', () => {
    it('should return transparent for cells without audit info', () => {
      expect(renderer.getCellIndicatorColor('cell-1')).toBe('transparent');
    });

    it('should return solid blue for computed cells', () => {
      renderer.setAuditInfo('cell-1', { source: 'computed' });
      expect(renderer.getCellIndicatorColor('cell-1')).toBe('#3B82F6');
    });

    it('should return solid green for enriched cells', () => {
      renderer.setAuditInfo('cell-1', { source: 'enriched' });
      expect(renderer.getCellIndicatorColor('cell-1')).toBe('#10B981');
    });

    it('should return solid purple for formula cells', () => {
      renderer.setAuditInfo('cell-1', { source: 'formula' });
      expect(renderer.getCellIndicatorColor('cell-1')).toBe('#8B5CF6');
    });
  });

  describe('destroy', () => {
    it('should clear all state and cancel timeouts', () => {
      renderer.setAuditInfo('cell-1', { source: 'computed' });
      renderer.trackChange('cell-1', 'update');

      renderer.destroy();

      expect(renderer.getAuditInfo('cell-1')).toBeUndefined();
      expect(renderer.hasRecentChange('cell-1')).toBe(false);
    });
  });
});
