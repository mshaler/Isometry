import { useState, useRef, useEffect } from "react";

// ============================================================================
// @isometry/primitives — Owned CSS Primitive System
// Tier 1: Design Tokens | Tier 2: Layout Primitives | Tier 3: View Compositions
// ============================================================================

// Tier 1 tokens as JS object (in production these become CSS custom properties)
const TOKENS = {
  // Spacing scale (4px base)
  space: { xs: 2, sm: 4, md: 8, lg: 12, xl: 16, xxl: 24, xxxl: 32 },
  // NeXTSTEP-inspired palette
  color: {
    bg: { base: "#2a2a2e", raised: "#3a3a3e", sunken: "#1e1e22", glass: "rgba(58,58,62,0.85)" },
    fg: { primary: "#e8e8ec", secondary: "#a8a8b0", muted: "#6e6e78", accent: "#4da6ff" },
    border: { subtle: "rgba(255,255,255,0.06)", default: "rgba(255,255,255,0.12)", strong: "rgba(255,255,255,0.22)", accent: "#4da6ff" },
    semantic: { info: "#4da6ff", success: "#4caf50", warning: "#ff9800", danger: "#ef5350" },
    header: { column: "#1a2744", row: "#2a1a3a", cell: "#2e2e32" },
    status: { todo: "#6e6e78", doing: "#4da6ff", review: "#ff9800", done: "#4caf50" },
  },
  radius: { sm: 3, md: 6, lg: 8, xl: 12 },
  shadow: {
    inset: "inset 0 1px 2px rgba(0,0,0,0.3)",
    raised: "0 2px 8px rgba(0,0,0,0.4)",
    deep: "0 4px 16px rgba(0,0,0,0.5)",
  },
  font: {
    mono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
    sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    size: { xs: 10, sm: 11, md: 13, lg: 15, xl: 18, xxl: 24 },
    weight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  },
  transition: { fast: "120ms ease", normal: "200ms ease", slow: "350ms ease-out" },
};

// Tier 2 Layout Primitives (configurable per-view)
const LAYOUT_PRIMITIVES = {
  supergrid: {
    headerDepth: { column: 2, row: 2 },
    headerHeight: { column: 32, row: 28 },
    headerMinWidth: { column: 80, row: 120 },
    cellMinWidth: 140,
    cellMinHeight: 100,
    cellPadding: TOKENS.space.md,
    cellGap: 1,
    gutterWidth: 1,
    stickyHeaders: true,
    cornerWidth: 120,
    cornerHeight: 64,
  },
  kanban: {
    columnMinWidth: 260,
    columnMaxWidth: 340,
    columnGap: TOKENS.space.lg,
    columnHeaderHeight: 44,
    cardHeight: "auto",
    cardGap: TOKENS.space.sm,
    cardPadding: TOKENS.space.lg,
    columnPadding: TOKENS.space.md,
    showColumnCount: true,
    maxCardsVisible: 20,
  },
};

// ============================================================================
// MOCK DATA (simulating SQLite → D3 pipeline)
// ============================================================================
const MOCK_NODES = [
  { id: "1", name: "Design SuperGrid headers", status: "doing", folder: "Isometry", priority: 3, tags: ["UI"], due: "Feb 18" },
  { id: "2", name: "Implement CSS primitives", status: "todo", folder: "Isometry", priority: 2, tags: ["Architecture"], due: "Feb 20" },
  { id: "3", name: "CloudKit sync testing", status: "review", folder: "Isometry", priority: 1, tags: ["Backend"], due: "Feb 22" },
  { id: "4", name: "FTS5 search optimization", status: "done", folder: "Isometry", priority: 2, tags: ["Backend"], due: "Feb 15" },
  { id: "5", name: "D3 force simulation tuning", status: "doing", folder: "Isometry", priority: 3, tags: ["UI"], due: "Feb 19" },
  { id: "6", name: "Write unit tests for edges", status: "todo", folder: "Isometry", priority: 1, tags: ["Testing"], due: "Feb 21" },
  { id: "7", name: "Refactor LATCH navigator", status: "todo", folder: "Isometry", priority: 2, tags: ["Architecture"], due: "Feb 23" },
  { id: "8", name: "Build Kanban drag-drop", status: "doing", folder: "Isometry", priority: 3, tags: ["UI"], due: "Feb 17" },
  { id: "9", name: "SQLite migration v2", status: "done", folder: "Isometry", priority: 1, tags: ["Backend"], due: "Feb 10" },
  { id: "10", name: "Performance benchmarks", status: "review", folder: "Isometry", priority: 2, tags: ["Testing"], due: "Feb 24" },
  { id: "11", name: "GRAPH CTE optimization", status: "todo", folder: "Isometry", priority: 3, tags: ["Backend"], due: "Feb 25" },
  { id: "12", name: "Card renderer polish", status: "done", folder: "Isometry", priority: 1, tags: ["UI"], due: "Feb 12" },
];

