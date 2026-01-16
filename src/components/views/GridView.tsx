import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/contexts/ThemeContext';
import { usePAFV, type Chip } from '@/contexts/PAFVContext';
import type { Node } from '@/types/node';

interface GridViewProps {
  data: Node[];
  onNodeClick?: (node: Node) => void;
}

// Map chip IDs to Node fields
const FIELD_MAP: Record<string, keyof Node> = {
  folder: 'folder',
  subfolder: 'status',
  tags: 'folder',
  year: 'createdAt',
  month: 'createdAt',
  category: 'folder',
  status: 'status',
  priority: 'priority',
};

function getFieldValue(node: Node, chipId: string): string {
  const field = FIELD_MAP[chipId] || 'folder';
  const value = node[field];

  if (field === 'createdAt' && value) {
    if (chipId === 'year') {
      return new Date(value as string).getFullYear().toString();
    }
    if (chipId === 'month') {
      return new Date(value as string).toLocaleString('default', { month: 'short' });
    }
  }

  return String(value ?? 'Unknown');
}

// Get composite key for multiple axes
function getCompositeKey(node: Node, chips: Chip[]): string {
  return chips.map(chip => getFieldValue(node, chip.id)).join('|');
}

// Hierarchical header node for nested headers
interface HeaderNode {
  label: string;
  depth: number;
  span: number;
  children: HeaderNode[];
  path: string[];
}

// Build hierarchical header structure from data
function buildHeaderTree(data: Node[], chips: Chip[]): HeaderNode {
  if (chips.length === 0) {
    return { label: '', depth: 0, span: 1, children: [], path: [] };
  }

  const root: HeaderNode = { label: 'root', depth: -1, span: 0, children: [], path: [] };
  const valuePaths = new Map<string, boolean>();

  data.forEach(node => {
    const values = chips.map(chip => getFieldValue(node, chip.id));
    valuePaths.set(values.join('|'), true);
  });

  Array.from(valuePaths.keys()).forEach(pathStr => {
    const values = pathStr.split('|');
    let current = root;

    values.forEach((value, depth) => {
      const path = values.slice(0, depth + 1);
      let child = current.children.find(c => c.label === value);

      if (!child) {
        child = { label: value, depth, span: 0, children: [], path };
        current.children.push(child);
      }
      current = child;
    });
  });

  function calcSpan(node: HeaderNode): number {
    if (node.children.length === 0) {
      node.span = 1;
    } else {
      node.span = node.children.reduce((sum, child) => sum + calcSpan(child), 0);
    }
    return node.span;
  }
  calcSpan(root);

  function sortChildren(node: HeaderNode) {
    node.children.sort((a, b) => a.label.localeCompare(b.label));
    node.children.forEach(sortChildren);
  }
  sortChildren(root);

  return root;
}

// Flatten header tree into rows for rendering
function flattenHeaderLevels(root: HeaderNode, maxDepth: number): HeaderNode[][] {
  const levels: HeaderNode[][] = [];
  for (let d = 0; d < maxDepth; d++) {
    levels.push([]);
  }

  function traverse(node: HeaderNode, depth: number) {
    if (depth >= 0 && depth < maxDepth) {
      levels[depth].push(node);
    }
    node.children.forEach(child => traverse(child, depth + 1));
  }
  traverse(root, -1);

  return levels;
}

// Get leaf paths for cell positioning
function getLeafPaths(root: HeaderNode): string[][] {
  const leaves: string[][] = [];

  function traverse(node: HeaderNode, path: string[]) {
    if (node.children.length === 0 && node.label !== 'root') {
      leaves.push(path);
    } else {
      node.children.forEach(child => traverse(child, [...path, child.label]));
    }
  }
  traverse(root, []);

  return leaves;
}

// React component for a single header cell
interface HeaderCellProps {
  label: string;
  span: number;
  isColumn: boolean;
  theme: 'NeXTSTEP' | 'Modern';
}

