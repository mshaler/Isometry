/**
 * SuperCardRenderer Tests - TDD for SuperCards visual distinction
 *
 * Tests cover:
 * - CardType enum distinguishes data, header, aggregation
 * - isSuperCard helper identifies non-data cards
 * - SuperCard interface has required fields
 * - Chrome gradient styling for headers
 * - Aggregation styling with count display
 */

import { describe, it, expect } from 'vitest';
import {
  CardType,
  SuperCard,
  isSuperCard,
  isSuperCardId,
  createSuperCard,
  CHROME_GRADIENT,
  AGGREGATION_STYLE,
} from '../SuperCardRenderer';

describe('SuperCard Types', () => {
  describe('CardType enum', () => {
    it('should have data type', () => {
      const cardType: CardType = 'data';
      expect(cardType).toBe('data');
    });

    it('should have header type', () => {
      const cardType: CardType = 'header';
      expect(cardType).toBe('header');
    });

    it('should have aggregation type', () => {
      const cardType: CardType = 'aggregation';
      expect(cardType).toBe('aggregation');
    });
  });

  describe('isSuperCard', () => {
    it('should return true for header type', () => {
      const card: SuperCard = createSuperCard({
        id: 'header-1',
        type: 'header',
        gridX: 0,
        gridY: 0,
        width: 100,
        height: 40,
      });
      expect(isSuperCard(card)).toBe(true);
    });

    it('should return true for aggregation type', () => {
      const card: SuperCard = createSuperCard({
        id: 'agg-1',
        type: 'aggregation',
        gridX: 0,
        gridY: 5,
        width: 100,
        height: 32,
        aggregationType: 'count',
        aggregationValue: 10,
      });
      expect(isSuperCard(card)).toBe(true);
    });

    it('should return false for data type', () => {
      const card: SuperCard = createSuperCard({
        id: 'cell-1',
        type: 'data',
        gridX: 1,
        gridY: 1,
        width: 100,
        height: 80,
      });
      expect(isSuperCard(card)).toBe(false);
    });
  });

  describe('SuperCard interface', () => {
    it('should create header card with headerId and level', () => {
      const card: SuperCard = createSuperCard({
        id: 'header-q1',
        type: 'header',
        headerId: 'column_0_Q1',
        headerLevel: 1,
        gridX: 0,
        gridY: 0,
        width: 200,
        height: 40,
      });

      expect(card.id).toBe('header-q1');
      expect(card.type).toBe('header');
      expect(card.headerId).toBe('column_0_Q1');
      expect(card.headerLevel).toBe(1);
    });

    it('should create aggregation card with type and value', () => {
      const card: SuperCard = createSuperCard({
        id: 'agg-0',
        type: 'aggregation',
        aggregationType: 'count',
        aggregationValue: 25,
        gridX: 0,
        gridY: 10,
        width: 100,
        height: 32,
      });

      expect(card.aggregationType).toBe('count');
      expect(card.aggregationValue).toBe(25);
    });
  });

  describe('Style Constants', () => {
    it('should export chrome gradient colors', () => {
      expect(CHROME_GRADIENT.start).toBe('#f8f8f8');
      expect(CHROME_GRADIENT.end).toBe('#e8e8e8');
    });

    it('should export aggregation style colors', () => {
      expect(AGGREGATION_STYLE.background).toBe('#f0f4f8');
      expect(AGGREGATION_STYLE.border).toBe('#d0d8e0');
      expect(AGGREGATION_STYLE.text).toBe('#4a5568');
    });
  });
});

describe('isSuperCardId', () => {
  it('should return true for header- prefix', () => {
    expect(isSuperCardId('header-q1')).toBe(true);
  });

  it('should return true for agg- prefix', () => {
    expect(isSuperCardId('agg-0')).toBe(true);
  });

  it('should return false for cell- prefix', () => {
    expect(isSuperCardId('cell-1-2')).toBe(false);
  });

  it('should return false for node IDs', () => {
    expect(isSuperCardId('node-abc123')).toBe(false);
  });
});
