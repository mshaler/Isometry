/**
 * SuperGridCSSDemo - Test page for the new CSS Grid SuperGrid implementation
 *
 * Demonstrates:
 * - Hierarchical row and column headers with spanning
 * - Theme switching (reference, nextstep, modern, dark)
 * - Cell selection and click handling
 */

import React, { useState } from 'react';
import { SuperGridCSS } from './supergrid/SuperGridCSS';
import { themes } from './supergrid/SuperGridCSSContext';
import type { AxisConfig, DataCell, SuperGridThemeName } from './supergrid/types';

// ============================================================================
// Sample Data (matches reference image from spec)
// ============================================================================

const exampleRowAxis: AxisConfig = {
  type: 'C',
  facet: 'category',
  tree: {
    label: 'Root',
    id: 'root',
    children: [
      {
        label: 'FutureME',
        id: 'futureme',
        children: [
          {
            label: 'Learning',
            id: 'learning',
            children: [
              { label: 'Tools', id: 'tools' },
              { label: 'Progress', id: 'progress' },
              { label: 'Reference', id: 'reference' },
              { label: 'Community', id: 'community' },
            ],
          },
          {
            label: 'Growth',
            id: 'growth',
            children: [
              { label: 'Fitness', id: 'fitness' },
              { label: 'Health', id: 'health' },
              { label: 'Play', id: 'play' },
              { label: 'Travel', id: 'travel' },
            ],
          },
          {
            label: 'Writing',
            id: 'writing',
            children: [
              { label: 'Novels', id: 'novels' },
              { label: 'Poetry', id: 'poetry' },
              { label: 'Essays', id: 'essays' },
              { label: 'Photos', id: 'photos' },
            ],
          },
        ],
      },
      {
        label: 'Home',
        id: 'home',
        children: [
          {
            label: 'Family',
            id: 'family',
            children: [
              { label: 'Alex', id: 'alex' },
              { label: 'Stacey', id: 'stacey' },
              { label: 'Extended family', id: 'extended' },
              { label: 'Friends', id: 'friends' },
            ],
          },
          {
            label: 'House',
            id: 'house',
            children: [
              { label: 'Garage+', id: 'garage' },
              { label: 'Interior+', id: 'interior' },
              { label: 'Kitchen+', id: 'kitchen' },
              { label: 'HVAC+', id: 'hvac' },
              { label: 'Bathrooms+', id: 'bathrooms' },
            ],
          },
          {
            label: 'Money+',
            id: 'money',
            children: [
              { label: 'Mortgage', id: 'mortgage' },
              { label: 'Retirement', id: 'retirement' },
              { label: 'Tuition', id: 'tuition' },
            ],
          },
        ],
      },
      {
        label: 'Work',
        id: 'work',
        children: [
          {
            label: 'PlanB',
            id: 'planb',
            children: [
              { label: 'Executive', id: 'executive' },
              { label: 'Consulting', id: 'consulting' },
            ],
          },
          {
            label: 'BairesDev',
            id: 'bairesdev',
            children: [
              { label: 'Opportunities', id: 'opportunities' },
              { label: 'Operations', id: 'operations' },
            ],
          },
        ],
      },
    ],
  },
};

const exampleColumnAxis: AxisConfig = {
  type: 'T',
  facet: 'year_quarter',
  tree: {
    label: 'Root',
    id: 'root',
    children: [
      {
        label: '2022',
        id: '2022',
        children: [
          { label: 'Q1', id: '2022-q1' },
          { label: 'Q2', id: '2022-q2' },
          { label: 'Q3', id: '2022-q3' },
          { label: 'Q4', id: '2022-q4' },
        ],
      },
    ],
  },
};

// Sample data cells
const sampleData: DataCell[] = [
  { rowPath: ['root', 'futureme', 'learning', 'tools'], colPath: ['root', '2022', '2022-q1'], value: '12' },
  { rowPath: ['root', 'futureme', 'learning', 'tools'], colPath: ['root', '2022', '2022-q2'], value: '8' },
  { rowPath: ['root', 'futureme', 'growth', 'fitness'], colPath: ['root', '2022', '2022-q1'], value: '★' },
  { rowPath: ['root', 'futureme', 'growth', 'fitness'], colPath: ['root', '2022', '2022-q3'], value: '★★' },
  { rowPath: ['root', 'home', 'family', 'alex'], colPath: ['root', '2022', '2022-q2'], value: '●' },
  { rowPath: ['root', 'home', 'house', 'kitchen'], colPath: ['root', '2022', '2022-q4'], value: '$2.4k' },
  { rowPath: ['root', 'work', 'planb', 'executive'], colPath: ['root', '2022', '2022-q1'], value: '→' },
  { rowPath: ['root', 'futureme', 'writing', 'novels'], colPath: ['root', '2022', '2022-q2'], value: '3' },
  { rowPath: ['root', 'futureme', 'writing', 'essays'], colPath: ['root', '2022', '2022-q3'], value: '7' },
  { rowPath: ['root', 'home', 'money', 'mortgage'], colPath: ['root', '2022', '2022-q1'], value: '$1.8k' },
  { rowPath: ['root', 'home', 'money', 'retirement'], colPath: ['root', '2022', '2022-q4'], value: '↑15%' },
];

