import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { SuperGridV4Demo } from './components/SuperGridV4Demo';
import type { Database } from 'sql.js';

/**
 * P0 Gate Test: sql.js + D3.js Direct Integration
 *
 * This component verifies the critical Phase 1 requirements:
 * 1. sql.js initialization with FTS5 support
 * 2. Recursive CTEs for graph traversal
 * 3. Direct D3.js data binding (no bridge)
 * 4. Basic SuperGrid rendering
 *
 * Success = Foundation is ready for SuperGrid Phase 2
 */

interface TestResult {
  phase: string;
  success: boolean;
  message: string;
  data?: unknown;
}

interface CardData {
  id: unknown;
  name: unknown;
  content: unknown;
  x: number;
  y: number;
  status: unknown;
  priority: unknown;
}

export function SQLiteP0GateTest() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const [database, setDatabase] = useState<Database | null>(null);

  const addResult = (result: TestResult) => {
    setResults(prev => [...prev, result]);
  };

  const runP0Tests = async () => {
    setIsRunning(true);
    setResults([]);

    try {
      // Phase 1: Initialize sql.js with FTS5 - Use same working package as SQLiteProvider
      addResult({ phase: 'SQL.js Init', success: false, message: 'Starting sql.js initialization...' });

      const initSqlJs = (await import('sql.js')).default;

      const SQL = await initSqlJs({
        locateFile: (file: string) => {
          console.warn('Loading WASM:', file);
          return `/wasm/${file}`;
        }
      });

      const db = new SQL.Database();
      setDatabase(db);

      addResult({
        phase: 'SQL.js Init',
        success: true,
        message: '✅ sql.js-fts5 initialized successfully'
      });

      // Phase 2: Test FTS5 functionality
      addResult({ phase: 'FTS5 Test', success: false, message: 'Testing FTS5 search...' });

      db.run(`
        CREATE VIRTUAL TABLE docs USING fts5(title, body);
        INSERT INTO docs VALUES('SuperGrid', 'PAFV spatial projection system');
        INSERT INTO docs VALUES('LATCH', 'Location Alphabet Time Category Hierarchy');
        INSERT INTO docs VALUES('D3.js', 'Data visualization with enter update exit');
      `);

      const ftsResult = db.exec("SELECT * FROM docs WHERE docs MATCH 'spatial'");

      if (ftsResult[0]?.values?.length > 0) {
        addResult({
          phase: 'FTS5 Test',
          success: true,
          message: `✅ FTS5 search working: ${ftsResult[0].values.length} results`,
          data: ftsResult[0].values
        });
      } else {
        throw new Error('FTS5 search returned no results');
      }

      // Phase 3: Test Recursive CTEs
      addResult({ phase: 'CTE Test', success: false, message: 'Testing recursive CTEs...' });

      db.run(`
        CREATE TABLE edges (source TEXT, target TEXT, label TEXT);
        INSERT INTO edges VALUES
          ('SuperGrid', 'PAFV', 'uses'),
          ('PAFV', 'D3.js', 'renders_with'),
          ('D3.js', 'SQL', 'binds_to'),
          ('SQL', 'FTS5', 'searches_with');
      `);

      const cteResult = db.exec(`
        WITH RECURSIVE path(node, target, depth, path_str) AS (
          SELECT source, target, 0, source || ' → ' || target
          FROM edges WHERE source = 'SuperGrid'
          UNION ALL
          SELECT e.source, e.target, p.depth + 1,
                 p.path_str || ' → ' || e.target
          FROM path p
          JOIN edges e ON e.source = p.target
          WHERE p.depth < 5
        )
        SELECT * FROM path ORDER BY depth;
      `);

      if (cteResult[0]?.values?.length > 0) {
        addResult({
          phase: 'CTE Test',
          success: true,
          message: `✅ Recursive CTEs working: ${cteResult[0].values.length} path steps`,
          data: cteResult[0].values
        });
      } else {
        throw new Error('Recursive CTE returned no results');
      }

      // Phase 4: Create sample data for SuperGrid test
      addResult({ phase: 'Data Setup', success: false, message: 'Creating sample cards...' });

      db.run(`
        CREATE TABLE nodes (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          content TEXT,
          x_pos INTEGER DEFAULT 0,
          y_pos INTEGER DEFAULT 0,
          status TEXT DEFAULT 'active',
          priority INTEGER DEFAULT 1
        );
      `);

      // Insert sample cards in a grid pattern
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 4; y++) {
          const id = `card-${x}-${y}`;
          const name = `Card ${x},${y}`;
          const content = `Sample content for position (${x}, ${y})`;
          const status = ['active', 'done', 'todo'][Math.floor(Math.random() * 3)];
          const priority = Math.floor(Math.random() * 5) + 1;

          db.run(
            `INSERT INTO nodes (id, name, content, x_pos, y_pos, status, priority)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, name, content, x * 100, y * 80, status, priority]
          );
        }
      }

      addResult({
        phase: 'Data Setup',
        success: true,
        message: '✅ Created 20 sample cards in grid layout'
      });

      // Phase 5: D3.js Direct Data Binding
      addResult({ phase: 'D3 Binding', success: false, message: 'Testing D3.js data binding...' });

      const cardsResult = db.exec(`
        SELECT id, name, content, x_pos, y_pos, status, priority
        FROM nodes ORDER BY y_pos, x_pos
      `);

      if (!cardsResult[0]?.values) {
        throw new Error('No card data retrieved');
      }

      // Transform SQL result to D3-friendly format
      const cards: CardData[] = cardsResult[0].values.map((row: unknown[]) => ({
        id: row[0],
        name: row[1],
        content: row[2],
        x: row[3] as number,
        y: row[4] as number,
        status: row[5],
        priority: row[6]
      }));

      // Direct D3.js rendering
      if (svgRef.current) {
        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove(); // Clear previous render

        const cardGroups = svg
          .selectAll('.card')
          .data(cards, (d) => (d as CardData).id as string) // Key function for proper data binding
          .join(
            enter => enter.append('g').attr('class', 'card'),
            update => update,
            exit => exit.remove()
          );

        // Position cards
        cardGroups
          .attr('transform', d => `translate(${d.x + 20}, ${d.y + 20})`);

        // Draw card backgrounds
        cardGroups
          .append('rect')
          .attr('width', 80)
          .attr('height', 60)
          .attr('rx', 4)
          .attr('fill', d => {
            switch (d.status) {
              case 'done': return '#10B981';
              case 'todo': return '#F59E0B';
              default: return '#3B82F6';
            }
          })
          .attr('stroke', '#1F2937')
          .attr('stroke-width', 1);

        // Add card text
        cardGroups
          .append('text')
          .attr('x', 40)
          .attr('y', 35)
          .attr('text-anchor', 'middle')
          .attr('font-size', '10px')
          .attr('fill', 'white')
          .text(d => String(d.name));

        addResult({
          phase: 'D3 Binding',
          success: true,
          message: `✅ D3.js rendered ${cards.length} cards with direct sql.js binding`,
          data: { cardCount: cards.length }
        });
      }

      // FINAL VERDICT
      addResult({
        phase: 'P0 Gate',
        success: true,
        message: '🎉 P0 GATE PASSED: sql.js + D3.js foundation ready for SuperGrid Phase 2!'
      });

    } catch (error: unknown) {
      addResult({
        phase: 'ERROR',
        success: false,
        message: `❌ P0 Gate Failed: ${error instanceof Error ? error.message : String(error)}`
      });
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    // Auto-run tests on component mount
    runP0Tests();
  }, []);

  const allTestsPassed = results.length > 0 && results.every(r => r.success);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        Isometry v4 - P0 Gate Verification
      </h1>

      <div className="mb-6">
        <p className="text-gray-600 mb-2">
          Testing the critical foundation requirements for SuperGrid Phase 2:
        </p>
        <ul className="text-sm text-gray-500 list-disc ml-6">
          <li>sql.js-fts5 initialization and WASM loading</li>
          <li>FTS5 full-text search capabilities</li>
          <li>Recursive CTEs for graph traversal</li>
          <li>Direct sql.js → D3.js data binding (no bridge)</li>
          <li>Basic grid rendering with proper data joins</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Test Results */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Test Results</h2>

          <div className="space-y-2">
            {results.map((result, i) => (
              <div
                key={i}
                className={`p-3 rounded-md border ${
                  result.success
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                }`}
              >
                <div className="font-medium">{result.phase}</div>
                <div className="text-sm">{result.message}</div>
                {result.data != null ? (
                  <details className="text-xs mt-1">
                    <summary>Data</summary>
                    <pre className="mt-1 p-2 bg-white rounded text-gray-600">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </div>
            ))}
          </div>

          {!isRunning && (
            <button
              onClick={runP0Tests}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Rerun Tests
            </button>
          )}
        </div>

        {/* D3.js Visualization */}
        <div>
          <h2 className="text-lg font-semibold mb-3">SuperGrid Preview</h2>

          <div className="border rounded-lg p-4 bg-gray-50">
            <svg
              ref={svgRef}
              width="480"
              height="360"
              className="border rounded bg-white"
              style={{ maxWidth: '100%', height: 'auto' }}
            >
              <text x="240" y="180" textAnchor="middle" className="text-gray-400">
                {isRunning ? 'Running tests...' : 'D3.js visualization will appear here'}
              </text>
            </svg>
          </div>

          <div className="mt-3 text-sm text-gray-600">
            {allTestsPassed && (
              <div className="p-3 bg-green-50 border border-green-200 rounded">
                <strong>✅ Foundation Ready!</strong><br />
                sql.js + D3.js direct binding is working. SuperGrid Phase 2 can proceed.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SuperGrid v4 Demo */}
      {allTestsPassed && database && (
        <div className="mt-6">
          <h2 className="text-xl font-bold mb-4">SuperGrid v4 Live Demo</h2>
          <p className="text-gray-600 mb-4">
            With the foundation verified, here's SuperGrid running with direct sql.js → D3.js binding:
          </p>
          <SuperGridV4Demo database={database} className="border rounded-lg" />
        </div>
      )}

      {/* Status Summary */}
      <div className="mt-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
        <h3 className="font-semibold text-blue-900">Architecture Verification</h3>
        <p className="text-blue-800 text-sm mt-1">
          This test validates the core v4 architecture principle: <strong>Bridge Elimination</strong>.
          SQL queries execute synchronously in the same JavaScript runtime as D3.js rendering.
          No MessageBridge, no serialization overhead, no async complexity.
        </p>
      </div>
    </div>
  );
}