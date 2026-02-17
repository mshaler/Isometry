import { useState, useMemo } from "react";

// ============================================================================
// @isometry/primitives v0.2.0
// Tier 1: Design Tokens | Tier 2: Layout Primitives | Tier 3: View Compositions
//
// 4 polymorphic views: SuperGrid, Kanban, Timeline, Gallery
// All views render the SAME dataset — only the Tier 3 composition changes.
// ============================================================================

// ── Tier 1: Design Tokens ───────────────────────────────────────────────────
const T = {
  space: { xs: 2, sm: 4, md: 8, lg: 12, xl: 16, xxl: 24 },
  color: {
    bg:     { base: "#232328", raised: "#2e2e34", sunken: "#1a1a1e", glass: "rgba(46,46,52,0.92)", hover: "#34343a" },
    fg:     { primary: "#e4e4ea", secondary: "#9e9eaa", muted: "#5e5e6a", accent: "#4da6ff", white: "#ffffff" },
    border: { subtle: "rgba(255,255,255,0.05)", cell: "rgba(255,255,255,0.08)", default: "rgba(255,255,255,0.12)", strong: "rgba(255,255,255,0.20)", accent: "#4da6ff" },
    header: {
      col0: "#1a2744", col1: "#1e2f52", // column header depth tints
      row0: "#2a1a3a", row1: "#321e44", // row header depth tints
      corner: "#161620",
    },
    status: { todo: "#6e6e78", doing: "#4da6ff", review: "#ff9800", done: "#4caf50" },
    priority: { 3: "#ef5350", 2: "#ff9800", 1: "#4da6ff", 0: "#6e6e78" },
    tag: { UI: "#4da6ff22", Architecture: "#ff980022", Backend: "#4caf5022", Testing: "#e040fb22" },
    tagFg: { UI: "#7dc4ff", Architecture: "#ffb74d", Backend: "#81c784", Testing: "#ea80fc" },
  },
  radius: { xs: 2, sm: 3, md: 6, lg: 8, xl: 12 },
  shadow: { inset: "inset 0 1px 2px rgba(0,0,0,0.3)", raised: "0 2px 8px rgba(0,0,0,0.35)", deep: "0 4px 16px rgba(0,0,0,0.45)" },
  font: {
    mono: "'SF Mono', 'Fira Code', monospace",
    sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    size: { xxs: 9, xs: 10, sm: 11, md: 13, lg: 15, xl: 18, xxl: 22 },
    weight: { normal: 400, medium: 500, semi: 600, bold: 700 },
  },
  transition: { fast: "100ms ease", normal: "180ms ease", slow: "300ms ease-out" },
};

// ── Tier 2: Layout Primitives (editable via sidebar) ────────────────────────
const DEFAULT_GRID = {
  cornerWidth: 200, // total row header width
  rowHeaderWidths: [100, 100], // per-depth widths
  colHeaderHeight: 30, // per-level height
  colHeaderLevels: 2,
  cellMinWidth: 120,
  cellMinHeight: 72,
  cellPadding: 6,
  cellBorderWidth: 1,
  stickyHeaders: true,
};

const DEFAULT_KANBAN = {
  columnMinWidth: 260, columnMaxWidth: 320,
  columnGap: 12, columnHeaderHeight: 42,
  cardGap: 6, cardPadding: 12, columnPadding: 8,
  showCount: true,
};

const DEFAULT_TIMELINE = {
  rowHeight: 56, headerHeight: 48,
  dayWidth: 32, labelWidth: 160,
  barHeight: 24, barRadius: 4, barGap: 4,
  showGrid: true, showToday: true,
};

const DEFAULT_GALLERY = {
  cardWidth: 220, cardHeight: 160,
  cardGap: 12, cardPadding: 16,
  columns: 0, // 0 = auto-fit
  showTags: true, showPriority: true,
};

// ── Mock Data (simulating SQLite query result) ──────────────────────────────
const NODES = [
  { id: "1",  name: "Design SuperGrid headers",     status: "doing",   folder: "Isometry", priority: 3, tags: ["UI"],           due: "2025-02-18", created: "2025-02-01" },
  { id: "2",  name: "Implement CSS primitives",      status: "todo",    folder: "Isometry", priority: 2, tags: ["Architecture"], due: "2025-02-20", created: "2025-02-03" },
  { id: "3",  name: "CloudKit sync testing",          status: "review",  folder: "Isometry", priority: 1, tags: ["Backend"],      due: "2025-02-22", created: "2025-02-05" },
  { id: "4",  name: "FTS5 search optimization",       status: "done",    folder: "Isometry", priority: 2, tags: ["Backend"],      due: "2025-02-15", created: "2025-01-28" },
  { id: "5",  name: "D3 force simulation tuning",     status: "doing",   folder: "Isometry", priority: 3, tags: ["UI"],           due: "2025-02-19", created: "2025-02-02" },
  { id: "6",  name: "Write unit tests for edges",     status: "todo",    folder: "Isometry", priority: 1, tags: ["Testing"],      due: "2025-02-21", created: "2025-02-06" },
  { id: "7",  name: "Refactor LATCH navigator",       status: "todo",    folder: "Isometry", priority: 2, tags: ["Architecture"], due: "2025-02-23", created: "2025-02-04" },
  { id: "8",  name: "Build Kanban drag-drop",         status: "doing",   folder: "Research", priority: 3, tags: ["UI"],           due: "2025-02-17", created: "2025-01-30" },
  { id: "9",  name: "SQLite migration v2",            status: "done",    folder: "Research", priority: 1, tags: ["Backend"],      due: "2025-02-10", created: "2025-01-20" },
  { id: "10", name: "Performance benchmarks",         status: "review",  folder: "Research", priority: 2, tags: ["Testing"],      due: "2025-02-24", created: "2025-02-07" },
  { id: "11", name: "GRAPH CTE optimization",         status: "todo",    folder: "Research", priority: 3, tags: ["Backend"],      due: "2025-02-25", created: "2025-02-08" },
  { id: "12", name: "Card renderer polish",           status: "done",    folder: "Isometry", priority: 1, tags: ["UI"],           due: "2025-02-12", created: "2025-01-25" },
  { id: "13", name: "Integration test harness",       status: "doing",   folder: "Research", priority: 2, tags: ["Testing"],      due: "2025-02-16", created: "2025-02-09" },
  { id: "14", name: "Schema validation layer",        status: "todo",    folder: "Isometry", priority: 1, tags: ["Architecture"], due: "2025-02-26", created: "2025-02-10" },
];

