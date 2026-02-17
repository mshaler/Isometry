import React, { useMemo, useState } from 'react';

// ============================================================================
// DATA MODEL (from reference image)
// ============================================================================

const exampleRowAxis = {
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
            ]
          },
          {
            label: 'Growth',
            id: 'growth',
            children: [
              { label: 'Fitness', id: 'fitness' },
              { label: 'Health', id: 'health' },
              { label: 'Play', id: 'play' },
              { label: 'Travel', id: 'travel' },
            ]
          },
          {
            label: 'Writing',
            id: 'writing',
            children: [
              { label: 'Novels', id: 'novels' },
              { label: 'Poetry', id: 'poetry' },
              { label: 'Essays', id: 'essays' },
              { label: 'Photos', id: 'photos' },
            ]
          }
        ]
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
            ]
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
            ]
          },
          {
            label: 'Money+',
            id: 'money',
            children: [
              { label: 'Mortgage', id: 'mortgage' },
              { label: 'Retirement', id: 'retirement' },
              { label: 'Tuition', id: 'tuition' },
            ]
          }
        ]
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
            ]
          },
          {
            label: 'BairesDev',
            id: 'bairesdev',
            children: [
              { label: 'Opportunities', id: 'opportunities' },
              { label: 'Operations', id: 'operations' },
            ]
          }
        ]
      }
    ]
  }
};

const exampleColumnAxis = {
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
        ]
      }
    ]
  }
};

// ============================================================================
// TREE METRICS COMPUTATION
// ============================================================================

function computeTreeMetrics(root) {
  const flatNodes = [];
  
  function traverse(node, depth, leafStart, path) {
    const currentPath = [...path, node.id];
    
    if (!node.children || node.children.length === 0) {
      // Leaf node
      flatNodes.push({
        node,
        depth,
        leafStart,
        leafCount: 1,
        path: currentPath,
        isLeaf: true
      });
      return 1;
    }
    
    // Internal node - traverse children first to get their leaf counts
    let totalLeaves = 0;
    const childStartIndex = flatNodes.length;
    
    for (const child of node.children) {
      totalLeaves += traverse(child, depth + 1, leafStart + totalLeaves, currentPath);
    }
    
    // Add internal node after its children (so we have correct leafCount)
    flatNodes.push({
      node,
      depth,
      leafStart,
      leafCount: totalLeaves,
      path: currentPath,
      isLeaf: false
    });
    
    return totalLeaves;
  }
  
  // Skip the virtual root, start with its children
  let leafStart = 0;
  let maxDepth = 0;
  
  for (const child of root.children || []) {
    traverse(child, 0, leafStart, [root.id]);
    leafStart += flatNodes.filter(n => n.isLeaf && n.path[1] === child.id).length;
  }
  
  // Recompute leafStart correctly
  flatNodes.length = 0;
  leafStart = 0;
  for (const child of root.children || []) {
    const leaves = traverse(child, 0, leafStart, [root.id]);
    // Update leafStart for next top-level child
    const topLevelNode = flatNodes.find(n => n.node.id === child.id);
    if (topLevelNode) {
      leafStart = topLevelNode.leafStart + topLevelNode.leafCount;
    }
  }
  
  // Find max depth
  for (const fn of flatNodes) {
    maxDepth = Math.max(maxDepth, fn.depth);
  }
  
  return {
    depth: maxDepth + 1,
    leafCount: flatNodes.filter(n => n.isLeaf).length,
    flatNodes
  };
}

// ============================================================================
// GRID PLACEMENT FUNCTIONS
// ============================================================================

function computeRowHeaderPlacement(flatNode, colHeaderDepth) {
  const dataRowStart = colHeaderDepth + 1;
  
  return {
    gridRowStart: dataRowStart + flatNode.leafStart,
    gridRowEnd: dataRowStart + flatNode.leafStart + flatNode.leafCount,
    gridColumnStart: flatNode.depth + 1,
    gridColumnEnd: flatNode.depth + 2
  };
}

function computeColHeaderPlacement(flatNode, rowHeaderDepth) {
  const dataColStart = rowHeaderDepth + 1;
  
  return {
    gridRowStart: flatNode.depth + 1,
    gridRowEnd: flatNode.depth + 2,
    gridColumnStart: dataColStart + flatNode.leafStart,
    gridColumnEnd: dataColStart + flatNode.leafStart + flatNode.leafCount
  };
}

