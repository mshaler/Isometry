import { useMemo } from 'react';
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

// Flatten header tree by level with position info for CSS Grid
interface FlatHeader {
  label: string;
  span: number;
  depth: number;
  startCol: number; // 1-indexed for CSS grid
}

function flattenForGrid(root: HeaderNode, maxDepth: number): FlatHeader[][] {
  const levels: FlatHeader[][] = [];
  for (let d = 0; d < maxDepth; d++) {
    levels.push([]);
  }

  function traverse(node: HeaderNode, depth: number, startCol: number): number {
    if (depth >= 0 && depth < maxDepth) {
      levels[depth].push({
        label: node.label,
        span: node.span,
        depth,
        startCol,
      });
    }

    let currentCol = startCol;
    node.children.forEach(child => {
      currentCol = traverse(child, depth + 1, currentCol);
    });

    return depth >= 0 ? startCol + node.span : currentCol;
  }

  traverse(root, -1, 1);
  return levels;
}

export function GridView({ data, onNodeClick }: GridViewProps) {
  const { theme } = useTheme();
  const { wells } = usePAFV();

  // Get axis chips from PAFV wells
  const colChips = wells.columns.length > 0 ? wells.columns : [{ id: 'year', label: 'Year', hasCheckbox: false }];
  const rowChips = wells.rows.length > 0 ? wells.rows : [{ id: 'folder', label: 'Folder', hasCheckbox: false }];

  // Build hierarchical header structures
  const { colLeafPaths, rowLeafPaths, grouped, colLevels, rowLevels } = useMemo(() => {
    const colTree = buildHeaderTree(data, colChips);
    const rowTree = buildHeaderTree(data, rowChips);
    const colLeaves = getLeafPaths(colTree);
    const rowLeaves = getLeafPaths(rowTree);
    const colLvls = flattenForGrid(colTree, colChips.length);
    const rowLvls = flattenForGrid(rowTree, rowChips.length);

    const map = new Map<string, Node[]>();
    data.forEach(node => {
      const colKey = getCompositeKey(node, colChips);
      const rowKey = getCompositeKey(node, rowChips);
      const key = `${colKey}||${rowKey}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(node);
    });

    return {
      colLeafPaths: colLeaves,
      rowLeafPaths: rowLeaves,
      grouped: map,
      colLevels: colLvls,
      rowLevels: rowLvls,
    };
  }, [data, colChips, rowChips]);

  // Grid dimensions
  const numColHeaders = rowChips.length; // Number of row header columns on the left
  const numRowHeaders = colChips.length; // Number of column header rows at the top
  const numDataCols = colLeafPaths.length || 1;
  const numDataRows = rowLeafPaths.length || 1;

  // Cell styling
  const headerBg = theme === 'NeXTSTEP' ? 'bg-[#e8e8e8]' : 'bg-gray-100';
  const headerBorder = theme === 'NeXTSTEP' ? 'border-[#a0a0a0]' : 'border-gray-300';
  const cellBorder = theme === 'NeXTSTEP' ? 'border-[#c0c0c0]' : 'border-gray-200';
  const cellBg = theme === 'NeXTSTEP' ? 'bg-white' : 'bg-white';

  // Calculate minimum cell width for proper display
  const minCellWidth = 100;
  const rowHeaderWidth = 80;
  const totalRowHeaderWidth = numColHeaders * rowHeaderWidth;

  return (
    <div className="w-full h-full overflow-auto">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${numColHeaders}, ${rowHeaderWidth}px) repeat(${numDataCols}, minmax(${minCellWidth}px, 1fr))`,
          gridTemplateRows: `repeat(${numRowHeaders}, 28px) repeat(${numDataRows}, minmax(40px, 1fr))`,
          minWidth: totalRowHeaderWidth + (numDataCols * minCellWidth),
        }}
      >
        {/* Top-left corner: empty cells where row headers and column headers meet */}
        {numColHeaders > 0 && numRowHeaders > 0 && (
          <div
            className={`${headerBg} border ${headerBorder}`}
            style={{
              gridColumn: `1 / ${numColHeaders + 1}`,
              gridRow: `1 / ${numRowHeaders + 1}`,
            }}
          />
        )}

        {/* Column headers (horizontal, at top) */}
        {colLevels.map((level, levelIdx) =>
          level.map((header, idx) => (
            <div
              key={`col-${levelIdx}-${idx}-${header.label}`}
              className={`${headerBg} border ${headerBorder} flex items-center justify-center text-sm font-medium px-2 truncate`}
              style={{
                gridColumn: `${numColHeaders + header.startCol} / span ${header.span}`,
                gridRow: levelIdx + 1,
              }}
              title={header.label}
            >
              {header.label}
            </div>
          ))
        )}

        {/* Row headers (vertical, on left) */}
        {rowLevels.map((level, levelIdx) =>
          level.map((header, idx) => (
            <div
              key={`row-${levelIdx}-${idx}-${header.label}`}
              className={`${headerBg} border ${headerBorder} flex items-center justify-center text-sm font-medium px-2 truncate`}
              style={{
                gridColumn: levelIdx + 1,
                gridRow: `${numRowHeaders + header.startCol} / span ${header.span}`,
              }}
              title={header.label}
            >
              {header.label}
            </div>
          ))
        )}

        {/* Data cells */}
        {colLeafPaths.map((colPath, colIdx) =>
          rowLeafPaths.map((rowPath, rowIdx) => {
            const colKey = colPath.join('|');
            const rowKey = rowPath.join('|');
            const nodes = grouped.get(`${colKey}||${rowKey}`) || [];

            return (
              <div
                key={`cell-${colIdx}-${rowIdx}`}
                className={`${cellBg} border ${cellBorder} p-1 overflow-hidden`}
                style={{
                  gridColumn: numColHeaders + colIdx + 1,
                  gridRow: numRowHeaders + rowIdx + 1,
                }}
              >
                {nodes.length === 1 ? (
                  // Single node: fill the cell
                  <div
                    className={`w-full h-full flex items-center justify-center cursor-pointer hover:bg-gray-50 text-sm ${
                      theme === 'NeXTSTEP' ? 'hover:bg-[#f0f0f0]' : ''
                    }`}
                    onClick={() => onNodeClick?.(nodes[0])}
                    title={nodes[0].name}
                  >
                    <span className="truncate px-1">{nodes[0].name}</span>
                  </div>
                ) : nodes.length > 1 ? (
                  // Multiple nodes: show count or stack
                  <div className="w-full h-full flex flex-col gap-0.5 overflow-auto">
                    {nodes.slice(0, 3).map((node) => (
                      <div
                        key={node.id}
                        className={`flex-shrink-0 px-2 py-1 text-xs cursor-pointer truncate rounded ${
                          theme === 'NeXTSTEP'
                            ? 'bg-[#e8e8e8] hover:bg-[#d8d8d8] border border-[#c0c0c0]'
                            : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                        }`}
                        onClick={() => onNodeClick?.(node)}
                        title={node.name}
                      >
                        {node.name}
                      </div>
                    ))}
                    {nodes.length > 3 && (
                      <div className="text-xs text-gray-400 text-center">
                        +{nodes.length - 3} more
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