const STATUS_ORDER = ["todo", "doing", "review", "done"];
const STATUS_LABELS = { todo: "To Do", doing: "In Progress", review: "Review", done: "Done" };
const TAG_GROUPS = ["UI", "Architecture", "Backend", "Testing"];

// ============================================================================
// TIER 3: VIEW COMPOSITIONS
// ============================================================================

// --- SuperGrid Composition ---
function SuperGridView({ config, tokens }) {
  const c = { ...LAYOUT_PRIMITIVES.supergrid, ...config };
  const t = tokens;

  // LATCH: Group by tags (rows) × status (columns)
  const colHeaders = STATUS_ORDER;
  const rowHeaders = TAG_GROUPS;

  // Build cell data: row × col → cards
  const cellData = {};
  rowHeaders.forEach(row => {
    colHeaders.forEach(col => {
      const key = `${row}:${col}`;
      cellData[key] = MOCK_NODES.filter(n => n.tags.includes(row) && n.status === col);
    });
  });

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `${c.cornerWidth}px repeat(${colHeaders.length}, minmax(${c.cellMinWidth}px, 1fr))`,
      gridTemplateRows: `${c.cornerHeight}px repeat(${rowHeaders.length}, minmax(${c.cellMinHeight}px, auto))`,
      gap: `${c.cellGap}px`,
      background: t.color.border.subtle,
      borderRadius: t.radius.lg,
      overflow: "hidden",
      fontFamily: t.font.sans,
      fontSize: t.font.size.sm,
    }}>
      {/* Corner cell */}
      <div style={{
        background: t.color.bg.sunken,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "flex-end",
        padding: `${t.space.sm}px ${t.space.md}px`,
        color: t.color.fg.muted,
        fontSize: t.font.size.xs,
        fontFamily: t.font.mono,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
      }}>
        <span style={{ opacity: 0.6 }}>Tags × Status</span>
      </div>

      {/* Column headers */}
      {colHeaders.map((col, i) => (
        <div key={`ch-${col}`} style={{
          background: t.color.header.column,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: `${t.space.sm}px ${t.space.md}px`,
          color: t.color.fg.primary,
          fontWeight: t.font.weight.semibold,
          fontSize: t.font.size.md,
          letterSpacing: "0.02em",
          position: "relative",
        }}>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: t.color.status[col],
              boxShadow: `0 0 6px ${t.color.status[col]}60`,
            }} />
            {STATUS_LABELS[col]}
          </span>
          <span style={{
            position: "absolute", right: 8, top: 6,
            fontSize: t.font.size.xs, color: t.color.fg.muted,
            fontFamily: t.font.mono,
          }}>
            {MOCK_NODES.filter(n => n.status === col).length}
          </span>
        </div>
      ))}

      {/* Row headers + data cells */}
      {rowHeaders.map((row, ri) => (
        <>
          {/* Row header */}
          <div key={`rh-${row}`} style={{
            background: t.color.header.row,
            display: "flex",
            alignItems: "center",
            padding: `${t.space.md}px ${t.space.lg}px`,
            color: t.color.fg.primary,
            fontWeight: t.font.weight.medium,
            fontSize: t.font.size.md,
            borderRight: `2px solid ${t.color.border.subtle}`,
            position: "relative",
          }}>
            {row}
            <span style={{
              position: "absolute", right: 8, bottom: 4,
              fontSize: t.font.size.xs, color: t.color.fg.muted,
              fontFamily: t.font.mono,
            }}>
              {MOCK_NODES.filter(n => n.tags.includes(row)).length}
            </span>
          </div>

          {/* Data cells */}
          {colHeaders.map((col, ci) => {
            const cards = cellData[`${row}:${col}`];
            return (
              <div key={`cell-${row}-${col}`} style={{
                background: t.color.bg.base,
                padding: c.cellPadding,
                display: "flex",
                flexDirection: "column",
                gap: t.space.xs,
                minHeight: c.cellMinHeight,
                transition: `background ${t.transition.fast}`,
              }}
              onMouseEnter={e => e.currentTarget.style.background = t.color.bg.raised}
              onMouseLeave={e => e.currentTarget.style.background = t.color.bg.base}
              >
                {cards.length === 0 ? (
                  <span style={{ color: t.color.fg.muted, fontSize: t.font.size.xs, fontStyle: "italic", opacity: 0.5, margin: "auto" }}>—</span>
                ) : cards.map(card => (
                  <MiniCard key={card.id} card={card} tokens={t} />
                ))}
              </div>
            );
          })}
        </>
      ))}
    </div>
  );
}

