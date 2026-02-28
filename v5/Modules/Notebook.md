# Notebook

> Three-canvas architecture for capture, preview, and presentation

## Purpose

Notebook provides a structured workflow for transforming raw captured content into polished presentations. It implements a **three-canvas system**: Capture → Preview → Present.

## Three-Canvas Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Notebook                                 │
├───────────────────┬───────────────────┬────────────────────────┤
│      CAPTURE      │      PREVIEW      │        PRESENT         │
│  (Raw Collection) │   (Arrangement)   │    (Final Output)      │
├───────────────────┼───────────────────┼────────────────────────┤
│                   │                   │                        │
│   ● Screenshot    │   [Slide 1]       │   ┌────────────────┐   │
│   ● Note          │   ├─ Image        │   │                │   │
│   ● Clipping      │   ├─ Title        │   │   Slide 1      │   │
│   ● Voice memo    │   └─ Notes        │   │                │   │
│   ● URL           │                   │   │   Presented    │   │
│   ● Card ref      │   [Slide 2]       │   │                │   │
│                   │   ├─ Cards        │   └────────────────┘   │
│   Unstructured    │   └─ Analysis     │                        │
│   Chronological   │                   │   Full-screen          │
│                   │   Structured      │   Minimal chrome       │
│                   │   Ordered         │   Keyboard nav         │
│                   │                   │                        │
└───────────────────┴───────────────────┴────────────────────────┘
```

## Canvas 1: Capture

**Purpose**: Quick, frictionless content collection

### Capture Types

| Type | Source | Storage |
|------|--------|---------|
| **Screenshot** | System screenshot, drag-drop | Binary blob |
| **Note** | Text input, voice transcription | Markdown text |
| **Clipping** | Web clipper, selection | HTML/Markdown |
| **Voice memo** | Audio recording | Audio file |
| **URL** | Bookmarklet, share sheet | URL + metadata |
| **Card reference** | Link to existing card | Card ID |

### Capture Flow

```javascript
const captureItem = {
  id: uuid(),
  type: 'screenshot',
  created_at: new Date().toISOString(),
  content: blobOrText,
  metadata: {
    source: 'macos-screenshot',
    dimensions: { width: 1920, height: 1080 }
  },
  notebook_id: currentNotebook
};

// Captures are unstructured, chronological
db.exec(`INSERT INTO captures VALUES (?, ?, ?, ?, ?)`);
```

### Capture UI

```
┌─────────────────────────────────────┐
│  Captures                    [+ ▼]  │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │ 📷 Screenshot        10:32 AM│   │
│  │    [thumbnail]               │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ 📝 Note              10:28 AM│   │
│  │    "Remember to check..."    │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ 🔗 URL               10:15 AM│   │
│  │    developer.apple.com/...   │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

## Canvas 2: Preview

**Purpose**: Organize captures into structured slides

### Preview Structure

```javascript
const slide = {
  id: uuid(),
  notebook_id: notebookId,
  position: 0, // Order in deck
  layout: 'title-content', // Layout template
  elements: [
    {
      type: 'image',
      capture_id: captureId,
      position: { x: 0, y: 0, width: 100, height: 60 }
    },
    {
      type: 'text',
      content: '# Analysis of...',
      position: { x: 0, y: 60, width: 100, height: 40 }
    }
  ]
};
```

### Layout Templates

| Layout | Description |
|--------|-------------|
| `title-only` | Large centered title |
| `title-content` | Title + body content |
| `two-column` | Side-by-side content |
| `image-full` | Full-bleed image |
| `cards-grid` | Grid of card references |
| `comparison` | Before/after or A/B |
| `blank` | Freeform placement |

### Preview Interactions

| Action | Result |
|--------|--------|
| Drag capture → slide | Add element to slide |
| Drag between slides | Reorder slides |
| Double-click element | Edit in place |
| Right-click | Element context menu |
| ⌘+D | Duplicate slide |
| Delete | Remove slide |

### D3 Slide Editor

```javascript
// Slides as D3 selection
const slideElements = d3.select('.slide-canvas')
  .selectAll('.element')
  .data(slide.elements, d => d.id)
  .join('div')
    .attr('class', d => `element element-${d.type}`)
    .style('left', d => `${d.position.x}%`)
    .style('top', d => `${d.position.y}%`)
    .call(d3.drag()
      .on('drag', updateElementPosition)
    );
```

## Canvas 3: Present

**Purpose**: Full-screen presentation delivery

### Present Mode

```javascript
function enterPresentMode(notebook, startSlide = 0) {
  document.body.requestFullscreen();

  const presenter = {
    currentSlide: startSlide,
    slides: notebook.slides,

    next() {
      if (this.currentSlide < this.slides.length - 1) {
        this.currentSlide++;
        this.render();
      }
    },

    prev() {
      if (this.currentSlide > 0) {
        this.currentSlide--;
        this.render();
      }
    },

    render() {
      renderSlideFullscreen(this.slides[this.currentSlide]);
    }
  };

  return presenter;
}
```

### Keyboard Navigation

| Key | Action |
|-----|--------|
| → / Space / N | Next slide |
| ← / Backspace / P | Previous slide |
| Home | First slide |
| End | Last slide |
| Number + Enter | Go to slide N |
| Escape | Exit presentation |
| F | Toggle fullscreen |
| B | Black screen |

### Presenter Notes

Second-screen presenter view:

```
┌────────────────────┬────────────────────┐
│   Current Slide    │    Next Slide      │
│   ┌────────────┐   │   ┌────────────┐   │
│   │            │   │   │            │   │
│   │            │   │   │   (small)  │   │
│   └────────────┘   │   └────────────┘   │
├────────────────────┴────────────────────┤
│  Notes:                                  │
│  • Remember to mention X                 │
│  • Demo the Y feature                    │
│                                          │
│  Elapsed: 12:34     Remaining: 18 slides │
└──────────────────────────────────────────┘
```

## Integration with Cards

Notebooks can reference cards and create new ones:

```javascript
// Reference existing card in slide
const cardElement = {
  type: 'card-embed',
  card_id: existingCardId,
  display: 'preview' // or 'full', 'title-only'
};

// Promote capture to card
async function promoteToCard(capture) {
  const card = await createCardFromCapture(capture);
  return card.id;
}
```

## Export

| Format | Output |
|--------|--------|
| PDF | Paginated slides |
| Images | PNG per slide |
| HTML | Self-contained presentation |
| Markdown | Slide content as .md |
| Cards | Convert slides to cards |

## Schema

```sql
CREATE TABLE notebooks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE captures (
  id TEXT PRIMARY KEY,
  notebook_id TEXT REFERENCES notebooks(id),
  type TEXT NOT NULL,
  content BLOB,
  metadata TEXT, -- JSON
  created_at TEXT NOT NULL
);

CREATE TABLE slides (
  id TEXT PRIMARY KEY,
  notebook_id TEXT REFERENCES notebooks(id),
  position INTEGER NOT NULL,
  layout TEXT NOT NULL,
  elements TEXT NOT NULL, -- JSON array
  notes TEXT
);
```

## State

| State | Stored In |
|-------|-----------|
| Notebooks list | SQLite |
| Captures | SQLite (content may be file refs) |
| Slides | SQLite |
| Current view (capture/preview/present) | Local app state |
| Presenter position | Local session state |

## Not Building

- Real-time collaboration on notebooks
- Animated slide transitions
- Slide themes/templates marketplace
- Auto-layout/AI arrangement
- Video export