// ============================================================================
// Demo Component
// ============================================================================

export const SuperGridCSSDemo: React.FC = () => {
  const [themeName, setThemeName] = useState<SuperGridThemeName>('reference');
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [clickedHeader, setClickedHeader] = useState<string | null>(null);

  const handleCellClick = (
    cell: DataCell | undefined,
    rowPath: string[],
    colPath: string[]
  ) => {
    const key = `${rowPath.join('/')}::${colPath.join('/')}`;
    setSelectedCell(key);
    console.log('Cell clicked:', { cell, rowPath, colPath });
  };

  const handleHeaderClick = (type: 'row' | 'column', path: string[]) => {
    setClickedHeader(`${type}: ${path.join(' → ')}`);
    console.log('Header clicked:', { type, path });
  };

  return (
    <div
      style={{
        padding: '20px',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        background: '#F8FAFC',
        minHeight: '100vh',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 600 }}>
          SuperGrid CSS Grid Demo
        </h1>
        <p style={{ margin: '0 0 16px 0', color: '#64748B', fontSize: '14px' }}>
          Pure React + CSS Grid implementation — No D3.js for layout
        </p>

        {/* Theme selector */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(Object.keys(themes) as SuperGridThemeName[]).map((key) => (
            <button
              key={key}
              onClick={() => setThemeName(key)}
              style={{
                padding: '6px 12px',
                border: themeName === key ? '2px solid #007AFF' : '1px solid #E2E8F0',
                borderRadius: '6px',
                background: themeName === key ? '#EFF6FF' : '#FFFFFF',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: themeName === key ? 600 : 400,
              }}
            >
              {themes[key].name}
            </button>
          ))}
        </div>
      </div>

      {/* Grid stats */}
      <div
        style={{
          marginBottom: '16px',
          padding: '12px 16px',
          background: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid #E2E8F0',
          fontSize: '13px',
          display: 'flex',
          gap: '24px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <strong>Row Levels:</strong> 3 (Category → Subcategory → Item)
        </div>
        <div>
          <strong>Column Levels:</strong> 2 (Year → Quarter)
        </div>
        <div>
          <strong>Data Rows:</strong> 26
        </div>
        <div>
          <strong>Data Columns:</strong> 4
        </div>
        <div>
          <strong>Total Cells:</strong> 104
        </div>
      </div>

      {/* The grid */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '8px',
          padding: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <SuperGridCSS
          rowAxis={exampleRowAxis}
          columnAxis={exampleColumnAxis}
          data={sampleData}
          theme={themeName}
          onCellClick={handleCellClick}
          onHeaderClick={handleHeaderClick}
        />
      </div>

      {/* Debug info */}
      {(selectedCell || clickedHeader) && (
        <div
          style={{
            marginTop: '12px',
            padding: '8px 12px',
            background: '#F1F5F9',
            borderRadius: '6px',
            fontSize: '12px',
            fontFamily: 'monospace',
          }}
        >
          {selectedCell && <div>Selected: {selectedCell}</div>}
          {clickedHeader && <div>Header clicked: {clickedHeader}</div>}
        </div>
      )}

      {/* Implementation notes */}
      <div
        style={{
          marginTop: '20px',
          padding: '16px',
          background: '#FFFBEB',
          borderRadius: '8px',
          border: '1px solid #FCD34D',
          fontSize: '13px',
          lineHeight: 1.6,
        }}
      >
        <strong>Key Implementation Details:</strong>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
          <li>
            <code>grid-row-start/end</code> and <code>grid-column-start/end</code>{' '}
            handle all spanning
          </li>
          <li>No manual coordinate math — the browser does layout</li>
          <li>
            Tree metrics computed once via <code>useMemo</code>
          </li>
          <li>Click any row header or data cell to see selection state</li>
          <li>Compare "Reference Image" theme to the mockup</li>
        </ul>
      </div>

      {/* Navigation */}
      <div
        style={{
          marginTop: '20px',
          fontSize: '13px',
          color: '#64748B',
        }}
      >
        <a href="/" style={{ color: '#3B82F6', textDecoration: 'none' }}>
          ← Back to main app
        </a>
        {' | '}
        <a href="?test=supergrid" style={{ color: '#3B82F6', textDecoration: 'none' }}>
          D3-based SuperGrid
        </a>
        {' | '}
        <a href="?test=integrated" style={{ color: '#3B82F6', textDecoration: 'none' }}>
          Integrated Layout
        </a>
      </div>
    </div>
  );
};

export default SuperGridCSSDemo;
