# V4 Spec Addition: Design Philosophy & Component Library

*Add this to Section 4 (Control Plane) after the component architecture, or as a new Section 4.5*

---

## 4.X Design Philosophy: The NeXTSTEP Lineage

CardBoard's architecture draws from two revolutionary NeXTSTEP-era applications that anticipated modern computing by decades:

### Lotus Improv → PAFV Architecture

Improv (1991) recognized that **spreadsheets fatally conflate data with presentation**. Its solution—separating the data cube from its projections—directly informs CardBoard's PAFV model:

| Improv Concept | CardBoard Equivalent |
|----------------|---------------------|
| Data cube (multidimensional) | SQLite LPG (nodes + edges) |
| Categories (named dimensions) | LATCH axes |
| Views (projections of the cube) | Polymorphic views (Grid, Kanban, Network, Timeline) |
| Formulas on names, not cell addresses | HyperFormula on semantic references |

Improv failed commercially because users couldn't see "the cell"—the atomic unit was invisible. CardBoard solves this: **Cards are visible, tangible, draggable atoms** that exist independent of any particular view projection.

### Interface Builder → Designer Workbench

Interface Builder (1988) pioneered **direct manipulation of live objects**—not drawing pictures of interfaces, but instantiating real objects and wiring them visually. The Designer Workbench inherits this philosophy:

| Interface Builder | Designer Workbench |
|-------------------|-------------------|
| Objects are live, not mockups | Cards and Canvases are persisted entities |
| Visual arrangement is the specification | Layout is data, stored in SQLite |
| Property inspector for configuration | LATCH facet editor |
| Outlets/Actions for wiring | Edge connections between Cards |
| NIB files as serialization | Canvas bundles as JSON + SQLite |

The meta-level insight: **CardBoard builds CardBoard**. The Designer Workbench is itself a CardBoard app, creating CardBoard apps.

### Kanban as State-Space Navigation

Kanban boards add what neither Improv nor Interface Builder possessed: **state as spatial position**. Dragging a card from "Backlog" to "In Progress" is simultaneously:

- A data mutation (status field update in SQLite)
- A visual transformation (column membership change)  
- A workflow event (state machine transition)
- An edge creation (sequence relationship to prior card)

This unification—where manipulation IS specification IS data—is the core CardBoard insight.

---

## 4.Y Component Library: shadcn/ui

### Why shadcn/ui

The Control Plane requires **Interface Builder-quality primitives** to build a tool that builds tools. After evaluating React component libraries, shadcn/ui emerges as the clear choice:

| Criterion | shadcn/ui Approach |
|-----------|-------------------|
| **Ownership** | Copy-paste, not npm dependency—code is yours |
| **Foundation** | Radix primitives (accessibility) + Tailwind (styling) |
| **Customization** | Full control for NeXTSTEP aesthetic |
| **D3 compatibility** | No global styles, no conflicts with SVG layer |
| **Iteration speed** | CLI to add components, modify freely |

### The Key Insight

shadcn/ui isn't a component library you *install*—it's a collection of well-crafted components you *copy into your project*. This means:

- No breaking changes from upstream versions
- Modify anything without forking
- Natural tree-shaking (only what you use)
- Components become *your* code

### Component Adoption Strategy

```bash
# Initialize shadcn/ui in CardBoard
npx shadcn@latest init

# Core control plane components
npx shadcn@latest add button dialog command tabs dropdown-menu context-menu

# Data display
npx shadcn@latest add table card badge avatar

# Forms (for Card editor, LATCH configuration)
npx shadcn@latest add input select checkbox radio-group slider

# Feedback
npx shadcn@latest add toast alert progress skeleton
```

### NeXTSTEP Theming

Override `globals.css` to achieve the classic NeXT aesthetic:

```css
:root {
  /* NeXTSTEP grayscale palette */
  --background: 0 0% 85%;           /* Light gray background */
  --foreground: 0 0% 10%;           /* Near-black text */
  --card: 0 0% 90%;                 /* Slightly lighter cards */
  --card-foreground: 0 0% 10%;
  --primary: 0 0% 20%;              /* Dark gray for primary actions */
  --primary-foreground: 0 0% 95%;
  --secondary: 0 0% 75%;            /* Mid-gray for secondary */
  --muted: 0 0% 70%;
  --border: 0 0% 60%;               /* Visible borders */
  
  /* NeXT-style bevels */
  --shadow-raised: inset -1px -1px 0 rgba(0,0,0,0.3), 
                   inset 1px 1px 0 rgba(255,255,255,0.5);
  --shadow-sunken: inset 1px 1px 0 rgba(0,0,0,0.3), 
                   inset -1px -1px 0 rgba(255,255,255,0.3);
  
  /* System font stack */
  --font-sans: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
  --font-mono: "SF Mono", Monaco, "Courier New", monospace;
  
  /* Tighter radius for NeXT look */
  --radius: 2px;
}
```

### Component-to-Feature Mapping

| CardBoard Feature | shadcn/ui Components |
|-------------------|---------------------|
| Command Palette (⌘K) | `Command`, `Dialog` |
| View Switcher | `Tabs`, `DropdownMenu` |
| LATCH Axis Configurator | `Select`, `ContextMenu`, `Popover` |
| Card Editor | `Dialog`, `Input`, `Textarea`, `Select` |
| Filter Pills | `Badge`, `Button` |
| Notebook Shell | `Card`, `Input`, `ScrollArea` |
| Designer Palette | `Accordion`, `Card`, `Badge` |
| Toast Notifications | `Toast`, `Sonner` |

---

## 4.Z Integration: React Control Plane + D3 Data Plane

shadcn/ui components live in the **z: 100+** React layer. They never touch D3's **z: 0-99** visualization floor. The interface contract:

```typescript
// React controls dispatch state changes
const handleAxisChange = (plane: 'x' | 'y', binding: FacetBinding) => {
  // Update ViewState (React state / Zustand / context)
  setViewState(prev => ({
    ...prev,
    pafv: { ...prev.pafv, [`${plane}Axis`]: binding }
  }));
};

// D3 floor receives state as props, renders visualization
<D3SuperGrid 
  nodes={nodes}
  edges={edges}
  pafv={viewState.pafv}
  onNodeClick={handleNodeClick}
  onSelectionChange={handleSelectionChange}
/>

// shadcn/ui controls float above, manipulate state
<AxisConfigurator 
  axis={viewState.pafv.xAxis}
  onChange={(binding) => handleAxisChange('x', binding)}
/>
```

**D3 shows the truth. React lets you change it.**