const STATUS_ORDER = ["todo", "doing", "review", "done"];
const STATUS_LABELS = { todo: "To Do", doing: "In Progress", review: "Review", done: "Done" };
const FOLDERS = ["Isometry", "Research"];
const TAGS = ["UI", "Architecture", "Backend", "Testing"];

// ── Helpers ─────────────────────────────────────────────────────────────────
function PriorityDot({ p, size = 6 }) {
  return <span style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0,
    background: T.color.priority[p] || T.color.fg.muted,
    boxShadow: `0 0 4px ${T.color.priority[p] || T.color.fg.muted}40`,
  }} />;
}

function StatusDot({ status, size = 8 }) {
  return <span style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0,
    background: T.color.status[status],
    boxShadow: `0 0 6px ${T.color.status[status]}50`,
  }} />;
}

function TagPill({ tag }) {
  return <span style={{ fontSize: T.font.size.xxs, fontFamily: T.font.mono, padding: "1px 5px",
    borderRadius: T.radius.xs, background: T.color.tag[tag] || T.color.bg.raised,
    color: T.color.tagFg[tag] || T.color.fg.secondary, letterSpacing: "0.02em",
  }}>{tag}</span>;
}

// ============================================================================
// TIER 3: SUPERGRID — with stacked nested headers + cell borders
// ============================================================================
// Row headers: Folder (depth 0) → Tag (depth 1)   [2-level SuperStack]
// Col headers: Status Group (depth 0) → Status (depth 1) [2-level SuperStack]
// ============================================================================

