import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as d3 from 'd3';
import type { Database } from 'sql.js-fts5';
import { importAltoFiles } from '../alto-importer';
import { classifyProperties } from '@/services/property-classifier';
import { mappingsToProjection } from '@/types/grid';
import { GridRenderingEngine, type RenderingConfig } from '@/d3/grid-rendering/GridRenderingEngine';
import { compileFilterPredicates } from '@/services/query/filterAst';
import { createTestDB, cleanupTestDB, execTestQuery } from '@/test/db-utils';

describe('Alto Notes Pipeline E2E', () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDB({ loadSampleData: false });
  });

  afterEach(async () => {
    // Interrupt any pending D3 transitions before DOM cleanup
    d3.selectAll('*').interrupt();

    if (db) {
      await cleanupTestDB(db);
    }
    document.body.innerHTML = '';
  });

  it('imports notes, stores dynamic properties, aligns projection headers, and applies slider-style filters', () => {
    const files = [
      {
        path: '/notes/project-alpha.md',
        content: `---
title: Project Alpha
folder: Work/Active
status: active
priority: 5
created: 2025-01-10T10:00:00Z
mood: focused
complexity_score: 9
tags: [alpha, urgent, client]
---

Execution plan and milestones.`,
      },
      {
        path: '/notes/project-beta.md',
        content: `---
title: Project Beta
folder: Work/Backlog
status: backlog
priority: 2
created: 2025-01-11T10:00:00Z
mood: calm
complexity_score: 3
tags: [beta]
---

Discovery and research tasks.`,
      },
      {
        path: '/notes/project-gamma.md',
        content: `---
title: Project Gamma
folder: Work/Active
status: active
priority: 4
created: 2025-01-12T10:00:00Z
mood: focused
complexity_score: 7
tags: [gamma, urgent]
---

Execution continuation.`,
      },
    ];

    const importResult = importAltoFiles(db, files, { clearExisting: true });
    expect(importResult.imported).toBe(3);
    expect(importResult.runId).toMatch(/^alto-run-/);
    expect(importResult.reconciliation?.importedByType.notes).toBe(3);

    // Dynamic properties are persisted with typed schema-on-read columns.
    const dynamicRows = execTestQuery(
      db,
      `SELECT key, value_type, value_string, value_number
       FROM node_properties
       WHERE key IN ('mood', 'complexity_score')
       ORDER BY key`
    );
    expect(dynamicRows).toHaveLength(6);
    const moodRow = dynamicRows.find((r) => (r as { key: string }).key === 'mood') as {
      value_type: string;
      value_string: string;
    };
    expect(moodRow.value_type).toBe('string');
    expect(moodRow.value_string).toBeTruthy();

    // Schema-on-read properties are surfaced in classification.
    const classification = classifyProperties(db);
    const dynamicMood = classification.A.find((p) => p.id === 'dynamic-mood');
    expect(dynamicMood).toBeDefined();
    expect(dynamicMood?.sourceColumn).toBe('node_properties.mood');

    // Build a projection and render headers in GridRenderingEngine.
    const cards = execTestQuery(
      db,
      `SELECT id, name, folder, status, priority, created_at
       FROM nodes
       WHERE source = 'alto-index'`
    ) as Array<Record<string, unknown>>;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);
    const selection = d3.select(svg) as unknown as d3.Selection<SVGElement, unknown, null, undefined>;

    const config: RenderingConfig = {
      cardWidth: 200,
      cardHeight: 120,
      padding: 8,
      headerHeight: 40,
      rowHeaderWidth: 140,
      enableHeaders: true,
      enableAnimations: false,
      animationDuration: 0,
    };
    const engine = new GridRenderingEngine(selection, config, {});
    engine.setGridData({
      cards,
      xAxis: { axis: 'x', field: 'folder', values: [], isComputed: false },
      yAxis: { axis: 'y', field: 'status', values: [], isComputed: false },
      totalWidth: 1200,
      totalHeight: 900,
      lastUpdated: Date.now(),
    });
    engine.setProjection(
      mappingsToProjection([
        { plane: 'x', axis: 'category', facet: 'folder' },
        { plane: 'y', axis: 'category', facet: 'status' },
      ])
    );
    engine.render();

    const rowHeaderTexts = Array.from(document.querySelectorAll('.row-header text'))
      .map((el) => el.textContent || '');
    const colHeaderTexts = Array.from(document.querySelectorAll('.col-header text'))
      .map((el) => el.textContent || '');
    expect(rowHeaderTexts.some((t) => t.includes('Work/Active'))).toBe(true);
    expect(colHeaderTexts.some((t) => t.includes('active'))).toBe(true);

    // Slider-style range filter (priority) reduces row count.
    const compiled = compileFilterPredicates([
      { field: 'node_properties.complexity_score', operator: 'range', value: [8, 10] },
    ]);
    const filteredRows = execTestQuery(
      db,
      `SELECT COUNT(*) as count FROM nodes WHERE ${compiled.whereClause}`,
      compiled.parameters as unknown[]
    ) as Array<{ count: number }>;
    const filteredCount = Number(filteredRows[0]?.count ?? 0);
    expect(filteredCount).toBe(1);
  });
});
