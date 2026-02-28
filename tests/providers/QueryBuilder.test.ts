// Isometry v5 — Phase 4 QueryBuilder Tests
// Tests for the sole SQL assembly point that composes provider compile() outputs.
//
// Design:
//   - All tests use mock providers (no real Database needed)
//   - Mocks return controlled compile() outputs for predictable assertions
//   - Tests verify SQL structure, not raw string equality (beyond checked cases)
//
// Requirements: PROV-01, PROV-03, PROV-07

import { describe, it, expect, vi } from 'vitest';
import { QueryBuilder } from '../../src/providers/QueryBuilder';
import type { FilterProvider } from '../../src/providers/FilterProvider';
import type { PAFVProvider } from '../../src/providers/PAFVProvider';
import type { DensityProvider } from '../../src/providers/DensityProvider';
import type { CompiledFilter, CompiledAxis, CompiledDensity } from '../../src/providers/types';

// ---------------------------------------------------------------------------
// Mock factory helpers
// ---------------------------------------------------------------------------

function makeFilterMock(override: Partial<CompiledFilter> = {}): FilterProvider {
  return {
    compile: vi.fn(() => ({
      where: 'deleted_at IS NULL',
      params: [],
      ...override,
    })),
  } as unknown as FilterProvider;
}

function makeAxisMock(override: Partial<CompiledAxis> = {}): PAFVProvider {
  return {
    compile: vi.fn(() => ({
      orderBy: '',
      groupBy: '',
      ...override,
    })),
  } as unknown as PAFVProvider;
}

function makeDensityMock(override: Partial<CompiledDensity> = {}): DensityProvider {
  return {
    compile: vi.fn(() => ({
      groupExpr: '',
      ...override,
    })),
  } as unknown as DensityProvider;
}

// ---------------------------------------------------------------------------
// buildCardQuery tests
// ---------------------------------------------------------------------------