function computeDataCellPlacement(rowLeafIndex, colLeafIndex, colHeaderDepth, rowHeaderDepth) {
  return {
    gridRowStart: colHeaderDepth + 1 + rowLeafIndex,
    gridRowEnd: colHeaderDepth + 2 + rowLeafIndex,
    gridColumnStart: rowHeaderDepth + 1 + colLeafIndex,
    gridColumnEnd: rowHeaderDepth + 2 + colLeafIndex
  };
}

// ============================================================================
// CUSTOM HOOK: useGridLayout
// ============================================================================

function useGridLayout(rowAxis, colAxis) {
  return useMemo(() => {
    const rowMetrics = computeTreeMetrics(rowAxis.tree);
    const colMetrics = computeTreeMetrics(colAxis.tree);
    
    const rowHeaderDepth = rowMetrics.depth;
    const colHeaderDepth = colMetrics.depth;
    
    // Generate grid template
    const headerColWidth = '100px';
    const headerRowHeight = '32px';
    const dataColWidth = '70px';
    const dataRowHeight = '28px';
    
    const columns = [
      ...Array(rowHeaderDepth).fill(headerColWidth),
      ...Array(colMetrics.leafCount).fill(dataColWidth)
    ].join(' ');
    
    const rows = [
      ...Array(colHeaderDepth).fill(headerRowHeight),
      ...Array(rowMetrics.leafCount).fill(dataRowHeight)
    ].join(' ');
    
    // Generate corner cells
    const cornerCells = [];
    for (let r = 0; r < colHeaderDepth; r++) {
      for (let c = 0; c < rowHeaderDepth; c++) {
        cornerCells.push({
          placement: {
            gridRowStart: r + 1,
            gridRowEnd: r + 2,
            gridColumnStart: c + 1,
            gridColumnEnd: c + 2
          },
          label: 'MiniNav',
          row: r,
          col: c
        });
      }
    }
    
    // Generate row headers (filter out root)
    const rowHeaders = rowMetrics.flatNodes
      .filter(fn => fn.path.length > 1 && fn.path[0] === 'root')
      .map(fn => ({
        ...fn,
        placement: computeRowHeaderPlacement(fn, colHeaderDepth)
      }));
    
    // Generate column headers (filter out root)
    const colHeaders = colMetrics.flatNodes
      .filter(fn => fn.path.length > 1 && fn.path[0] === 'root')
      .map(fn => ({
        ...fn,
        placement: computeColHeaderPlacement(fn, rowHeaderDepth)
      }));
    
    // Generate data cell positions
    const rowLeaves = rowMetrics.flatNodes.filter(fn => fn.isLeaf);
    const colLeaves = colMetrics.flatNodes.filter(fn => fn.isLeaf);
    
    const dataCells = [];
    rowLeaves.forEach((rowLeaf, ri) => {
      colLeaves.forEach((colLeaf, ci) => {
        dataCells.push({
          rowLeaf,
          colLeaf,
          rowIndex: ri,
          colIndex: ci,
          placement: computeDataCellPlacement(ri, ci, colHeaderDepth, rowHeaderDepth)
        });
      });
    });
    
    return {
      rowMetrics,
      colMetrics,
      gridTemplate: { columns, rows },
      cornerCells,
      rowHeaders,
      colHeaders,
      dataCells,
      rowHeaderDepth,
      colHeaderDepth
    };
  }, [rowAxis, colAxis]);
}

// ============================================================================
// THEME DEFINITIONS
// ============================================================================

const themes = {
  reference: {
    name: 'Reference Image',
    corner: '#00CED1',
    rowHeader: '#90EE90',
    colHeaderL0: '#FFD700',
    colHeaderL1: '#FFA500',
    data: '#FFA500',
    border: '#333333',
    text: '#000000'
  },
  nextstep: {
    name: 'NeXTSTEP',
    corner: '#AAAAAA',
    rowHeader: '#CCCCCC',
    colHeaderL0: '#BBBBBB',
    colHeaderL1: '#DDDDDD',
    data: '#FFFFFF',
    border: '#000000',
    text: '#000000'
  },
  modern: {
    name: 'Modern',
    corner: '#F1F5F9',
    rowHeader: '#F8FAFC',
    colHeaderL0: '#E2E8F0',
    colHeaderL1: '#F1F5F9',
    data: '#FFFFFF',
    border: '#E2E8F0',
    text: '#1E293B'
  },
  dark: {
    name: 'Dark',
    corner: '#1E293B',
    rowHeader: '#334155',
    colHeaderL0: '#1E293B',
    colHeaderL1: '#475569',
    data: '#0F172A',
    border: '#475569',
    text: '#F8FAFC'
  }
};

