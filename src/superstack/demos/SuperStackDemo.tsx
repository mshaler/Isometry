/**
 * SuperStack Demo Component
 *
 * Demonstrates SuperStack with live SQL data.
 * Shows folder+tags rows and year+month columns from the cards table.
 *
 * Features:
 * - Live data from useSuperStackData hook
 * - Query time display
 * - Click-to-filter logging
 * - Collapse/expand interactions
 * - Refresh functionality
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useSuperStackData } from '../hooks/useSuperStackData';
import { SuperStackRenderer } from '../renderers/superstack-renderer';
import { COMMON_FACETS, DEFAULT_DIMENSIONS } from '../config/superstack-defaults';
import { recalculateTree, findNodeById } from '../builders/header-tree-builder';
import type { HeaderNode, HeaderTree } from '../types/superstack';
import '../styles/superstack.css';

/**
 * SuperStack Demo component.
 * Renders live data with folder+tags rows and year+month columns.
 */
export function SuperStackDemo(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<SuperStackRenderer | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [localRowTree, setLocalRowTree] = useState<HeaderTree | null>(null);
  const [localColTree, setLocalColTree] = useState<HeaderTree | null>(null);

  // Fetch data using the hook
  const {
    rowTree,
    colTree,
    isLoading,
    error,
    queryTime,
    lastFetched,
    refetch,
  } = useSuperStackData({
    rowFacets: [COMMON_FACETS.folder, COMMON_FACETS.tags],
    colFacets: [COMMON_FACETS.year, COMMON_FACETS.month],
    filters: [], // No filters for demo
    options: {}, // Use defaults
  });

  // Sync trees to local state for collapse manipulation
  useEffect(() => {
    if (rowTree) {
      setLocalRowTree(structuredClone(rowTree));
    }
  }, [rowTree]);

  useEffect(() => {
    if (colTree) {
      setLocalColTree(structuredClone(colTree));
    }
  }, [colTree]);

  // Handle header click (click-to-filter)
  const handleHeaderClick = useCallback((node: HeaderNode) => {
    // Demo: log header click for debugging
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn('Header clicked:', node.value, node.path);
    }
    setSelectedId(node.id);
  }, []);

  // Handle header collapse
  const handleHeaderCollapse = useCallback((node: HeaderNode) => {

    // Find which tree the node belongs to and update it
    if (localRowTree) {
      const foundInRow = findNodeById(localRowTree, node.id);
      if (foundInRow) {
        const newTree = structuredClone(localRowTree);
        const targetNode = findNodeById(newTree, node.id);
        if (targetNode) {
          targetNode.collapsed = !targetNode.collapsed;
          recalculateTree(newTree);
          setLocalRowTree(newTree);
        }
        return;
      }
    }

    if (localColTree) {
      const foundInCol = findNodeById(localColTree, node.id);
      if (foundInCol) {
        const newTree = structuredClone(localColTree);
        const targetNode = findNodeById(newTree, node.id);
        if (targetNode) {
          targetNode.collapsed = !targetNode.collapsed;
          recalculateTree(newTree);
          setLocalColTree(newTree);
        }
      }
    }
  }, [localRowTree, localColTree]);

  // Initialize renderer
  useEffect(() => {
    if (!containerRef.current) return;

    // Create renderer
    rendererRef.current = new SuperStackRenderer(
      containerRef.current,
      DEFAULT_DIMENSIONS
    );

    // Set callbacks
    rendererRef.current.setCallbacks({
      onHeaderClick: handleHeaderClick,
      onHeaderCollapse: handleHeaderCollapse,
    });

    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, []); // Only initialize once

  // Update callbacks when handlers change
  useEffect(() => {
    rendererRef.current?.setCallbacks({
      onHeaderClick: handleHeaderClick,
      onHeaderCollapse: handleHeaderCollapse,
    });
  }, [handleHeaderClick, handleHeaderCollapse]);

  // Render when trees change
  useEffect(() => {
    if (!rendererRef.current || !localRowTree || !localColTree) return;

    rendererRef.current.render(localRowTree, localColTree);

    if (selectedId) {
      rendererRef.current.setSelected(selectedId);
    }
  }, [localRowTree, localColTree, selectedId]);

  return (
    <div className="superstack-demo">
      {/* Header */}
      <div className="demo-header">
        <h2>SuperStack Demo</h2>
        <p className="demo-subtitle">
          Live data from cards table with folder+tags rows, year+month columns
        </p>
      </div>

      {/* Stats Bar */}
      <div className="demo-stats-bar">
        <div className="stat-item">
          <span className="stat-label">Status:</span>
          <span className="stat-value">
            {isLoading ? 'Loading...' : error ? 'Error' : 'Ready'}
          </span>
        </div>

        {queryTime !== null && (
          <div className="stat-item">
            <span className="stat-label">Query time:</span>
            <span className="stat-value">{queryTime.toFixed(1)}ms</span>
          </div>
        )}

        {localRowTree && (
          <div className="stat-item">
            <span className="stat-label">Row headers:</span>
            <span className="stat-value">{localRowTree.leafCount}</span>
          </div>
        )}

        {localColTree && (
          <div className="stat-item">
            <span className="stat-label">Col headers:</span>
            <span className="stat-value">{localColTree.leafCount}</span>
          </div>
        )}

        {lastFetched && (
          <div className="stat-item">
            <span className="stat-label">Last fetched:</span>
            <span className="stat-value">
              {lastFetched.toLocaleTimeString()}
            </span>
          </div>
        )}

        <button
          className="refresh-button"
          onClick={refetch}
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="demo-error">
          Error loading data: {error.message}
        </div>
      )}

      {/* Selection display */}
      {selectedId && (
        <div className="demo-selection">
          Selected: <code>{selectedId}</code>
        </div>
      )}

      {/* Render container */}
      <div
        ref={containerRef}
        className="superstack-container"
        style={{ minHeight: 400, border: '1px solid #e0e0e0', marginTop: 16 }}
      />

      {/* Instructions */}
      <div className="demo-instructions">
        <h3>Instructions</h3>
        <ul>
          <li>Click a header to select it (logs to console)</li>
          <li>Click the collapse indicator (arrow) to expand/collapse</li>
          <li>Click Refresh to reload data</li>
          <li>Check browser console for interaction logs</li>
        </ul>
      </div>

      {/* Demo styles */}
      <style>{`
        .superstack-demo {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .demo-header {
          margin-bottom: 24px;
        }

        .demo-header h2 {
          margin: 0 0 8px 0;
          font-size: 24px;
          font-weight: 600;
        }

        .demo-subtitle {
          margin: 0;
          color: #666;
          font-size: 14px;
        }

        .demo-stats-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 24px;
          align-items: center;
          padding: 12px 16px;
          background: #f5f5f5;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .stat-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-value {
          font-size: 14px;
          font-weight: 500;
          color: #333;
        }

        .refresh-button {
          margin-left: auto;
          padding: 8px 16px;
          background: #007aff;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .refresh-button:hover:not(:disabled) {
          background: #0066d6;
        }

        .refresh-button:disabled {
          background: #999;
          cursor: not-allowed;
        }

        .demo-error {
          padding: 12px 16px;
          background: #ffebee;
          color: #c62828;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .demo-selection {
          padding: 8px 12px;
          background: #e3f2fd;
          border-radius: 6px;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .demo-selection code {
          font-family: 'SF Mono', Monaco, monospace;
          background: rgba(0,0,0,0.05);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .superstack-container {
          background: white;
          border-radius: 8px;
          overflow: auto;
        }

        .demo-instructions {
          margin-top: 24px;
          padding: 16px;
          background: #fafafa;
          border-radius: 8px;
        }

        .demo-instructions h3 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
        }

        .demo-instructions ul {
          margin: 0;
          padding-left: 20px;
          font-size: 13px;
          color: #555;
        }

        .demo-instructions li {
          margin-bottom: 4px;
        }
      `}</style>
    </div>
  );
}