// --- Kanban Composition ---
function KanbanView({ config, tokens }) {
  const c = { ...LAYOUT_PRIMITIVES.kanban, ...config };
  const t = tokens;

  // LATCH: Group by status (single axis)
  const columns = STATUS_ORDER.map(status => ({
    id: status,
    label: STATUS_LABELS[status],
    cards: MOCK_NODES.filter(n => n.status === status),
  }));

  return (
    <div style={{
      display: "flex",
      gap: c.columnGap,
      padding: t.space.lg,
      overflowX: "auto",
      fontFamily: t.font.sans,
    }}>
      {columns.map(col => (
        <div key={col.id} style={{
          minWidth: c.columnMinWidth,
          maxWidth: c.columnMaxWidth,
          flex: `0 0 ${c.columnMinWidth}px`,
          display: "flex",
          flexDirection: "column",
          background: t.color.bg.sunken,
          borderRadius: t.radius.lg,
          overflow: "hidden",
        }}>
          {/* Column header */}
          <div style={{
            height: c.columnHeaderHeight,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `0 ${c.columnPadding}px`,
            background: t.color.bg.raised,
            borderBottom: `1px solid ${t.color.border.subtle}`,
          }}>
            <span style={{
              display: "flex", alignItems: "center", gap: 8,
              color: t.color.fg.primary, fontWeight: t.font.weight.semibold,
              fontSize: t.font.size.md,
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: "50%",
                background: t.color.status[col.id],
                boxShadow: `0 0 8px ${t.color.status[col.id]}50`,
              }} />
              {col.label}
            </span>
            {c.showColumnCount && (
              <span style={{
                background: t.color.bg.base,
                color: t.color.fg.muted,
                fontSize: t.font.size.xs,
                fontFamily: t.font.mono,
                padding: "2px 8px",
                borderRadius: t.radius.sm,
                fontWeight: t.font.weight.medium,
              }}>
                {col.cards.length}
              </span>
            )}
          </div>

          {/* Cards stack */}
          <div style={{
            padding: c.columnPadding,
            display: "flex",
            flexDirection: "column",
            gap: c.cardGap,
            flex: 1,
            minHeight: 120,
          }}>
            {col.cards.map(card => (
              <KanbanCard key={card.id} card={card} tokens={t} config={c} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// SHARED CARD PRIMITIVES (Tier 2)
// ============================================================================

function MiniCard({ card, tokens: t }) {
  return (
    <div style={{
      background: t.color.bg.raised,
      borderRadius: t.radius.sm,
      padding: `${t.space.xs}px ${t.space.sm}px`,
      display: "flex",
      alignItems: "center",
      gap: t.space.sm,
      cursor: "pointer",
      transition: `all ${t.transition.fast}`,
      borderLeft: `3px solid ${t.color.status[card.status]}`,
      fontSize: t.font.size.sm,
      color: t.color.fg.primary,
      lineHeight: 1.3,
    }}
    onMouseEnter={e => {
      e.currentTarget.style.background = t.color.bg.glass;
      e.currentTarget.style.transform = "translateX(2px)";
    }}
    onMouseLeave={e => {
      e.currentTarget.style.background = t.color.bg.raised;
      e.currentTarget.style.transform = "translateX(0)";
    }}
    >
      <PriorityDot priority={card.priority} tokens={t} />
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {card.name}
      </span>
    </div>
  );
}

function KanbanCard({ card, tokens: t, config: c }) {
  return (
    <div style={{
      background: t.color.bg.raised,
      borderRadius: t.radius.md,
      padding: c.cardPadding,
      display: "flex",
      flexDirection: "column",
      gap: t.space.sm,
      cursor: "grab",
      transition: `all ${t.transition.normal}`,
      border: `1px solid ${t.color.border.subtle}`,
      boxShadow: t.shadow.raised,
    }}
    onMouseEnter={e => {
      e.currentTarget.style.borderColor = t.color.border.accent;
      e.currentTarget.style.boxShadow = t.shadow.deep;
      e.currentTarget.style.transform = "translateY(-2px)";
    }}
    onMouseLeave={e => {
      e.currentTarget.style.borderColor = t.color.border.subtle;
      e.currentTarget.style.boxShadow = t.shadow.raised;
      e.currentTarget.style.transform = "translateY(0)";
    }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: t.space.sm,
        fontSize: t.font.size.md, color: t.color.fg.primary,
        fontWeight: t.font.weight.medium, lineHeight: 1.4,
      }}>
        <PriorityDot priority={card.priority} tokens={t} size={8} />
        {card.name}
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: t.space.md,
        fontSize: t.font.size.xs, color: t.color.fg.muted,
      }}>
        {card.tags.map(tag => (
          <span key={tag} style={{
            background: t.color.bg.base,
            padding: "1px 6px",
            borderRadius: t.radius.sm,
            fontFamily: t.font.mono,
            letterSpacing: "0.03em",
          }}>{tag}</span>
        ))}
        <span style={{ marginLeft: "auto", fontFamily: t.font.mono }}>{card.due}</span>
      </div>
    </div>
  );
}

function PriorityDot({ priority, tokens: t, size = 6 }) {
  const colors = { 3: t.color.semantic.danger, 2: t.color.semantic.warning, 1: t.color.semantic.info };
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: colors[priority] || t.color.fg.muted,
      boxShadow: `0 0 4px ${(colors[priority] || t.color.fg.muted)}40`,
    }} />
  );
}

// ============================================================================
// TOKEN EDITOR (for interactive exploration)
// ============================================================================

function TokenSlider({ label, value, min, max, step = 1, onChange, unit = "px", mono = false }) {
  const t = TOKENS;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: t.font.size.sm }}>
      <span style={{
        color: t.color.fg.secondary, width: 130, flexShrink: 0,
        fontFamily: mono ? t.font.mono : t.font.sans,
        fontSize: t.font.size.xs,
      }}>{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: t.color.fg.accent, height: 4, cursor: "pointer" }}
      />
      <span style={{
        color: t.color.fg.accent, fontFamily: t.font.mono,
        fontSize: t.font.size.xs, width: 48, textAlign: "right",
      }}>
        {value}{unit}
      </span>
    </div>
  );
}