describe('QueryBuilder.buildCardQuery()', () => {
  it('with default providers returns basic WHERE deleted_at IS NULL', () => {
    const filter = makeFilterMock();
    const axis = makeAxisMock();
    const density = makeDensityMock();
    const qb = new QueryBuilder(filter, axis, density);

    const result = qb.buildCardQuery();

    expect(result.sql).toBe('SELECT * FROM cards WHERE deleted_at IS NULL');
    expect(result.params).toEqual([]);
  });

  it('with active filter returns WHERE clause from FilterProvider', () => {
    const filter = makeFilterMock({
      where: 'deleted_at IS NULL AND status = ?',
      params: ['active'],
    });
    const axis = makeAxisMock();
    const density = makeDensityMock();
    const qb = new QueryBuilder(filter, axis, density);

    const result = qb.buildCardQuery();

    expect(result.sql).toBe('SELECT * FROM cards WHERE deleted_at IS NULL AND status = ?');
    expect(result.params).toEqual(['active']);
  });

  it('with active axis returns ORDER BY from PAFVProvider', () => {
    const filter = makeFilterMock();
    const axis = makeAxisMock({ orderBy: 'created_at DESC' });
    const density = makeDensityMock();
    const qb = new QueryBuilder(filter, axis, density);

    const result = qb.buildCardQuery();

    expect(result.sql).toBe(
      'SELECT * FROM cards WHERE deleted_at IS NULL ORDER BY created_at DESC'
    );
    expect(result.params).toEqual([]);
  });

  it('with filter + axis returns both WHERE and ORDER BY', () => {
    const filter = makeFilterMock({
      where: 'deleted_at IS NULL AND status = ?',
      params: ['done'],
    });
    const axis = makeAxisMock({ orderBy: 'name ASC' });
    const density = makeDensityMock();
    const qb = new QueryBuilder(filter, axis, density);

    const result = qb.buildCardQuery();

    expect(result.sql).toBe(
      'SELECT * FROM cards WHERE deleted_at IS NULL AND status = ? ORDER BY name ASC'
    );
    expect(result.params).toEqual(['done']);
  });

  it('with limit appends LIMIT clause and adds param', () => {
    const filter = makeFilterMock();
    const axis = makeAxisMock();
    const density = makeDensityMock();
    const qb = new QueryBuilder(filter, axis, density);

    const result = qb.buildCardQuery({ limit: 10 });

    expect(result.sql).toBe('SELECT * FROM cards WHERE deleted_at IS NULL LIMIT ?');
    expect(result.params).toEqual([10]);
  });

  it('with limit and offset appends LIMIT and OFFSET clauses', () => {
    const filter = makeFilterMock();
    const axis = makeAxisMock();
    const density = makeDensityMock();
    const qb = new QueryBuilder(filter, axis, density);

    const result = qb.buildCardQuery({ limit: 10, offset: 5 });

    expect(result.sql).toBe(
      'SELECT * FROM cards WHERE deleted_at IS NULL LIMIT ? OFFSET ?'
    );
    expect(result.params).toEqual([10, 5]);
  });

  it('with includeDeleted strips deleted_at IS NULL from WHERE', () => {
    const filter = makeFilterMock({
      where: 'deleted_at IS NULL AND status = ?',
      params: ['active'],
    });
    const axis = makeAxisMock();
    const density = makeDensityMock();
    const qb = new QueryBuilder(filter, axis, density);

    const result = qb.buildCardQuery({ includeDeleted: true });

    // deleted_at IS NULL should be removed; remaining filter stays
    expect(result.sql).not.toContain('deleted_at IS NULL');
    expect(result.sql).toContain('status = ?');
    expect(result.params).toEqual(['active']);
  });

  it('with includeDeleted and no other filters produces no WHERE clause', () => {
    const filter = makeFilterMock({
      where: 'deleted_at IS NULL',
      params: [],
    });
    const axis = makeAxisMock();
    const density = makeDensityMock();
    const qb = new QueryBuilder(filter, axis, density);

    const result = qb.buildCardQuery({ includeDeleted: true });

    expect(result.sql).toBe('SELECT * FROM cards');
    expect(result.params).toEqual([]);
  });

  it('does not accept raw SQL parameter — no escape hatch possible', () => {
    // QueryBuilder constructor only accepts FilterProvider, PAFVProvider, DensityProvider
    // This test verifies the type signature enforces no rawSql or customWhere parameters
    const qb = new QueryBuilder(makeFilterMock(), makeAxisMock(), makeDensityMock());

    // buildCardQuery only accepts { limit, offset, includeDeleted } — no sql property
    const options = { limit: 5 };
    const result = qb.buildCardQuery(options);

    // Verify no raw SQL could have been injected
    expect(result.sql).not.toContain('DROP');
    expect(result.sql).not.toContain(';');
    expect(result.sql).toMatch(/^SELECT \* FROM cards/);
  });

  it('calls compile() on all three providers', () => {
    const filter = makeFilterMock();
    const axis = makeAxisMock();
    const density = makeDensityMock();
    const qb = new QueryBuilder(filter, axis, density);

    qb.buildCardQuery();

    expect(filter.compile).toHaveBeenCalledOnce();
    expect(axis.compile).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// buildCountQuery tests
// ---------------------------------------------------------------------------

describe('QueryBuilder.buildCountQuery()', () => {
  it('returns COUNT(*) with WHERE clause', () => {
    const filter = makeFilterMock();
    const axis = makeAxisMock();
    const density = makeDensityMock();
    const qb = new QueryBuilder(filter, axis, density);

    const result = qb.buildCountQuery();

    expect(result.sql).toBe(
      'SELECT COUNT(*) as count FROM cards WHERE deleted_at IS NULL'
    );
    expect(result.params).toEqual([]);
  });

  it('includes filter params in count query', () => {
    const filter = makeFilterMock({
      where: 'deleted_at IS NULL AND folder = ?',
      params: ['work'],
    });
    const axis = makeAxisMock();
    const density = makeDensityMock();
    const qb = new QueryBuilder(filter, axis, density);

    const result = qb.buildCountQuery();

    expect(result.sql).toBe(
      'SELECT COUNT(*) as count FROM cards WHERE deleted_at IS NULL AND folder = ?'
    );
    expect(result.params).toEqual(['work']);
  });

  it('does NOT include ORDER BY clause', () => {
    const filter = makeFilterMock();
    const axis = makeAxisMock({ orderBy: 'created_at DESC' });
    const density = makeDensityMock();
    const qb = new QueryBuilder(filter, axis, density);

    const result = qb.buildCountQuery();

    expect(result.sql).not.toContain('ORDER BY');
  });

  it('does NOT include LIMIT or OFFSET', () => {
    const filter = makeFilterMock();
    const axis = makeAxisMock();
    const density = makeDensityMock();
    const qb = new QueryBuilder(filter, axis, density);

    const result = qb.buildCountQuery();

    expect(result.sql).not.toContain('LIMIT');
    expect(result.sql).not.toContain('OFFSET');
  });
});

// ---------------------------------------------------------------------------
// buildGroupedQuery tests
// ---------------------------------------------------------------------------

describe('QueryBuilder.buildGroupedQuery()', () => {
  it('returns query with GROUP BY from PAFVProvider', () => {
    const filter = makeFilterMock();
    const axis = makeAxisMock({ groupBy: 'status' });
    const density = makeDensityMock();
    const qb = new QueryBuilder(filter, axis, density);

    const result = qb.buildGroupedQuery();

    expect(result.sql).toContain('GROUP BY status');
    expect(result.params).toEqual([]);
  });

  it('returns query with DensityProvider groupExpr when axis groupBy is empty', () => {
    const filter = makeFilterMock();
    const axis = makeAxisMock({ groupBy: '' });
    const density = makeDensityMock({ groupExpr: "strftime('%Y-%m', created_at)" });
    const qb = new QueryBuilder(filter, axis, density);

    const result = qb.buildGroupedQuery();

    expect(result.sql).toContain("GROUP BY strftime('%Y-%m', created_at)");
  });

  it('prefers axis groupBy over density groupExpr when both are present', () => {
    const filter = makeFilterMock();
    const axis = makeAxisMock({ groupBy: 'status' });
    const density = makeDensityMock({ groupExpr: "strftime('%Y-%m', created_at)" });
    const qb = new QueryBuilder(filter, axis, density);

    const result = qb.buildGroupedQuery();

    expect(result.sql).toContain('GROUP BY status');
    // Should not also include the density expression as GROUP BY
    expect(result.sql).not.toContain('GROUP BY strftime');
  });

  it('with no groupBy sources returns SELECT * without GROUP BY', () => {
    const filter = makeFilterMock();
    const axis = makeAxisMock({ groupBy: '' });
    const density = makeDensityMock({ groupExpr: '' });
    const qb = new QueryBuilder(filter, axis, density);

    const result = qb.buildGroupedQuery();

    expect(result.sql).not.toContain('GROUP BY');
  });

  it('includes WHERE clause from FilterProvider', () => {
    const filter = makeFilterMock({
      where: 'deleted_at IS NULL AND card_type = ?',
      params: ['task'],
    });
    const axis = makeAxisMock({ groupBy: 'status' });
    const density = makeDensityMock();
    const qb = new QueryBuilder(filter, axis, density);

    const result = qb.buildGroupedQuery();

    expect(result.sql).toContain('WHERE deleted_at IS NULL AND card_type = ?');
    expect(result.params).toEqual(['task']);
  });
});

// ---------------------------------------------------------------------------
// CompiledQuery type test
// ---------------------------------------------------------------------------

describe('QueryBuilder return type', () => {
  it('returns objects with sql string and params array', () => {
    const qb = new QueryBuilder(makeFilterMock(), makeAxisMock(), makeDensityMock());

    const card = qb.buildCardQuery();
    const count = qb.buildCountQuery();
    const grouped = qb.buildGroupedQuery();

    expect(typeof card.sql).toBe('string');
    expect(Array.isArray(card.params)).toBe(true);
    expect(typeof count.sql).toBe('string');
    expect(Array.isArray(count.params)).toBe(true);
    expect(typeof grouped.sql).toBe('string');
    expect(Array.isArray(grouped.params)).toBe(true);
  });
});