function SuperGridView({ config }) {
  const c = { ...DEFAULT_GRID, ...config };

  // Build row header tree: Folder → Tag
  const rowTree = useMemo(() => {
    const tree = [];
    FOLDERS.forEach(folder => {
      const folderTags = TAGS.filter(tag =>
        NODES.some(n => n.folder === folder && n.tags.includes(tag))
      );
      if (folderTags.length > 0) {
        tree.push({ value: folder, children: folderTags.map(t => ({ value: t, children: [] })) });
      }
    });
    return tree;
  }, []);

  // Build column header tree: Status Group → Status
  // Group: Active = [todo, doing], Complete = [review, done]
  const colTree = useMemo(() => [
    { value: "Active", children: [{ value: "todo" }, { value: "doing" }] },
    { value: "Complete", children: [{ value: "review" }, { value: "done" }] },
  ], []);

  // Flatten leaves
  const rowLeaves = rowTree.flatMap(parent => parent.children.map(child => ({ folder: parent.value, tag: child.value })));
  const colLeaves = colTree.flatMap(parent => parent.children.map(child => ({ group: parent.value, status: child.value })));

  // Cell lookup
  const getCards = (folder, tag, status) =>
    NODES.filter(n => n.folder === folder && n.tags.includes(tag) && n.status === status);

  const totalCols = colLeaves.length;
  const borderColor = T.color.border.cell;
  const borderW = c.cellBorderWidth;

  // Grid template
  const colTemplate = c.rowHeaderWidths.map(w => `${w}px`).join(" ") +
    " " + colLeaves.map(() => `minmax(${c.cellMinWidth}px, 1fr)`).join(" ");

  // Row count: 2 header rows + data rows
  const headerRows = 2; // col header depth
  const dataRows = rowLeaves.length;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: colTemplate,
      gridTemplateRows: `repeat(${headerRows}, ${c.colHeaderHeight}px) repeat(${dataRows}, minmax(${c.cellMinHeight}px, auto))`,
      fontFamily: T.font.sans,
      fontSize: T.font.size.sm,
      border: `${borderW}px solid ${T.color.border.strong}`,
      borderRadius: T.radius.lg,
      overflow: "hidden",
      background: borderColor,
      gap: 0,
    }}>

      {/* ── Corner cells (top-left) ── */}
      {/* Corner spans 2 cols (row header depths) × 2 rows (col header depths) */}
      <div style={{
        gridColumn: `1 / ${c.rowHeaderWidths.length + 1}`,
        gridRow: `1 / ${headerRows + 1}`,
        background: T.color.header.corner,
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        padding: `${T.space.sm}px ${T.space.md}px`,
        borderRight: `${borderW}px solid ${T.color.border.strong}`,
        borderBottom: `${borderW}px solid ${T.color.border.strong}`,
      }}>
        <span style={{ color: T.color.fg.muted, fontSize: T.font.size.xxs, fontFamily: T.font.mono, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Folder / Tag
        </span>
        <span style={{ color: T.color.fg.muted, fontSize: T.font.size.xxs, fontFamily: T.font.mono, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          ↓ Status →
        </span>
      </div>

      {/* ── Column headers: Level 0 (Status Groups) ── */}
      {(() => {
        let colStart = c.rowHeaderWidths.length + 1;
        return colTree.map((group, gi) => {
          const span = group.children.length;
          const el = (
            <div key={`ch0-${gi}`} style={{
              gridColumn: `${colStart} / ${colStart + span}`,
              gridRow: "1",
              background: T.color.header.col0,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: `0 ${T.space.md}px`,
              fontWeight: T.font.weight.semi,
              fontSize: T.font.size.md,
              color: T.color.fg.primary,
              borderRight: gi < colTree.length - 1 ? `${borderW}px solid ${T.color.border.strong}` : "none",
              borderBottom: `${borderW}px solid ${T.color.border.default}`,
              letterSpacing: "0.02em",
              position: "relative",
            }}>
              {group.value}
              <span style={{ position: "absolute", right: 8, fontSize: T.font.size.xxs, color: T.color.fg.muted, fontFamily: T.font.mono }}>
                {NODES.filter(n => group.children.some(ch => ch.value === n.status)).length}
              </span>
            </div>
          );
          colStart += span;
          return el;
        });
      })()}

      {/* ── Column headers: Level 1 (Individual Statuses) ── */}
      {colLeaves.map((leaf, ci) => (
        <div key={`ch1-${ci}`} style={{
          gridColumn: `${c.rowHeaderWidths.length + 1 + ci}`,
          gridRow: "2",
          background: T.color.header.col1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          padding: `0 ${T.space.sm}px`,
          fontSize: T.font.size.sm,
          color: T.color.fg.secondary,
          fontWeight: T.font.weight.medium,
          borderRight: ci < colLeaves.length - 1 ? `${borderW}px solid ${T.color.border.cell}` : "none",
          borderBottom: `${borderW}px solid ${T.color.border.strong}`,
        }}>
          <StatusDot status={leaf.status} size={7} />
          {STATUS_LABELS[leaf.status]}
        </div>
      ))}

      {/* ── Row headers + Data cells ── */}
      {(() => {
        const elements = [];
        let rowIndex = 0;
        let leafIndex = 0;

        rowTree.forEach((parent, pi) => {
          const childCount = parent.children.length;
          const gridRowStart = headerRows + 1 + leafIndex;
          const gridRowEnd = gridRowStart + childCount;

          // Row header: Level 0 (Folder) — spans children
          elements.push(
            <div key={`rh0-${pi}`} style={{
              gridColumn: "1",
              gridRow: `${gridRowStart} / ${gridRowEnd}`,
              background: T.color.header.row0,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: `${T.space.md}px ${T.space.sm}px`,
              fontWeight: T.font.weight.semi,
              fontSize: T.font.size.md,
              color: T.color.fg.primary,
              borderRight: `${borderW}px solid ${T.color.border.default}`,
              borderBottom: pi < rowTree.length - 1 ? `${borderW}px solid ${T.color.border.strong}` : "none",
              writingMode: childCount > 2 ? "vertical-rl" : "horizontal-tb",
              textOrientation: "mixed",
              letterSpacing: childCount > 2 ? "0.08em" : "0.02em",
              position: "relative",
            }}>
              {parent.value}
              <span style={{
                position: "absolute",
                ...(childCount > 2 ? { bottom: 6, left: "50%", transform: "translateX(-50%) rotate(90deg)" } : { right: 4, bottom: 4 }),
                fontSize: T.font.size.xxs, color: T.color.fg.muted, fontFamily: T.font.mono,
                writingMode: "horizontal-tb",
              }}>
                {NODES.filter(n => n.folder === parent.value).length}
              </span>
            </div>
          );

          // Row header: Level 1 (Tag) + data cells for each child
          parent.children.forEach((child, ci) => {
            const absRow = headerRows + 1 + leafIndex;
            const isLastChild = ci === parent.children.length - 1;
            const isLastParent = pi === rowTree.length - 1;

            // Tag header
            elements.push(
              <div key={`rh1-${pi}-${ci}`} style={{
                gridColumn: "2",
                gridRow: `${absRow}`,
                background: T.color.header.row1,
                display: "flex", alignItems: "center", gap: 6,
                padding: `0 ${T.space.md}px`,
                fontSize: T.font.size.sm,
                color: T.color.fg.secondary,
                fontWeight: T.font.weight.medium,
                borderRight: `${borderW}px solid ${T.color.border.strong}`,
                borderBottom: `${borderW}px solid ${(!isLastChild || !isLastParent) ? T.color.border.cell : "transparent"}`,
              }}>
                <TagPill tag={child.value} />
              </div>
            );

            // Data cells
            colLeaves.forEach((col, colIdx) => {
              const cards = getCards(parent.value, child.value, col.status);
              elements.push(
                <div key={`cell-${pi}-${ci}-${colIdx}`} style={{
                  gridColumn: `${c.rowHeaderWidths.length + 1 + colIdx}`,
                  gridRow: `${absRow}`,
                  background: T.color.bg.base,
                  padding: c.cellPadding,
                  display: "flex", flexDirection: "column", gap: T.space.xs,
                  minHeight: c.cellMinHeight,
                  borderRight: colIdx < colLeaves.length - 1 ? `${borderW}px solid ${borderColor}` : "none",
                  borderBottom: `${borderW}px solid ${borderColor}`,
                  transition: `background ${T.transition.fast}`,
                  cursor: cards.length > 0 ? "pointer" : "default",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = T.color.bg.hover; }}
                onMouseLeave={e => { e.currentTarget.style.background = T.color.bg.base; }}
                >
                  {cards.length === 0 ? (
                    <span style={{ margin: "auto", color: T.color.fg.muted, fontSize: T.font.size.xxs, opacity: 0.4 }}>·</span>
                  ) : cards.map(card => (
                    <div key={card.id} style={{
                      background: T.color.bg.raised,
                      borderRadius: T.radius.xs,
                      padding: `${T.space.xs}px ${T.space.sm}px`,
                      display: "flex", alignItems: "center", gap: T.space.sm,
                      borderLeft: `2px solid ${T.color.status[card.status]}`,
                      fontSize: T.font.size.xs,
                      color: T.color.fg.primary,
                      lineHeight: 1.3,
                      transition: `transform ${T.transition.fast}`,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateX(2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateX(0)"; }}
                    >
                      <PriorityDot p={card.priority} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{card.name}</span>
                    </div>
                  ))}
                </div>
              );
            });

            leafIndex++;
          });
        });

        return elements;
      })()}
    </div>
  );
}

// ============================================================================
// TIER 3: KANBAN
// ============================================================================

function KanbanView({ config }) {
  const c = { ...DEFAULT_KANBAN, ...config };
  const columns = STATUS_ORDER.map(s => ({ id: s, label: STATUS_LABELS[s], cards: NODES.filter(n => n.status === s) }));

  return (
    <div style={{ display: "flex", gap: c.columnGap, padding: T.space.lg, overflowX: "auto", fontFamily: T.font.sans }}>
      {columns.map(col => (
        <div key={col.id} style={{
          minWidth: c.columnMinWidth, maxWidth: c.columnMaxWidth, flex: `0 0 ${c.columnMinWidth}px`,
          display: "flex", flexDirection: "column",
          background: T.color.bg.sunken, borderRadius: T.radius.lg, overflow: "hidden",
          border: `1px solid ${T.color.border.subtle}`,
        }}>
          <div style={{
            height: c.columnHeaderHeight, display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: `0 ${c.columnPadding}px`, background: T.color.bg.raised,
            borderBottom: `1px solid ${T.color.border.subtle}`,
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, color: T.color.fg.primary, fontWeight: T.font.weight.semi, fontSize: T.font.size.md }}>
              <StatusDot status={col.id} />
              {col.label}
            </span>
            {c.showCount && <span style={{ background: T.color.bg.base, color: T.color.fg.muted, fontSize: T.font.size.xs, fontFamily: T.font.mono, padding: "2px 8px", borderRadius: T.radius.sm }}>{col.cards.length}</span>}
          </div>
          <div style={{ padding: c.columnPadding, display: "flex", flexDirection: "column", gap: c.cardGap, flex: 1, minHeight: 100 }}>
            {col.cards.map(card => (
              <div key={card.id} style={{
                background: T.color.bg.raised, borderRadius: T.radius.md, padding: c.cardPadding,
                display: "flex", flexDirection: "column", gap: T.space.sm,
                border: `1px solid ${T.color.border.subtle}`, boxShadow: T.shadow.raised,
                cursor: "grab", transition: `all ${T.transition.normal}`,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.color.border.accent; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = T.shadow.deep; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.color.border.subtle; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = T.shadow.raised; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: T.space.sm, fontSize: T.font.size.md, color: T.color.fg.primary, fontWeight: T.font.weight.medium, lineHeight: 1.4 }}>
                  <PriorityDot p={card.priority} size={8} />
                  {card.name}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: T.space.md, fontSize: T.font.size.xs, color: T.color.fg.muted }}>
                  {card.tags.map(tag => <TagPill key={tag} tag={tag} />)}
                  <span style={{ marginLeft: "auto", fontFamily: T.font.mono }}>{card.due.slice(5)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// TIER 3: TIMELINE — Time axis on x-plane, Category on y-plane
// ============================================================================

function TimelineView({ config }) {
  const c = { ...DEFAULT_TIMELINE, ...config };

  // Time range: Feb 1 – Feb 28
  const startDate = new Date("2025-02-01");
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d;
  });
  const dayLabels = days.map(d => d.getDate());
  const weekStarts = days.filter(d => d.getDay() === 1);

  // Group by status (y-axis rows)
  const rows = STATUS_ORDER.map(s => ({
    id: s, label: STATUS_LABELS[s],
    cards: NODES.filter(n => n.status === s).map(card => {
      const created = new Date(card.created);
      const due = new Date(card.due);
      const startDay = Math.max(0, Math.floor((created - startDate) / 86400000));
      const endDay = Math.min(27, Math.floor((due - startDate) / 86400000));
      return { ...card, startDay, endDay, duration: endDay - startDay + 1 };
    }),
  }));

  const totalWidth = c.labelWidth + days.length * c.dayWidth;

  // Today marker
  const todayIdx = 14; // Feb 15

  return (
    <div style={{ overflowX: "auto", fontFamily: T.font.sans, padding: T.space.lg }}>
      <div style={{ minWidth: totalWidth }}>
        {/* Day header */}
        <div style={{ display: "flex", height: c.headerHeight, borderBottom: `1px solid ${T.color.border.strong}` }}>
          <div style={{ width: c.labelWidth, flexShrink: 0, display: "flex", alignItems: "flex-end",
            padding: `0 ${T.space.md}px ${T.space.sm}px`, color: T.color.fg.muted, fontSize: T.font.size.xxs,
            fontFamily: T.font.mono, textTransform: "uppercase", letterSpacing: "0.1em",
            background: T.color.header.corner, borderRight: `1px solid ${T.color.border.strong}`,
          }}>
            Status / February 2025
          </div>
          <div style={{ display: "flex", flex: 1, position: "relative" }}>
            {days.map((d, i) => {
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              const isToday = i === todayIdx;
              return (
                <div key={i} style={{
                  width: c.dayWidth, flexShrink: 0, display: "flex", alignItems: "flex-end", justifyContent: "center",
                  paddingBottom: T.space.xs, fontSize: T.font.size.xxs, fontFamily: T.font.mono,
                  color: isToday ? T.color.fg.accent : isWeekend ? T.color.fg.muted : T.color.fg.secondary,
                  fontWeight: isToday ? T.font.weight.bold : T.font.weight.normal,
                  background: isToday ? `${T.color.fg.accent}10` : isWeekend ? `${T.color.bg.sunken}` : "transparent",
                  borderRight: `1px solid ${T.color.border.subtle}`,
                }}>
                  {dayLabels[i]}
                </div>
              );
            })}
          </div>
        </div>

        {/* Rows */}
        {rows.map((row, ri) => (
          <div key={row.id} style={{
            display: "flex", minHeight: Math.max(c.rowHeight, row.cards.length * (c.barHeight + c.barGap) + T.space.md * 2),
            borderBottom: `1px solid ${T.color.border.cell}`,
          }}>
            {/* Row label */}
            <div style={{
              width: c.labelWidth, flexShrink: 0, display: "flex", alignItems: "center", gap: 8,
              padding: `0 ${T.space.lg}px`, background: T.color.bg.sunken,
              borderRight: `1px solid ${T.color.border.strong}`,
              fontSize: T.font.size.sm, color: T.color.fg.primary, fontWeight: T.font.weight.medium,
            }}>
              <StatusDot status={row.id} />
              {row.label}
              <span style={{ marginLeft: "auto", fontSize: T.font.size.xxs, fontFamily: T.font.mono, color: T.color.fg.muted }}>{row.cards.length}</span>
            </div>

            {/* Gantt area */}
            <div style={{ flex: 1, position: "relative", padding: `${T.space.sm}px 0` }}>
              {/* Grid lines */}
              {c.showGrid && days.map((d, i) => (
                <div key={i} style={{
                  position: "absolute", left: i * c.dayWidth, top: 0, bottom: 0, width: 1,
                  background: i === todayIdx && c.showToday ? T.color.fg.accent : T.color.border.subtle,
                  opacity: i === todayIdx ? 0.4 : 1,
                }} />
              ))}

              {/* Bars */}
              {row.cards.map((card, ci) => (
                <div key={card.id} style={{
                  position: "absolute",
                  left: card.startDay * c.dayWidth + 2,
                  top: ci * (c.barHeight + c.barGap) + T.space.sm,
                  width: card.duration * c.dayWidth - 4,
                  height: c.barHeight,
                  background: `${T.color.status[card.status]}cc`,
                  borderRadius: c.barRadius,
                  display: "flex", alignItems: "center", gap: 4,
                  padding: `0 ${T.space.sm}px`,
                  fontSize: T.font.size.xxs, color: T.color.fg.white,
                  fontWeight: T.font.weight.medium,
                  overflow: "hidden", whiteSpace: "nowrap",
                  cursor: "pointer",
                  boxShadow: `0 1px 3px ${T.color.status[card.status]}40`,
                  transition: `all ${T.transition.fast}`,
                }}
                onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.2)"; e.currentTarget.style.transform = "scaleY(1.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.filter = "none"; e.currentTarget.style.transform = "scaleY(1)"; }}
                title={`${card.name} (${card.created} → ${card.due})`}
                >
                  <PriorityDot p={card.priority} size={5} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{card.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// TIER 3: GALLERY — Masonry-style card grid
// ============================================================================

function GalleryView({ config }) {
  const c = { ...DEFAULT_GALLERY, ...config };

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: c.columns > 0
        ? `repeat(${c.columns}, ${c.cardWidth}px)`
        : `repeat(auto-fill, minmax(${c.cardWidth}px, 1fr))`,
      gap: c.cardGap,
      padding: T.space.lg,
      fontFamily: T.font.sans,
    }}>
      {NODES.map(card => (
        <div key={card.id} style={{
          background: T.color.bg.raised,
          borderRadius: T.radius.lg,
          padding: c.cardPadding,
          display: "flex", flexDirection: "column", gap: T.space.md,
          border: `1px solid ${T.color.border.subtle}`,
          minHeight: c.cardHeight,
          cursor: "pointer",
          transition: `all ${T.transition.normal}`,
          position: "relative",
          overflow: "hidden",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = T.color.border.accent; e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = T.shadow.deep; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = T.color.border.subtle; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
        >
          {/* Status bar at top */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: T.color.status[card.status] }} />

          {/* Title */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: T.space.sm, marginTop: T.space.xs }}>
            {c.showPriority && <PriorityDot p={card.priority} size={8} />}
            <span style={{ fontSize: T.font.size.md, fontWeight: T.font.weight.semi, color: T.color.fg.primary, lineHeight: 1.35, flex: 1 }}>
              {card.name}
            </span>
          </div>

          {/* Meta row */}
          <div style={{ display: "flex", alignItems: "center", gap: T.space.sm, marginTop: "auto" }}>
            <StatusDot status={card.status} size={6} />
            <span style={{ fontSize: T.font.size.xs, color: T.color.fg.muted }}>{STATUS_LABELS[card.status]}</span>
            <span style={{ marginLeft: "auto", fontSize: T.font.size.xxs, fontFamily: T.font.mono, color: T.color.fg.muted }}>{card.due.slice(5)}</span>
          </div>

          {/* Tags */}
          {c.showTags && (
            <div style={{ display: "flex", gap: T.space.xs, flexWrap: "wrap" }}>
              {card.tags.map(tag => <TagPill key={tag} tag={tag} />)}
              <span style={{ fontSize: T.font.size.xxs, fontFamily: T.font.mono, color: T.color.fg.muted, padding: "1px 5px" }}>{card.folder}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// SIDEBAR CONTROLS
// ============================================================================

function Slider({ label, value, min, max, step = 1, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: T.font.size.xs }}>
      <span style={{ color: T.color.fg.secondary, width: 120, flexShrink: 0, fontFamily: T.font.mono, fontSize: T.font.size.xxs }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: T.color.fg.accent, height: 3, cursor: "pointer" }} />
      <span style={{ color: T.color.fg.accent, fontFamily: T.font.mono, fontSize: T.font.size.xxs, width: 36, textAlign: "right" }}>{value}px</span>
    </div>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: T.font.size.xs }}>
      <span style={{ color: T.color.fg.secondary, width: 120, flexShrink: 0, fontSize: T.font.size.xxs }}>{label}</span>
      <button onClick={() => onChange(!value)} style={{
        background: value ? T.color.fg.accent : T.color.bg.sunken,
        border: `1px solid ${value ? T.color.fg.accent : T.color.border.default}`,
        borderRadius: 10, width: 32, height: 18, cursor: "pointer", position: "relative", transition: `all ${T.transition.fast}`,
      }}>
        <span style={{ position: "absolute", top: 2, left: value ? 16 : 2, width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: `left ${T.transition.fast}`, boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }} />
      </button>
    </div>
  );
}

function ViewControls({ view, gridCfg, setGridCfg, kanbanCfg, setKanbanCfg, timelineCfg, setTimelineCfg, galleryCfg, setGalleryCfg }) {
  const ug = (k, v) => setGridCfg(p => ({ ...p, [k]: v }));
  const uk = (k, v) => setKanbanCfg(p => ({ ...p, [k]: v }));
  const ut = (k, v) => setTimelineCfg(p => ({ ...p, [k]: v }));
  const ugal = (k, v) => setGalleryCfg(p => ({ ...p, [k]: v }));

  if (view === "supergrid") return (
    <div style={{ display: "flex", flexDirection: "column", gap: T.space.md }}>
      <Slider label="Row Hdr 0 W" value={gridCfg.rowHeaderWidths[0]} min={40} max={160} onChange={v => setGridCfg(p => ({ ...p, rowHeaderWidths: [v, p.rowHeaderWidths[1]] }))} />
      <Slider label="Row Hdr 1 W" value={gridCfg.rowHeaderWidths[1]} min={40} max={160} onChange={v => setGridCfg(p => ({ ...p, rowHeaderWidths: [p.rowHeaderWidths[0], v] }))} />
      <Slider label="Col Hdr H" value={gridCfg.colHeaderHeight} min={20} max={48} onChange={v => ug("colHeaderHeight", v)} />
      <Slider label="Cell Min W" value={gridCfg.cellMinWidth} min={60} max={240} onChange={v => ug("cellMinWidth", v)} />
      <Slider label="Cell Min H" value={gridCfg.cellMinHeight} min={32} max={160} onChange={v => ug("cellMinHeight", v)} />
      <Slider label="Cell Pad" value={gridCfg.cellPadding} min={0} max={16} onChange={v => ug("cellPadding", v)} />
      <Slider label="Border W" value={gridCfg.cellBorderWidth} min={0} max={3} onChange={v => ug("cellBorderWidth", v)} />
    </div>
  );

  if (view === "kanban") return (
    <div style={{ display: "flex", flexDirection: "column", gap: T.space.md }}>
      <Slider label="Col Min W" value={kanbanCfg.columnMinWidth} min={180} max={400} onChange={v => uk("columnMinWidth", v)} />
      <Slider label="Col Gap" value={kanbanCfg.columnGap} min={0} max={32} onChange={v => uk("columnGap", v)} />
      <Slider label="Header H" value={kanbanCfg.columnHeaderHeight} min={28} max={64} onChange={v => uk("columnHeaderHeight", v)} />
      <Slider label="Card Gap" value={kanbanCfg.cardGap} min={0} max={16} onChange={v => uk("cardGap", v)} />
      <Slider label="Card Pad" value={kanbanCfg.cardPadding} min={4} max={24} onChange={v => uk("cardPadding", v)} />
      <Toggle label="Show Count" value={kanbanCfg.showCount} onChange={v => uk("showCount", v)} />
    </div>
  );

  if (view === "timeline") return (
    <div style={{ display: "flex", flexDirection: "column", gap: T.space.md }}>
      <Slider label="Row H" value={timelineCfg.rowHeight} min={32} max={100} onChange={v => ut("rowHeight", v)} />
      <Slider label="Header H" value={timelineCfg.headerHeight} min={28} max={64} onChange={v => ut("headerHeight", v)} />
      <Slider label="Day W" value={timelineCfg.dayWidth} min={16} max={64} onChange={v => ut("dayWidth", v)} />
      <Slider label="Label W" value={timelineCfg.labelWidth} min={80} max={240} onChange={v => ut("labelWidth", v)} />
      <Slider label="Bar H" value={timelineCfg.barHeight} min={12} max={40} onChange={v => ut("barHeight", v)} />
      <Toggle label="Show Grid" value={timelineCfg.showGrid} onChange={v => ut("showGrid", v)} />
      <Toggle label="Show Today" value={timelineCfg.showToday} onChange={v => ut("showToday", v)} />
    </div>
  );

  if (view === "gallery") return (
    <div style={{ display: "flex", flexDirection: "column", gap: T.space.md }}>
      <Slider label="Card W" value={galleryCfg.cardWidth} min={160} max={360} onChange={v => ugal("cardWidth", v)} />
      <Slider label="Card H" value={galleryCfg.cardHeight} min={80} max={260} onChange={v => ugal("cardHeight", v)} />
      <Slider label="Gap" value={galleryCfg.cardGap} min={4} max={32} onChange={v => ugal("cardGap", v)} />
      <Slider label="Pad" value={galleryCfg.cardPadding} min={8} max={32} onChange={v => ugal("cardPadding", v)} />
      <Toggle label="Show Tags" value={galleryCfg.showTags} onChange={v => ugal("showTags", v)} />
      <Toggle label="Show Priority" value={galleryCfg.showPriority} onChange={v => ugal("showPriority", v)} />
    </div>
  );

  return null;
}

// ============================================================================
// CSS EXPORT
// ============================================================================

function CSSExport({ gridCfg, kanbanCfg, timelineCfg, galleryCfg }) {
  const [copied, setCopied] = useState(false);
  const css = `/* @isometry/primitives v0.2.0 — Generated CSS Custom Properties */
:root {
  /* ── Tier 1: Design Tokens ── */
  --iso-space-xs: ${T.space.xs}px;
  --iso-space-sm: ${T.space.sm}px;
  --iso-space-md: ${T.space.md}px;
  --iso-space-lg: ${T.space.lg}px;
  --iso-space-xl: ${T.space.xl}px;

  --iso-bg-base: ${T.color.bg.base};
  --iso-bg-raised: ${T.color.bg.raised};
  --iso-bg-sunken: ${T.color.bg.sunken};
  --iso-bg-hover: ${T.color.bg.hover};
  --iso-fg-primary: ${T.color.fg.primary};
  --iso-fg-secondary: ${T.color.fg.secondary};
  --iso-fg-muted: ${T.color.fg.muted};
  --iso-fg-accent: ${T.color.fg.accent};
  --iso-border-subtle: ${T.color.border.subtle};
  --iso-border-cell: ${T.color.border.cell};
  --iso-border-default: ${T.color.border.default};
  --iso-border-strong: ${T.color.border.strong};

  --iso-header-col0: ${T.color.header.col0};
  --iso-header-col1: ${T.color.header.col1};
  --iso-header-row0: ${T.color.header.row0};
  --iso-header-row1: ${T.color.header.row1};
  --iso-header-corner: ${T.color.header.corner};

  --iso-status-todo: ${T.color.status.todo};
  --iso-status-doing: ${T.color.status.doing};
  --iso-status-review: ${T.color.status.review};
  --iso-status-done: ${T.color.status.done};

  --iso-radius-sm: ${T.radius.sm}px;
  --iso-radius-md: ${T.radius.md}px;
  --iso-radius-lg: ${T.radius.lg}px;

  --iso-font-sans: ${T.font.sans};
  --iso-font-mono: ${T.font.mono};

  /* ── Tier 2: SuperGrid ── */
  --iso-grid-row-hdr0-w: ${gridCfg.rowHeaderWidths[0]}px;
  --iso-grid-row-hdr1-w: ${gridCfg.rowHeaderWidths[1]}px;
  --iso-grid-col-hdr-h: ${gridCfg.colHeaderHeight}px;
  --iso-grid-cell-min-w: ${gridCfg.cellMinWidth}px;
  --iso-grid-cell-min-h: ${gridCfg.cellMinHeight}px;
  --iso-grid-cell-pad: ${gridCfg.cellPadding}px;
  --iso-grid-cell-border: ${gridCfg.cellBorderWidth}px;

  /* ── Tier 2: Kanban ── */
  --iso-kanban-col-min-w: ${kanbanCfg.columnMinWidth}px;
  --iso-kanban-col-max-w: ${kanbanCfg.columnMaxWidth}px;
  --iso-kanban-col-gap: ${kanbanCfg.columnGap}px;
  --iso-kanban-col-hdr-h: ${kanbanCfg.columnHeaderHeight}px;
  --iso-kanban-card-gap: ${kanbanCfg.cardGap}px;
  --iso-kanban-card-pad: ${kanbanCfg.cardPadding}px;

  /* ── Tier 2: Timeline ── */
  --iso-timeline-row-h: ${timelineCfg.rowHeight}px;
  --iso-timeline-hdr-h: ${timelineCfg.headerHeight}px;
  --iso-timeline-day-w: ${timelineCfg.dayWidth}px;
  --iso-timeline-label-w: ${timelineCfg.labelWidth}px;
  --iso-timeline-bar-h: ${timelineCfg.barHeight}px;
  --iso-timeline-bar-r: ${timelineCfg.barRadius}px;

  /* ── Tier 2: Gallery ── */
  --iso-gallery-card-w: ${galleryCfg.cardWidth}px;
  --iso-gallery-card-h: ${galleryCfg.cardHeight}px;
  --iso-gallery-gap: ${galleryCfg.cardGap}px;
  --iso-gallery-pad: ${galleryCfg.cardPadding}px;
}`;

  return (
    <div style={{ background: T.color.bg.sunken, borderRadius: T.radius.lg, overflow: "hidden", border: `1px solid ${T.color.border.subtle}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `${T.space.md}px ${T.space.lg}px`, background: T.color.bg.raised, borderBottom: `1px solid ${T.color.border.subtle}` }}>
        <span style={{ color: T.color.fg.secondary, fontSize: T.font.size.xxs, fontFamily: T.font.mono, textTransform: "uppercase", letterSpacing: "0.08em" }}>CSS Custom Properties — Copy to your codebase</span>
        <button onClick={() => { navigator.clipboard?.writeText(css); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          style={{ background: copied ? T.color.status.done : T.color.fg.accent, color: "#fff", border: "none", borderRadius: T.radius.sm, padding: "3px 10px", fontSize: T.font.size.xxs, fontFamily: T.font.mono, cursor: "pointer" }}>
          {copied ? "✓ Copied" : "Copy CSS"}
        </button>
      </div>
      <pre style={{ margin: 0, padding: T.space.lg, color: T.color.fg.secondary, fontSize: T.font.size.xxs, fontFamily: T.font.mono, lineHeight: 1.55, overflowX: "auto", maxHeight: 320 }}>{css}</pre>
    </div>
  );
}

// ============================================================================
// MAIN APP
// ============================================================================

const VIEWS = [
  { id: "supergrid", label: "SuperGrid", latch: "Folder×Tag → Status", icon: "▦" },
  { id: "kanban",    label: "Kanban",    latch: "Status columns",       icon: "▥" },
  { id: "timeline",  label: "Timeline",  latch: "Time × Status",        icon: "▤" },
  { id: "gallery",   label: "Gallery",   latch: "Auto-fill grid",       icon: "▧" },
];

export default function IsometryPrimitivesV2() {
  const [view, setView] = useState("supergrid");
  const [showCSS, setShowCSS] = useState(false);
  const [gridCfg, setGridCfg] = useState({ ...DEFAULT_GRID });
  const [kanbanCfg, setKanbanCfg] = useState({ ...DEFAULT_KANBAN });
  const [timelineCfg, setTimelineCfg] = useState({ ...DEFAULT_TIMELINE });
  const [galleryCfg, setGalleryCfg] = useState({ ...DEFAULT_GALLERY });

  const activeInfo = VIEWS.find(v => v.id === view);

  return (
    <div style={{ minHeight: "100vh", background: T.color.bg.base, color: T.color.fg.primary, fontFamily: T.font.sans, display: "flex", flexDirection: "column" }}>

      {/* ── Header ── */}
      <header style={{ padding: `${T.space.md}px ${T.space.xxl}px`, borderBottom: `1px solid ${T.color.border.subtle}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: T.color.bg.sunken, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: T.font.size.xl, fontWeight: T.font.weight.bold, letterSpacing: "-0.02em" }}>
            <span style={{ color: T.color.fg.accent }}>@isometry</span>
            <span style={{ color: T.color.fg.muted }}>/primitives</span>
          </span>
          <span style={{ fontSize: T.font.size.xxs, color: T.color.fg.muted, fontFamily: T.font.mono, background: T.color.bg.raised, padding: "2px 8px", borderRadius: T.radius.sm }}>v0.2.0</span>
        </div>
        <div style={{ display: "flex", gap: 4, fontSize: T.font.size.xxs, fontFamily: T.font.mono, color: T.color.fg.muted }}>
          {["PAFV", "LATCH", "GRAPH"].map(l => (
            <span key={l} style={{ padding: "2px 8px", borderRadius: T.radius.sm, background: T.color.bg.raised, border: `1px solid ${T.color.border.subtle}` }}>{l}</span>
          ))}
        </div>
      </header>

      {/* ── Tier overview strip ── */}
      <div style={{ display: "flex", gap: T.space.lg, padding: `${T.space.md}px ${T.space.xxl}px`, background: T.color.bg.sunken, borderBottom: `1px solid ${T.color.border.subtle}`, flexShrink: 0 }}>
        {[
          { t: "1", n: "Tokens", c: T.color.status.doing },
          { t: "2", n: "Primitives", c: T.color.status.review },
          { t: "3", n: "Compositions", c: T.color.status.done },
        ].map(tier => (
          <div key={tier.t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 18, height: 18, borderRadius: T.radius.sm, background: `${tier.c}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: T.font.size.xxs, fontFamily: T.font.mono, color: tier.c, fontWeight: T.font.weight.bold, border: `1px solid ${tier.c}40` }}>{tier.t}</span>
            <span style={{ fontSize: T.font.size.xs, color: T.color.fg.secondary }}>{tier.n}</span>
          </div>
        ))}
        <span style={{ marginLeft: "auto", fontSize: T.font.size.xxs, color: T.color.fg.muted, fontStyle: "italic" }}>
          {NODES.length} cards — same data, 4 compositions
        </span>
      </div>

      {/* ── Body ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Sidebar ── */}
        <aside style={{
          width: 260, flexShrink: 0, background: T.color.bg.sunken,
          borderRight: `1px solid ${T.color.border.subtle}`,
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* View switcher */}
          <div style={{ padding: T.space.md, display: "flex", flexDirection: "column", gap: 2 }}>
            {VIEWS.map(v => (
              <button key={v.id} onClick={() => setView(v.id)} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: `${T.space.sm}px ${T.space.md}px`,
                background: view === v.id ? `${T.color.fg.accent}18` : "transparent",
                border: view === v.id ? `1px solid ${T.color.fg.accent}40` : "1px solid transparent",
                borderRadius: T.radius.md, cursor: "pointer",
                color: view === v.id ? T.color.fg.accent : T.color.fg.secondary,
                fontSize: T.font.size.sm, fontWeight: view === v.id ? T.font.weight.semi : T.font.weight.normal,
                transition: `all ${T.transition.fast}`, textAlign: "left",
              }}>
                <span style={{ fontSize: T.font.size.lg, opacity: 0.7 }}>{v.icon}</span>
                <span>{v.label}</span>
              </button>
            ))}
          </div>

          <div style={{ borderTop: `1px solid ${T.color.border.subtle}`, margin: `0 ${T.space.md}px` }} />

          {/* Controls */}
          <div style={{ flex: 1, overflowY: "auto", padding: T.space.md }}>
            <div style={{ fontSize: T.font.size.xxs, fontFamily: T.font.mono, color: T.color.fg.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: T.space.md }}>
              Tier 2 Primitives: {activeInfo.label}
            </div>
            <ViewControls view={view} gridCfg={gridCfg} setGridCfg={setGridCfg} kanbanCfg={kanbanCfg} setKanbanCfg={setKanbanCfg} timelineCfg={timelineCfg} setTimelineCfg={setTimelineCfg} galleryCfg={galleryCfg} setGalleryCfg={setGalleryCfg} />
          </div>

          {/* CSS export button */}
          <div style={{ padding: T.space.md, borderTop: `1px solid ${T.color.border.subtle}` }}>
            <button onClick={() => setShowCSS(!showCSS)} style={{
              width: "100%", padding: `${T.space.sm}px`,
              background: showCSS ? T.color.fg.accent : T.color.bg.raised,
              color: showCSS ? "#fff" : T.color.fg.secondary,
              border: `1px solid ${showCSS ? T.color.fg.accent : T.color.border.default}`,
              borderRadius: T.radius.md, fontSize: T.font.size.xs, fontFamily: T.font.mono, cursor: "pointer",
            }}>
              {showCSS ? "▼ CSS Export" : "▶ CSS Export"}
            </button>
          </div>
        </aside>

        {/* ── Main view ── */}
        <main style={{ flex: 1, overflow: "auto", padding: T.space.xl, display: "flex", flexDirection: "column", gap: T.space.xl }}>
          {/* View label */}
          <div style={{ display: "flex", alignItems: "center", gap: T.space.md, flexShrink: 0 }}>
            <span style={{ fontSize: T.font.size.lg, fontWeight: T.font.weight.bold }}>{activeInfo.icon} {activeInfo.label}</span>
            <span style={{ fontSize: T.font.size.xxs, fontFamily: T.font.mono, color: T.color.fg.muted, background: T.color.bg.raised, padding: "2px 8px", borderRadius: T.radius.sm }}>
              LATCH: {activeInfo.latch}
            </span>
          </div>

          {/* Live view */}
          {view === "supergrid" && <SuperGridView config={gridCfg} />}
          {view === "kanban" && <KanbanView config={kanbanCfg} />}
          {view === "timeline" && <TimelineView config={timelineCfg} />}
          {view === "gallery" && <GalleryView config={galleryCfg} />}

          {/* CSS Export panel */}
          {showCSS && <CSSExport gridCfg={gridCfg} kanbanCfg={kanbanCfg} timelineCfg={timelineCfg} galleryCfg={galleryCfg} />}
        </main>
      </div>
    </div>
  );
}