function TokenToggle({ label, value, onChange }) {
  const t = TOKENS;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: TOKENS.font.size.sm }}>
      <span style={{ color: t.color.fg.secondary, width: 130, flexShrink: 0, fontSize: t.font.size.xs }}>{label}</span>
      <button onClick={() => onChange(!value)} style={{
        background: value ? t.color.fg.accent : t.color.bg.sunken,
        border: `1px solid ${value ? t.color.fg.accent : t.color.border.default}`,
        borderRadius: 10, width: 36, height: 20, cursor: "pointer",
        position: "relative", transition: `all ${t.transition.fast}`,
      }}>
        <span style={{
          position: "absolute", top: 2, left: value ? 18 : 2,
          width: 14, height: 14, borderRadius: "50%",
          background: "#fff", transition: `left ${t.transition.fast}`,
          boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
        }} />
      </button>
    </div>
  );
}

// ============================================================================
// CSS CUSTOM PROPERTIES EXPORT PANEL
// ============================================================================

function CSSExportPanel({ gridConfig, kanbanConfig }) {
  const t = TOKENS;
  const [copied, setCopied] = useState(false);
  
  const cssText = `:root {
  /* === Tier 1: Design Tokens === */
  --iso-space-xs: ${t.space.xs}px;
  --iso-space-sm: ${t.space.sm}px;
  --iso-space-md: ${t.space.md}px;
  --iso-space-lg: ${t.space.lg}px;
  --iso-space-xl: ${t.space.xl}px;
  
  --iso-bg-base: ${t.color.bg.base};
  --iso-bg-raised: ${t.color.bg.raised};
  --iso-bg-sunken: ${t.color.bg.sunken};
  --iso-fg-primary: ${t.color.fg.primary};
  --iso-fg-secondary: ${t.color.fg.secondary};
  --iso-fg-accent: ${t.color.fg.accent};
  --iso-border-subtle: ${t.color.border.subtle};
  --iso-border-default: ${t.color.border.default};
  
  --iso-radius-sm: ${t.radius.sm}px;
  --iso-radius-md: ${t.radius.md}px;
  --iso-radius-lg: ${t.radius.lg}px;
  
  --iso-font-sans: ${t.font.sans};
  --iso-font-mono: ${t.font.mono};
  
  /* === Tier 2: SuperGrid Primitives === */
  --iso-grid-corner-w: ${gridConfig.cornerWidth}px;
  --iso-grid-corner-h: ${gridConfig.cornerHeight}px;
  --iso-grid-cell-min-w: ${gridConfig.cellMinWidth}px;
  --iso-grid-cell-min-h: ${gridConfig.cellMinHeight}px;
  --iso-grid-cell-pad: ${gridConfig.cellPadding}px;
  --iso-grid-cell-gap: ${gridConfig.cellGap}px;
  --iso-grid-header-col-bg: ${t.color.header.column};
  --iso-grid-header-row-bg: ${t.color.header.row};
  
  /* === Tier 2: Kanban Primitives === */
  --iso-kanban-col-min-w: ${kanbanConfig.columnMinWidth}px;
  --iso-kanban-col-max-w: ${kanbanConfig.columnMaxWidth}px;
  --iso-kanban-col-gap: ${kanbanConfig.columnGap}px;
  --iso-kanban-col-header-h: ${kanbanConfig.columnHeaderHeight}px;
  --iso-kanban-card-gap: ${kanbanConfig.cardGap}px;
  --iso-kanban-card-pad: ${kanbanConfig.cardPadding}px;
}`;

  return (
    <div style={{
      background: t.color.bg.sunken,
      borderRadius: t.radius.lg,
      overflow: "hidden",
      border: `1px solid ${t.color.border.subtle}`,
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: `${t.space.md}px ${t.space.lg}px`,
        background: t.color.bg.raised,
        borderBottom: `1px solid ${t.color.border.subtle}`,
      }}>
        <span style={{
          color: t.color.fg.secondary, fontSize: t.font.size.xs,
          fontFamily: t.font.mono, textTransform: "uppercase", letterSpacing: "0.08em",
        }}>
          Generated CSS Custom Properties
        </span>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(cssText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          style={{
            background: copied ? t.color.semantic.success : t.color.fg.accent,
            color: "#fff", border: "none", borderRadius: t.radius.sm,
            padding: "4px 12px", fontSize: t.font.size.xs,
            fontFamily: t.font.mono, cursor: "pointer",
            transition: `background ${t.transition.fast}`,
          }}
        >
          {copied ? "✓ Copied" : "Copy CSS"}
        </button>
      </div>
      <pre style={{
        margin: 0, padding: t.space.lg,
        color: t.color.fg.secondary, fontSize: t.font.size.xs,
        fontFamily: t.font.mono, lineHeight: 1.6,
        overflowX: "auto", maxHeight: 260,
      }}>
        {cssText}
      </pre>
    </div>
  );
}

// ============================================================================
// MAIN APP
// ============================================================================

export default function IsometryPrimitives() {
  const t = TOKENS;

  // Active view
  const [activeView, setActiveView] = useState("supergrid");

  // Editable Tier 2 configs
  const [gridConfig, setGridConfig] = useState({ ...LAYOUT_PRIMITIVES.supergrid });
  const [kanbanConfig, setKanbanConfig] = useState({ ...LAYOUT_PRIMITIVES.kanban });
  const [showCSS, setShowCSS] = useState(false);

  const updateGrid = (key, val) => setGridConfig(prev => ({ ...prev, [key]: val }));
  const updateKanban = (key, val) => setKanbanConfig(prev => ({ ...prev, [key]: val }));

  return (
    <div style={{
      minHeight: "100vh",
      background: t.color.bg.base,
      color: t.color.fg.primary,
      fontFamily: t.font.sans,
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <header style={{
        padding: `${t.space.lg}px ${t.space.xxl}px`,
        borderBottom: `1px solid ${t.color.border.subtle}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: t.color.bg.sunken,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{
            fontSize: t.font.size.xl,
            fontWeight: t.font.weight.bold,
            letterSpacing: "-0.02em",
          }}>
            <span style={{ color: t.color.fg.accent }}>@isometry</span>
            <span style={{ color: t.color.fg.muted }}>/primitives</span>
          </span>
          <span style={{
            fontSize: t.font.size.xs,
            color: t.color.fg.muted,
            fontFamily: t.font.mono,
            background: t.color.bg.raised,
            padding: "2px 8px",
            borderRadius: t.radius.sm,
          }}>v0.1.0</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Architecture badge */}
          <div style={{
            display: "flex", gap: 6,
            fontSize: t.font.size.xs, fontFamily: t.font.mono,
            color: t.color.fg.muted,
          }}>
            {["PAFV", "LATCH", "GRAPH"].map(layer => (
              <span key={layer} style={{
                padding: "2px 8px",
                borderRadius: t.radius.sm,
                background: t.color.bg.raised,
                border: `1px solid ${t.color.border.subtle}`,
              }}>{layer}</span>
            ))}
          </div>
        </div>
      </header>

      {/* Architecture diagram */}
      <div style={{
        padding: `${t.space.lg}px ${t.space.xxl}px`,
        background: t.color.bg.sunken,
        borderBottom: `1px solid ${t.color.border.subtle}`,
        display: "flex",
        gap: t.space.xxl,
        alignItems: "stretch",
      }}>
        {[
          { tier: "Tier 1", name: "Design Tokens", desc: "Colors, spacing, type, radius", color: t.color.semantic.info, items: ["--iso-space-*", "--iso-bg-*", "--iso-fg-*", "--iso-font-*"] },
          { tier: "Tier 2", name: "Layout Primitives", desc: "Configurable per-view parameters", color: t.color.semantic.warning, items: ["--iso-grid-cell-*", "--iso-kanban-col-*", "--iso-header-*"] },
          { tier: "Tier 3", name: "View Compositions", desc: "SuperGrid, Kanban, Timeline...", color: t.color.semantic.success, items: ["Assembles Tier 2", "PAFV axis mapping", "Polymorphic switch"] },
        ].map((tier, i) => (
          <div key={tier.tier} style={{
            flex: 1, padding: t.space.lg,
            background: t.color.bg.base,
            borderRadius: t.radius.md,
            border: `1px solid ${t.color.border.subtle}`,
            borderTop: `3px solid ${tier.color}`,
            display: "flex", flexDirection: "column", gap: t.space.sm,
          }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{
                fontSize: t.font.size.xs, fontFamily: t.font.mono,
                color: tier.color, fontWeight: t.font.weight.bold,
              }}>{tier.tier}</span>
              <span style={{ fontSize: t.font.size.md, fontWeight: t.font.weight.semibold }}>{tier.name}</span>
            </div>
            <span style={{ fontSize: t.font.size.xs, color: t.color.fg.muted }}>{tier.desc}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
              {tier.items.map(item => (
                <span key={item} style={{
                  fontSize: t.font.size.xs, fontFamily: t.font.mono,
                  color: t.color.fg.secondary, opacity: 0.7,
                }}>{item}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar: Tier 2 Controls */}
        <aside style={{
          width: 300, flexShrink: 0,
          background: t.color.bg.sunken,
          borderRight: `1px solid ${t.color.border.subtle}`,
          overflowY: "auto",
          padding: `${t.space.lg}px`,
          display: "flex",
          flexDirection: "column",
          gap: t.space.lg,
        }}>
          {/* View switcher */}
          <div style={{
            display: "flex", gap: 2,
            background: t.color.bg.base,
            borderRadius: t.radius.md,
            padding: 2,
          }}>
            {[
              { id: "supergrid", label: "SuperGrid" },
              { id: "kanban", label: "Kanban" },
            ].map(v => (
              <button key={v.id}
                onClick={() => setActiveView(v.id)}
                style={{
                  flex: 1, padding: `${t.space.sm}px 0`,
                  background: activeView === v.id ? t.color.fg.accent : "transparent",
                  color: activeView === v.id ? "#fff" : t.color.fg.secondary,
                  border: "none", borderRadius: t.radius.sm,
                  fontSize: t.font.size.sm, fontWeight: t.font.weight.medium,
                  cursor: "pointer", transition: `all ${t.transition.fast}`,
                }}
              >{v.label}</button>
            ))}
          </div>

          {/* Section label */}
          <div style={{
            fontSize: t.font.size.xs, fontFamily: t.font.mono,
            color: t.color.fg.muted, textTransform: "uppercase",
            letterSpacing: "0.1em",
            borderBottom: `1px solid ${t.color.border.subtle}`,
            paddingBottom: t.space.sm,
          }}>
            Tier 2: Layout Primitives
          </div>

          {activeView === "supergrid" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: t.space.md }}>
              <TokenSlider label="Corner Width" value={gridConfig.cornerWidth} min={60} max={200} onChange={v => updateGrid("cornerWidth", v)} mono />
              <TokenSlider label="Corner Height" value={gridConfig.cornerHeight} min={32} max={100} onChange={v => updateGrid("cornerHeight", v)} mono />
              <TokenSlider label="Cell Min Width" value={gridConfig.cellMinWidth} min={80} max={300} onChange={v => updateGrid("cellMinWidth", v)} mono />
              <TokenSlider label="Cell Min Height" value={gridConfig.cellMinHeight} min={40} max={200} onChange={v => updateGrid("cellMinHeight", v)} mono />
              <TokenSlider label="Cell Padding" value={gridConfig.cellPadding} min={0} max={24} onChange={v => updateGrid("cellPadding", v)} mono />
              <TokenSlider label="Cell Gap" value={gridConfig.cellGap} min={0} max={8} onChange={v => updateGrid("cellGap", v)} mono />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: t.space.md }}>
              <TokenSlider label="Col Min Width" value={kanbanConfig.columnMinWidth} min={180} max={400} onChange={v => updateKanban("columnMinWidth", v)} mono />
              <TokenSlider label="Col Max Width" value={kanbanConfig.columnMaxWidth} min={240} max={500} onChange={v => updateKanban("columnMaxWidth", v)} mono />
              <TokenSlider label="Col Gap" value={kanbanConfig.columnGap} min={0} max={32} onChange={v => updateKanban("columnGap", v)} mono />
              <TokenSlider label="Header Height" value={kanbanConfig.columnHeaderHeight} min={28} max={64} onChange={v => updateKanban("columnHeaderHeight", v)} mono />
              <TokenSlider label="Card Gap" value={kanbanConfig.cardGap} min={0} max={16} onChange={v => updateKanban("cardGap", v)} mono />
              <TokenSlider label="Card Padding" value={kanbanConfig.cardPadding} min={4} max={24} onChange={v => updateKanban("cardPadding", v)} mono />
              <TokenSlider label="Col Padding" value={kanbanConfig.columnPadding} min={4} max={24} onChange={v => updateKanban("columnPadding", v)} mono />
              <TokenToggle label="Show Count" value={kanbanConfig.showColumnCount} onChange={v => updateKanban("showColumnCount", v)} />
            </div>
          )}

          {/* CSS Export toggle */}
          <div style={{ marginTop: "auto", paddingTop: t.space.lg }}>
            <button onClick={() => setShowCSS(!showCSS)} style={{
              width: "100%", padding: `${t.space.md}px`,
              background: showCSS ? t.color.fg.accent : t.color.bg.raised,
              color: showCSS ? "#fff" : t.color.fg.secondary,
              border: `1px solid ${showCSS ? t.color.fg.accent : t.color.border.default}`,
              borderRadius: t.radius.md,
              fontSize: t.font.size.sm, fontFamily: t.font.mono,
              cursor: "pointer", transition: `all ${t.transition.fast}`,
            }}>
              {showCSS ? "▼ Hide CSS Export" : "▶ Show CSS Export"}
            </button>
          </div>
        </aside>

        {/* Main view area */}
        <main style={{
          flex: 1, overflow: "auto",
          padding: t.space.xxl,
          display: "flex",
          flexDirection: "column",
          gap: t.space.xxl,
        }}>
          {/* View label */}
          <div style={{
            display: "flex", alignItems: "center", gap: t.space.md,
          }}>
            <span style={{
              fontSize: t.font.size.lg, fontWeight: t.font.weight.bold,
            }}>
              {activeView === "supergrid" ? "SuperGrid" : "Kanban"}
            </span>
            <span style={{
              fontSize: t.font.size.xs, fontFamily: t.font.mono,
              color: t.color.fg.muted, background: t.color.bg.raised,
              padding: "2px 8px", borderRadius: t.radius.sm,
            }}>
              {activeView === "supergrid"
                ? "LATCH: Tags × Status → PAFV: rows × columns"
                : "LATCH: Status → PAFV: columns"
              }
            </span>
            <span style={{
              fontSize: t.font.size.xs, color: t.color.fg.muted,
              marginLeft: "auto", fontStyle: "italic",
            }}>
              Same 12 cards, different Tier 3 composition
            </span>
          </div>

          {/* Live view */}
          {activeView === "supergrid" ? (
            <SuperGridView config={gridConfig} tokens={t} />
          ) : (
            <KanbanView config={kanbanConfig} tokens={t} />
          )}

          {/* CSS Export */}
          {showCSS && (
            <CSSExportPanel gridConfig={gridConfig} kanbanConfig={kanbanConfig} />
          )}

          {/* Architecture note */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
            gap: t.space.lg, marginTop: t.space.lg,
          }}>
            {[
              {
                label: "SQL decides WHAT",
                code: "SELECT * FROM nodes\nWHERE tags LIKE '%UI%'\nGROUP BY status",
                desc: "LATCH separation via SQL — same query feeds both views",
              },
              {
                label: "CSS decides WHERE",
                code: "grid-template-columns:\n  var(--iso-grid-corner-w)\n  repeat(4, minmax(\n    var(--iso-grid-cell-min-w),\n    1fr));",
                desc: "Tier 2 primitives control spatial layout",
              },
              {
                label: "D3 decides HOW",
                code: "d3.select(container)\n  .selectAll('.card')\n  .data(cards, d => d.id)\n  .join('div')",
                desc: "Data binding + enter/update/exit for dynamic content",
              },
            ].map(panel => (
              <div key={panel.label} style={{
                background: t.color.bg.sunken,
                borderRadius: t.radius.md,
                padding: t.space.lg,
                border: `1px solid ${t.color.border.subtle}`,
              }}>
                <div style={{
                  fontSize: t.font.size.xs, fontFamily: t.font.mono,
                  color: t.color.fg.accent, fontWeight: t.font.weight.bold,
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  marginBottom: t.space.md,
                }}>{panel.label}</div>
                <pre style={{
                  margin: 0, padding: t.space.md,
                  background: t.color.bg.base,
                  borderRadius: t.radius.sm,
                  fontSize: t.font.size.xs,
                  fontFamily: t.font.mono,
                  color: t.color.fg.secondary,
                  lineHeight: 1.5,
                  overflowX: "auto",
                }}>{panel.code}</pre>
                <div style={{
                  marginTop: t.space.md,
                  fontSize: t.font.size.xs,
                  color: t.color.fg.muted,
                  lineHeight: 1.4,
                }}>{panel.desc}</div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
