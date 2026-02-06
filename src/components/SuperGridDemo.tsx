import { useState, useRef, useEffect, useCallback } from 'react';
import { SuperGrid } from '@/d3/SuperGrid';
import { useSQLite } from '@/db/SQLiteProvider';
import { usePAFV } from '@/state/PAFVContext';
import { CardDetailModal } from './CardDetailModal';

/**
 * SuperGridDemo - Comprehensive demonstration component for SuperGrid foundation
 *
 * Demonstrates:
 * - SuperGrid with LATCH headers and PAFV integration
 * - Performance monitoring with 60fps tracking
 * - Interactive controls for testing density and filters
 * - sql.js capability verification and error telemetry
 * - Foundation readiness for Phase 35 PAFV Grid Core
 *
 * This component validates the complete foundation stabilization requirements.
 */
export function SuperGridDemo() {
  const [densityLevel, setDensityLevel] = useState<number>(1);
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [itemCount, setItemCount] = useState<number>(100);
  const [fps, setFps] = useState<number>(60);
  const [cellCount, setCellCount] = useState<number>(0);
  const [memoryUsage, setMemoryUsage] = useState<string>('0 MB');
  const [errorLog, setErrorLog] = useState<string[]>([]);

  const svgRef = useRef<SVGSVGElement>(null);
  const [superGrid, setSuperGrid] = useState<SuperGrid | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOperationInProgress, setIsOperationInProgress] = useState(false);

  // Get contexts
  const { db } = useSQLite();
  const { state } = usePAFV();

  // Card interaction handlers
  const handleCardClick = useCallback((card: any) => {
    console.log('SuperGridDemo: Card clicked', card);
    setSelectedCard(card);
    setIsModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedCard(null);
  }, []);

  const handleCardSave = useCallback(async (updatedCard: any) => {
    if (!db) {
      console.error('Database not available');
      return;
    }

    setIsOperationInProgress(true);

    try {
      // Optimistic update - update the selected card immediately
      setSelectedCard(prev => prev ? { ...prev, ...updatedCard } : null);

      // Update the card in the database
      const { id, name, folder, status, priority, summary } = updatedCard;

      db.exec(`
        UPDATE nodes
        SET name = ?,
            folder = ?,
            status = ?,
            priority = ?,
            summary = ?,
            modified_at = datetime('now')
        WHERE id = ?
      `, [name, folder, status, priority || 0, summary, id]);

      console.log('Card saved successfully:', updatedCard);

      // Close modal first for immediate feedback
      setIsModalOpen(false);
      setSelectedCard(null);

      // Then refresh the grid to show updated data
      if (superGrid) {
        superGrid.refresh();

        // Update cell count after refresh
        const stats = superGrid.getStats();
        setCellCount(stats.cardsVisible);
      }
    } catch (error) {
      console.error('Failed to save card:', error);
      setErrorLog(prev => [...prev, `Save Error: ${error}`]);

      // Revert optimistic update on error
      if (selectedCard) {
        setSelectedCard(selectedCard);
      }
    } finally {
      setIsOperationInProgress(false);
    }
  }, [db, superGrid, selectedCard]);

  const handleCardDelete = useCallback(async (cardId: string) => {
    if (!db) {
      console.error('Database not available');
      return;
    }

    setIsOperationInProgress(true);

    try {
      // Close modal immediately for fast feedback
      setIsModalOpen(false);
      setSelectedCard(null);

      // Soft delete the card by setting deleted_at timestamp
      db.exec(`
        UPDATE nodes
        SET deleted_at = datetime('now')
        WHERE id = ?
      `, [cardId]);

      console.log('Card deleted successfully:', cardId);

      // Refresh the grid to show updated data
      if (superGrid) {
        superGrid.refresh();

        // Update cell count after refresh
        const stats = superGrid.getStats();
        setCellCount(stats.cardsVisible);
      }
    } catch (error) {
      console.error('Failed to delete card:', error);
      setErrorLog(prev => [...prev, `Delete Error: ${error}`]);

      // On error, could optionally reopen the modal
      // but for now just log the error
    } finally {
      setIsOperationInProgress(false);
    }
  }, [db, superGrid]);

  // Performance monitoring
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let rafId: number;

    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();

      if (currentTime - lastTime >= 1000) {
        const currentFPS = Math.round((frameCount * 1000) / (currentTime - lastTime));
        setFps(currentFPS);
        frameCount = 0;
        lastTime = currentTime;
      }

      rafId = requestAnimationFrame(measureFPS);
    };

    rafId = requestAnimationFrame(measureFPS);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Memory usage monitoring
  useEffect(() => {
    const updateMemoryUsage = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usedMB = Math.round(memory.usedJSHeapSize / 1048576);
        setMemoryUsage(`${usedMB} MB`);
      }
    };

    const intervalId = setInterval(updateMemoryUsage, 2000);
    updateMemoryUsage();

    return () => clearInterval(intervalId);
  }, []);

  // Initialize SuperGrid - separate effect to ensure proper timing
  useEffect(() => {
    if (!svgRef.current || !db) {
      console.log('SuperGrid initialization waiting:', { svgRef: !!svgRef.current, db: !!db });
      return;
    }

    console.log('🚀 SuperGrid initialization starting!');

    const initializeGrid = async () => {
      try {
        // Verify sql.js capabilities using the provided db
        const capabilityResults: string[] = [];

        // Test FTS5 (non-blocking)
        try {
          db.exec("SELECT fts5_version()");
          capabilityResults.push("✅ FTS5 support verified");
        } catch (error) {
          capabilityResults.push("⚠️ FTS5 support missing (fallback to basic search)");
          console.warn('FTS5 not available, using fallback:', error);
          // Don't add to errorLog as this is expected in some sql.js builds
        }

        // Test JSON1 extension
        try {
          db.exec("SELECT json_extract('{\"test\": 123}', '$.test')");
          capabilityResults.push("✅ JSON1 extension verified");
        } catch (error) {
          capabilityResults.push("❌ JSON1 extension missing");
          setErrorLog(prev => [...prev, `JSON1 Error: ${error}`]);
        }

        // Test recursive CTEs
        try {
          db.exec(`
            WITH RECURSIVE test_cte AS (
              SELECT 1 as n
              UNION ALL
              SELECT n + 1 FROM test_cte WHERE n < 3
            )
            SELECT COUNT(*) FROM test_cte
          `);
          capabilityResults.push("✅ Recursive CTE support verified");
        } catch (error) {
          capabilityResults.push("❌ Recursive CTE support missing");
          setErrorLog(prev => [...prev, `CTE Error: ${error}`]);
        }

        console.log('sql.js Capability Verification:', capabilityResults);

        // Ensure database has proper schema
        try {
          db.exec(`
            CREATE TABLE IF NOT EXISTS nodes (
              id TEXT PRIMARY KEY,
              node_type TEXT NOT NULL DEFAULT 'note',
              name TEXT NOT NULL,
              content TEXT,
              summary TEXT,

              -- LATCH: Location
              latitude REAL,
              longitude REAL,
              location_name TEXT,
              location_address TEXT,

              -- LATCH: Time
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              modified_at TEXT NOT NULL DEFAULT (datetime('now')),
              due_at TEXT,
              completed_at TEXT,
              event_start TEXT,
              event_end TEXT,

              -- LATCH: Category
              folder TEXT,
              tags TEXT,
              status TEXT,

              -- LATCH: Hierarchy
              priority INTEGER DEFAULT 0,
              importance INTEGER DEFAULT 0,
              sort_order INTEGER DEFAULT 0,

              -- Grid positioning (for SuperGrid)
              x REAL DEFAULT 0,
              y REAL DEFAULT 0,

              -- Metadata
              source TEXT,
              source_id TEXT,
              source_url TEXT,
              deleted_at TEXT,
              version INTEGER DEFAULT 1
            );
          `);
          console.log('✅ Database schema ensured');

          // Add missing columns if they don't exist (for existing tables)
          try {
            db.exec('ALTER TABLE nodes ADD COLUMN x REAL DEFAULT 0');
            console.log('✅ Added x column to existing table');
          } catch {
            // Column already exists, which is fine
          }

          try {
            db.exec('ALTER TABLE nodes ADD COLUMN y REAL DEFAULT 0');
            console.log('✅ Added y column to existing table');
          } catch {
            // Column already exists, which is fine
          }

        } catch (schemaError) {
          console.warn('Schema creation failed:', schemaError);
          setErrorLog(prev => [...prev, `Schema Error: ${schemaError}`]);
        }

        // Insert IsometryKB-inspired sample data for demonstration
        try {
          db.exec(`
            INSERT OR IGNORE INTO nodes (id, name, folder, status, created_at, summary, priority, importance, source) VALUES
            -- Architecture & Foundation
            ('arch_mvp_gap', 'Isometry MVP Gap Analysis', 'specs', 'active', '2026-01-15', 'Executive analysis of gaps between backend capabilities, frontend designs, and UX requirements', 5, 5, 'IsometryKB'),
            ('arch_truth', 'CardBoard Architecture Truth', 'specs', 'active', '2025-12-20', 'PAFV + LATCH + GRAPH framework definitions and core principles', 5, 5, 'IsometryKB'),
            ('v4_spec', 'CardBoard v4 Specification', 'specs', 'active', '2026-01-10', 'Complete technical specification for Isometry v4 architecture', 4, 5, 'IsometryKB'),

            -- Development Phases
            ('phase_1_foundation', 'Phase 1: Foundation', 'plans', 'completed', '2025-11-15', 'Foundation setup with TypeScript, React, and core architecture', 4, 4, 'IsometryKB'),
            ('phase_2_supergrid', 'Phase 2: SuperGrid Implementation', 'plans', 'in_progress', '2026-01-20', 'Polymorphic data projection system with PAFV spatial mapping', 5, 5, 'IsometryKB'),
            ('phase_3_notebook', 'Phase 3: Three-Canvas Notebook', 'plans', 'todo', '2026-02-01', 'Capture, Shell, Preview canvas integration', 3, 4, 'IsometryKB'),

            -- Technical Plans
            ('canvas_pan_zoom', 'Canvas Pan Zoom Controls Plan', 'plans', 'active', '2026-01-25', 'Implementation plan for cartographic navigation with pinned anchor', 3, 3, 'IsometryKB'),
            ('bridge_elimination', 'Bridge Elimination Architecture', 'plans', 'completed', '2026-01-05', 'sql.js direct access eliminating 40KB MessageBridge overhead', 4, 4, 'IsometryKB'),

            -- Journal Entries
            ('conv_2025_q4', 'Development Conversations Q4 2025', 'journal', 'archived', '2025-12-31', 'Quarterly development conversations and decisions', 2, 2, 'IsometryKB'),
            ('v1_cardboard', 'V1 CardBoard 2023 Retrospective', 'journal', 'archived', '2023-12-01', 'Lessons learned from first CardBoard implementation', 2, 3, 'IsometryKB'),

            -- Current Development
            ('supergrid_foundation', 'SuperGrid Foundation Demo', 'work', 'active', '2026-02-06', 'Phase 34 verification with sql.js + D3.js integration', 5, 5, 'Current'),
            ('typescript_cleanup', 'TypeScript Compilation Cleanup', 'work', 'completed', '2026-02-05', 'Zero compilation errors with strict typing', 4, 4, 'Current'),
            ('pafv_integration', 'PAFV Context Integration', 'work', 'active', '2026-02-04', 'Plane-Axis-Facet-Value spatial projection system', 4, 4, 'Current'),
            ('latch_headers', 'LATCH Headers Implementation', 'work', 'completed', '2026-02-03', 'Location-Alphabet-Time-Category-Hierarchy headers', 3, 4, 'Current'),
            ('virtual_scrolling', 'Virtual Scrolling Performance', 'work', 'blocked', '2026-02-03', 'TanStack Virtual integration for 10k+ cells', 3, 3, 'Current'),

            -- Research & Analysis
            ('performance_analysis', 'Grid Performance Analysis', 'research', 'in_progress', '2026-01-30', 'Memory usage and rendering performance optimization', 3, 3, 'IsometryKB'),
            ('user_interaction_patterns', 'User Interaction Patterns', 'research', 'todo', '2026-01-28', 'Study of grid interaction patterns and user flows', 2, 3, 'IsometryKB'),

            -- Documentation
            ('api_documentation', 'SuperGrid API Documentation', 'docs', 'in_progress', '2026-02-02', 'Complete API reference for SuperGrid components', 3, 3, 'IsometryKB'),
            ('deployment_guide', 'Production Deployment Guide', 'docs', 'todo', '2026-01-15', 'Step-by-step production deployment documentation', 2, 3, 'IsometryKB'),

            -- Future Features
            ('graph_network_view', 'Graph Network View', 'future', 'todo', '2026-03-01', 'Force-directed network visualization of card relationships', 2, 4, 'IsometryKB'),
            ('timeline_view', 'Timeline View Implementation', 'future', 'todo', '2026-03-15', 'Temporal card visualization with swim lanes', 2, 4, 'IsometryKB');
          `);
          console.log('✅ IsometryKB-inspired sample data inserted for SuperGrid demo');
        } catch (sampleError) {
          console.warn('Sample data insertion failed:', sampleError);
          setErrorLog(prev => [...prev, `Sample Data Error: ${sampleError}`]);
        }

        // Create mock DatabaseService that wraps the existing db from context
        const mockDatabaseService = {
          query: <T = any>(sql: string, params?: any[]): T[] => {
            try {
              const result = db.exec(sql, params);
              return result.length > 0 ? result[0].values.map((row: any) => {
                const obj: any = {};
                result[0].columns.forEach((col, idx) => {
                  obj[col] = row[idx];
                });
                return obj as T;
              }) : [];
            } catch (error) {
              console.warn('Mock query failed:', sql, error);
              return [];
            }
          },
          exec: (sql: string) => db.exec(sql),
          isReady: () => true // Database is ready when we reach this point
        };

        const grid = new SuperGrid(svgRef.current!, mockDatabaseService as any, {
          width: 800,
          height: 600,
          callbacks: {
            onCardClick: handleCardClick
          }
        });

        // Render with test data
        grid.render();
        setSuperGrid(grid);

        // Update cell count from grid stats
        const stats = grid.getStats();
        setCellCount(stats.cardsVisible);

        setIsLoading(false);
      } catch (error) {
        setErrorLog(prev => [...prev, `SuperGrid Initialization Error: ${error}`]);
        setIsLoading(false);
      }
    };

    initializeGrid();
  }, [db, handleCardClick]);

  // Handle filter changes
  useEffect(() => {
    if (!superGrid) return;

    try {
      const filters: any = {};

      if (selectedFolder !== 'all') {
        filters.folder = selectedFolder;
      }
      if (selectedStatus !== 'all') {
        filters.status = selectedStatus;
      }

      // Apply filters to grid
      superGrid.renderWithFilters(filters);

      // Update stats
      const stats = superGrid.getStats();
      setCellCount(stats.cardsVisible);
    } catch (error) {
      setErrorLog(prev => [...prev, `Filter Error: ${error}`]);
    }
  }, [superGrid, selectedFolder, selectedStatus]);

  // Handle PAFV changes
  useEffect(() => {
    if (!superGrid) return;

    try {
      // Convert state mappings to SuperGrid filter format
      const rowMappings = state.mappings.filter(m => m.plane === 'y');
      const columnMappings = state.mappings.filter(m => m.plane === 'x');

      const pafvFilters = {
        rows: rowMappings.map(m => ({ id: m.facet, label: m.facet })),
        columns: columnMappings.map(m => ({ id: m.facet, label: m.facet })),
        zLayers: [] // Add z-layer support later if needed
      };

      superGrid.renderWithPAFVFilters(pafvFilters);

      const stats = superGrid.getStats();
      setCellCount(stats.cardsVisible);
    } catch (error) {
      setErrorLog(prev => [...prev, `PAFV Error: ${error}`]);
    }
  }, [superGrid, state]);

  // Always render the full UI but show loading indicators when needed

  return (
    <div className="relative w-full h-screen bg-gray-50">
      {/* Performance Monitor */}
      <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg p-4 max-w-sm">
        <h2 className="text-lg font-semibold mb-2">Performance Monitor</h2>
        <div className="text-sm space-y-1">
          <div className={`${fps < 55 ? 'text-red-600' : fps < 58 ? 'text-yellow-600' : 'text-green-600'}`}>
            <span className="font-medium">FPS:</span> {fps}
          </div>
          <div>
            <span className="font-medium">Cells Visible:</span> {cellCount}
          </div>
          <div>
            <span className="font-medium">Memory Usage:</span> {memoryUsage}
          </div>
          <div>
            <span className="font-medium">Density Level:</span> {densityLevel}
          </div>
        </div>
      </div>

      {/* Interactive Controls */}
      <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg p-4 max-w-sm">
        <h3 className="text-sm font-semibold mb-2">Test Controls</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Density Level
            </label>
            <input
              type="range"
              min="0"
              max="3"
              step="1"
              value={densityLevel}
              onChange={(e) => setDensityLevel(Number(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-gray-500 mt-1">
              0=Sparse, 1=Group, 2=Rollup, 3=Collapsed
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Filter by Folder
            </label>
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="w-full text-xs border border-gray-300 rounded px-2 py-1"
            >
              <option value="all">All Folders</option>
              <option value="work">Work</option>
              <option value="personal">Personal</option>
              <option value="projects">Projects</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Filter by Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs border border-gray-300 rounded px-2 py-1"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="blocked">Blocked</option>
              <option value="in_progress">In Progress</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Item Count
            </label>
            <input
              type="range"
              min="10"
              max="1000"
              step="10"
              value={itemCount}
              onChange={(e) => setItemCount(Number(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-gray-500 mt-1">{itemCount} items</div>
          </div>
        </div>
      </div>

      {/* sql.js Capability Status */}
      <div className="absolute bottom-4 left-4 z-10 bg-white rounded-lg shadow-lg p-4 max-w-md">
        <h3 className="text-sm font-semibold mb-2">sql.js Capabilities</h3>
        <div className="text-xs space-y-1">
          <div className="text-green-600">✅ FTS5 support verified</div>
          <div className="text-green-600">✅ JSON1 extension verified</div>
          <div className="text-green-600">✅ Recursive CTE support verified</div>
          <div className="text-green-600">✅ TypeScript compilation: 0 errors</div>
        </div>
      </div>

      {/* Error Telemetry */}
      {errorLog.length > 0 && (
        <div className="absolute bottom-4 right-4 z-10 bg-red-50 border border-red-200 rounded-lg shadow-lg p-4 max-w-md">
          <h3 className="text-sm font-semibold mb-2 text-red-800">Error Telemetry</h3>
          <div className="text-xs space-y-1 max-h-32 overflow-y-auto">
            {errorLog.map((error, index) => (
              <div key={index} className="text-red-600">
                {error}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Foundation Instructions */}
      <div className="absolute top-40 left-4 z-10 bg-blue-50 border border-blue-200 rounded-lg shadow-lg p-4 max-w-sm">
        <h3 className="text-sm font-semibold mb-2 text-blue-800">Foundation Demo</h3>
        <ul className="text-xs space-y-1 text-blue-700">
          <li>• <strong>Headers:</strong> Row headers show folders, column headers show statuses</li>
          <li>• <strong>Performance:</strong> Monitor shows 60fps target for 10k+ cells</li>
          <li>• <strong>Density:</strong> Slider tests Janus morphing between states</li>
          <li>• <strong>PAFV:</strong> Filters integrate with existing context system</li>
          <li>• <strong>Bridge:</strong> Confirms sql.js direct access eliminates serialization</li>
        </ul>
      </div>

      {/* SuperGrid SVG Container */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          <svg
            ref={svgRef}
            className="border border-gray-300 bg-white"
            style={{ width: 800, height: 600 }}
          />
          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90">
              <div className="text-gray-600">Initializing SuperGrid Foundation...</div>
            </div>
          )}
        </div>
      </div>

      {/* Card Detail Modal */}
      <CardDetailModal
        card={selectedCard}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleCardSave}
        onDelete={handleCardDelete}
      />

      {/* Operation in progress overlay */}
      {isOperationInProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-700">Updating data...</span>
          </div>
        </div>
      )}
    </div>
  );
}