// ============================================================================
// CELL COMPONENTS
// ============================================================================

function CornerCell({ placement, label, theme }) {
  return (
    <div
      style={{
        gridRowStart: placement.gridRowStart,
        gridRowEnd: placement.gridRowEnd,
        gridColumnStart: placement.gridColumnStart,
        gridColumnEnd: placement.gridColumnEnd,
        background: theme.corner,
        border: `1px solid ${theme.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 500,
        fontSize: '11px',
        color: theme.text,
        marginRight: '-1px',
        marginBottom: '-1px',
      }}
    >
      {label}
    </div>
  );
}

function RowHeader({ node, placement, depth, theme, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        gridRowStart: placement.gridRowStart,
        gridRowEnd: placement.gridRowEnd,
        gridColumnStart: placement.gridColumnStart,
        gridColumnEnd: placement.gridColumnEnd,
        background: theme.rowHeader,
        border: `1px solid ${theme.border}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        fontWeight: depth === 0 ? 600 : 500,
        fontSize: depth === 0 ? '13px' : '12px',
        color: theme.text,
        cursor: 'pointer',
        marginRight: '-1px',
        marginBottom: '-1px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
      title={node.label}
    >
      {node.label}
    </div>
  );
}

function ColHeader({ node, placement, depth, theme }) {
  const bg = depth === 0 ? theme.colHeaderL0 : theme.colHeaderL1;
  
  return (
    <div
      style={{
        gridRowStart: placement.gridRowStart,
        gridRowEnd: placement.gridRowEnd,
        gridColumnStart: placement.gridColumnStart,
        gridColumnEnd: placement.gridColumnEnd,
        background: bg,
        border: `1px solid ${theme.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: depth === 0 ? 600 : 500,
        fontSize: '12px',
        color: theme.text,
        marginRight: '-1px',
        marginBottom: '-1px',
      }}
    >
      {node.label}
    </div>
  );
}

function DataCell({ placement, rowPath, colPath, value, theme, onClick, isSelected }) {
  return (
    <div
      onClick={onClick}
      style={{
        gridRowStart: placement.gridRowStart,
        gridRowEnd: placement.gridRowEnd,
        gridColumnStart: placement.gridColumnStart,
        gridColumnEnd: placement.gridColumnEnd,
        background: isSelected ? '#007AFF22' : theme.data,
        border: `1px solid ${theme.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11px',
        color: theme.text,
        cursor: 'cell',
        marginRight: '-1px',
        marginBottom: '-1px',
        outline: isSelected ? '2px solid #007AFF' : 'none',
        outlineOffset: '-2px',
        zIndex: isSelected ? 1 : 0,
      }}
    >
      {value}
    </div>
  );
}

// ============================================================================
// MAIN SUPERGRID COMPONENT
// ============================================================================

function SuperGrid({ rowAxis, colAxis, theme, data = {} }) {
  const layout = useGridLayout(rowAxis, colAxis);
  const [selectedCell, setSelectedCell] = useState(null);
  const [clickedHeader, setClickedHeader] = useState(null);
  
  const getCellKey = (rowPath, colPath) => 
    `${rowPath.join('/')}::${colPath.join('/')}`;
  
  return (
    <div style={{ overflow: 'auto', maxHeight: '600px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: layout.gridTemplate.columns,
          gridTemplateRows: layout.gridTemplate.rows,
          width: 'max-content',
        }}
      >
        {/* Corner cells */}
        {layout.cornerCells.map((cell, i) => (
          <CornerCell
            key={`corner-${i}`}
            placement={cell.placement}
            label={cell.label}
            theme={theme}
          />
        ))}
        
        {/* Column headers */}
        {layout.colHeaders.map((header) => (
          <ColHeader
            key={`col-${header.node.id}-${header.depth}`}
            node={header.node}
            placement={header.placement}
            depth={header.depth}
            theme={theme}
          />
        ))}
        
        {/* Row headers */}
        {layout.rowHeaders.map((header) => (
          <RowHeader
            key={`row-${header.node.id}-${header.depth}`}
            node={header.node}
            placement={header.placement}
            depth={header.depth}
            theme={theme}
            onClick={() => setClickedHeader(header.node.label)}
          />
        ))}
        
        {/* Data cells */}
        {layout.dataCells.map(({ rowLeaf, colLeaf, placement }) => {
          const cellKey = getCellKey(rowLeaf.path, colLeaf.path);
          const value = data[cellKey] ?? '';
          const isSelected = selectedCell === cellKey;
          
          return (
            <DataCell
              key={cellKey}
              placement={placement}
              rowPath={rowLeaf.path}
              colPath={colLeaf.path}
              value={value}
              theme={theme}
              isSelected={isSelected}
              onClick={() => setSelectedCell(cellKey)}
            />
          );
        })}
      </div>
      
      {/* Debug info */}
      {(selectedCell || clickedHeader) && (
        <div style={{ 
          marginTop: '12px', 
          padding: '8px 12px', 
          background: '#F1F5F9', 
          borderRadius: '6px',
          fontSize: '12px',
          fontFamily: 'monospace'
        }}>
          {selectedCell && <div>Selected: {selectedCell}</div>}
          {clickedHeader && <div>Header clicked: {clickedHeader}</div>}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DEMO APP
// ============================================================================

export default function App() {
  const [themeName, setThemeName] = useState('reference');
  const theme = themes[themeName];
  
  // Sample data for some cells
  const sampleData = {
    'root/futureme/learning/tools::root/2022/2022-q1': '12',
    'root/futureme/learning/tools::root/2022/2022-q2': '8',
    'root/futureme/growth/fitness::root/2022/2022-q1': '★',
    'root/futureme/growth/fitness::root/2022/2022-q3': '★★',
    'root/home/family/alex::root/2022/2022-q2': '●',
    'root/home/house/kitchen::root/2022/2022-q4': '$2.4k',
    'root/work/planb/executive::root/2022/2022-q1': '→',
  };
  
  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
      background: '#F8FAFC',
      minHeight: '100vh'
    }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 600 }}>
          SuperGrid CSS Grid Prototype
        </h1>
        <p style={{ margin: '0 0 16px 0', color: '#64748B', fontSize: '14px' }}>
          Pure React + CSS Grid implementation • No D3.js
        </p>
        
        {/* Theme selector */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {Object.entries(themes).map(([key, t]) => (
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
              {t.name}
            </button>
          ))}
        </div>
      </div>
      
      {/* Grid stats */}
      <div style={{ 
        marginBottom: '16px', 
        padding: '12px 16px',
        background: '#FFFFFF',
        borderRadius: '8px',
        border: '1px solid #E2E8F0',
        fontSize: '13px',
        display: 'flex',
        gap: '24px'
      }}>
        <div><strong>Row Levels:</strong> 3 (Category → Subcategory → Item)</div>
        <div><strong>Column Levels:</strong> 2 (Year → Quarter)</div>
        <div><strong>Data Rows:</strong> 26</div>
        <div><strong>Data Columns:</strong> 4</div>
        <div><strong>Total Cells:</strong> 104</div>
      </div>
      
      {/* The grid */}
      <div style={{ 
        background: '#FFFFFF', 
        borderRadius: '8px', 
        padding: '16px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <SuperGrid
          rowAxis={exampleRowAxis}
          columnAxis={exampleColumnAxis}
          theme={theme}
          data={sampleData}
        />
      </div>
      
      {/* Implementation notes */}
      <div style={{ 
        marginTop: '20px', 
        padding: '16px',
        background: '#FFFBEB',
        borderRadius: '8px',
        border: '1px solid #FCD34D',
        fontSize: '13px',
        lineHeight: 1.6
      }}>
        <strong>✨ Key Implementation Details:</strong>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
          <li><code>grid-row-start/end</code> and <code>grid-column-start/end</code> handle all spanning</li>
          <li>No manual coordinate math — the browser does layout</li>
          <li>Tree metrics computed once via <code>useMemo</code></li>
          <li>Click any row header or data cell to see selection state</li>
          <li>Compare "Reference Image" theme to your mockup</li>
        </ul>
      </div>
    </div>
  );
}