function HeaderCell({ label, span, isColumn, theme }: HeaderCellProps) {
  const truncatedLabel = label.length > (isColumn ? 12 : 8)
    ? label.slice(0, isColumn ? 12 : 8) + '…'
    : label;

  return (
    <div
      className={`flex items-center justify-center text-xs font-medium px-1 ${
        theme === 'NeXTSTEP'
          ? 'bg-[#d4d4d4] border border-[#a0a0a0]'
          : 'bg-gray-100 border border-gray-200 rounded'
      }`}
      style={isColumn ? { gridColumn: `span ${span}` } : { gridRow: `span ${span}` }}
      title={label}
    >
      {truncatedLabel}
    </div>
  );
}

// React component for column headers (horizontal, multiple rows for nesting)
interface ColumnHeadersProps {
  levels: HeaderNode[][];
  theme: 'NeXTSTEP' | 'Modern';
}

function ColumnHeaders({ levels, theme }: ColumnHeadersProps) {
  if (levels.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5">
      {levels.map((level, levelIdx) => (
        <div
          key={levelIdx}
          className="grid gap-0.5"
          style={{
            gridTemplateColumns: level.map(h => `${h.span}fr`).join(' ')
          }}
        >
          {level.map((header, idx) => (
            <HeaderCell
              key={`${levelIdx}-${idx}-${header.label}`}
              label={header.label}
              span={1}
              isColumn={true}
              theme={theme}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// React component for row headers (vertical, multiple columns for nesting)
interface RowHeadersProps {
  levels: HeaderNode[][];
  theme: 'NeXTSTEP' | 'Modern';
  cellHeight: number;
}

function RowHeaders({ levels, theme, cellHeight }: RowHeadersProps) {
  if (levels.length === 0) return null;

  return (
    <div className="flex gap-0.5">
      {levels.map((level, levelIdx) => (
        <div
          key={levelIdx}
          className="flex flex-col gap-0.5 w-14"
        >
          {level.map((header, idx) => (
            <div
              key={`${levelIdx}-${idx}-${header.label}`}
              className={`flex items-center justify-center text-xs font-medium px-1 ${
                theme === 'NeXTSTEP'
                  ? 'bg-[#d4d4d4] border border-[#a0a0a0]'
                  : 'bg-gray-100 border border-gray-200 rounded'
              }`}
              style={{ height: header.span * cellHeight - 2 }}
              title={header.label}
            >
              {header.label.length > 8 ? header.label.slice(0, 8) + '…' : header.label}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function GridView({ data, onNodeClick }: GridViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const { wells } = usePAFV();

  // Get all axis chips from PAFV wells
  const xChips = wells.xRows.length > 0 ? wells.xRows : [{ id: 'folder', label: 'Folder', hasCheckbox: false }];
  const yChips = wells.yColumns.length > 0 ? wells.yColumns : [{ id: 'priority', label: 'Priority', hasCheckbox: false }];

  // Build hierarchical header structures
  const { xLeafPaths, yLeafPaths, grouped, xLevels, yLevels } = useMemo(() => {
    const xTree = buildHeaderTree(data, xChips);
    const yTree = buildHeaderTree(data, yChips);
    const xLeaves = getLeafPaths(xTree);
    const yLeaves = getLeafPaths(yTree);
    const xLvls = flattenHeaderLevels(xTree, xChips.length);
    const yLvls = flattenHeaderLevels(yTree, yChips.length);

    const map = new Map<string, Node[]>();
    data.forEach(node => {
      const xKey = getCompositeKey(node, xChips);
      const yKey = getCompositeKey(node, yChips);
      const key = `${xKey}||${yKey}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(node);
    });

    return {
      xLeafPaths: xLeaves,
      yLeafPaths: yLeaves,
      grouped: map,
      xLevels: xLvls,
      yLevels: yLvls,
    };
  }, [data, xChips, yChips]);

  // Calculate dimensions
  const numCols = xLeafPaths.length || 1;
  const numRows = yLeafPaths.length || 1;
  const rowHeaderWidth = yChips.length * 58; // 56px + 2px gap per level
  const colHeaderHeight = xChips.length * 26; // 24px + 2px gap per level

  // D3 rendering for the grid cells and cards
  useEffect(() => {
    if (!svgRef.current || !gridContainerRef.current) return;

    const container = gridContainerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const cellWidth = width / numCols;
    const cellHeight = height / numRows;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g');

    // Grid lines
    for (let i = 0; i <= numRows; i++) {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', width)
        .attr('y1', i * cellHeight)
        .attr('y2', i * cellHeight)
        .attr('stroke', theme === 'NeXTSTEP' ? '#a0a0a0' : '#e5e7eb')
        .attr('stroke-width', 1);
    }

    for (let i = 0; i <= numCols; i++) {
      g.append('line')
        .attr('x1', i * cellWidth)
        .attr('x2', i * cellWidth)
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke', theme === 'NeXTSTEP' ? '#a0a0a0' : '#e5e7eb')
        .attr('stroke-width', 1);
    }

    // Card dimensions
    const cardWidth = Math.min(cellWidth * 0.9, 120);
    const cardHeight = Math.min(cellHeight * 0.8, 60);

    // Render cells with cards
    xLeafPaths.forEach((xPath, colIdx) => {
      yLeafPaths.forEach((yPath, rowIdx) => {
        const xKey = xPath.join('|');
        const yKey = yPath.join('|');
        const nodes = grouped.get(`${xKey}||${yKey}`) || [];

        const cellX = colIdx * cellWidth;
        const cellY = rowIdx * cellHeight;

        const cols = Math.max(1, Math.floor(cellWidth / (cardWidth + 4)));

        nodes.forEach((node, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = cellX + 4 + col * (cardWidth + 4);
          const y = cellY + 4 + row * (cardHeight + 4);

          const nodeGroup = g.append('g')
            .attr('class', 'node-group')
            .attr('transform', `translate(${x},${y})`)
            .style('cursor', 'pointer')
            .on('click', () => onNodeClick?.(node));

          nodeGroup.append('rect')
            .attr('width', cardWidth)
            .attr('height', cardHeight)
            .attr('rx', theme === 'NeXTSTEP' ? 0 : 4)
            .attr('fill', theme === 'NeXTSTEP' ? '#d4d4d4' : '#ffffff')
            .attr('stroke', theme === 'NeXTSTEP' ? '#707070' : '#e5e7eb')
            .attr('stroke-width', 1);

          nodeGroup.append('text')
            .attr('x', 6)
            .attr('y', 16)
            .attr('class', 'text-xs font-medium')
            .attr('fill', '#374151')
            .text(node.name.length > 15 ? node.name.slice(0, 15) + '...' : node.name);

          nodeGroup.append('text')
            .attr('x', cardWidth - 6)
            .attr('y', 16)
            .attr('text-anchor', 'end')
            .attr('class', 'text-xs')
            .attr('fill', '#9ca3af')
            .text(`P${node.priority}`);
        });
      });
    });

  }, [data, xLeafPaths, yLeafPaths, numCols, numRows, grouped, theme, onNodeClick]);

  // Calculate cell height for row headers
  const estimatedCellHeight = gridContainerRef.current
    ? gridContainerRef.current.clientHeight / numRows
    : 60;

  return (
    <div className="w-full h-full flex flex-col">
      {/* Column headers row */}
      <div className="flex" style={{ marginLeft: rowHeaderWidth }}>
        <div className="flex-1" style={{ minHeight: colHeaderHeight }}>
          <ColumnHeaders levels={xLevels} theme={theme} />
        </div>
      </div>

      {/* Main content row: row headers + grid */}
      <div className="flex flex-1 min-h-0">
        {/* Row headers */}
        <div style={{ width: rowHeaderWidth }}>
          <RowHeaders levels={yLevels} theme={theme} cellHeight={estimatedCellHeight} />
        </div>

        {/* Grid container (D3 renders here) */}
        <div ref={gridContainerRef} className="flex-1">
          <svg ref={svgRef} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
}
