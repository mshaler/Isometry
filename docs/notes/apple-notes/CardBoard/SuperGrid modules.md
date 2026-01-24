---
title: "SuperGrid modules"
id: 138773
created: 2025-12-14T10:53:01Z
modified: 2026-01-11T00:59:13Z
folder: "Learning/CardBoard"
attachments:
  - id: "61846038-a93d-406e-87c2-5f8b897cd46a"
    type: "com.apple.notes.inlinetextattachment.hashtag"
    content: "<a class=\"tag link\" href=\"/tags/CardBoard\">#CardBoard</a>"
links: []
source: notes://showNote?identifier=fa451c1a-3d10-4514-b3bb-31fcceacd135
---
SuperGrid modules

* SuperGrayScale: NeXTSTEP UI (other color palettes to follow later) which looks like Numbers
* SuperDensitySparsity: user-configurable scaled setting for how many Cards can be stacked per data cell: 1) SuperSparsity set to high translates into one Card per data cell. 2) SuperDensity set to high translates into multiple Cards per data cell in an aggregated view.

* SuperSearch: context-aware faceted search
* SuperPosition: card position tracking system for the SuperGrid side of SuperJanus for polymorphic view enablement
* SuperStack: child headers support parents progressively (if 3 headers tall, child is 3 deep horizontally)
* SuperCards: While standard (Data) Cards live in data cells, in contrast SuperCards are generated: SuperStack headers, SuperAudit overlays, etc.

* SuperDynamic: direct control over axis SuperCards across planes (transpose and beyond) with visual cues indicating intent on drag/hover without relying on Axis Navigator or other LATCH FilterNav controls
* SuperAudit: highlight calculated/enriched and CRUD values
* SuperZ: Property depth aware rich data type Card display: default is Card Title which is fully user configurable, but also checkboxes and sliders and other cell-based controls per header type (for Excel imports, properties included value, formula, format (which is a formula as well, calculated value, calculated format)
* SuperSize: direct control over SuperCard header cell sizing (drag, shift drag, universal sizing from lower right corner) syncs cards and data cell sizes
* SuperZoom: Upper left corner stays pinned, contrary to D3 default zoom behavior
* SuperSelect: Z-axis aware Card and SuperCard selection (lasso needs context)
* SuperFormat: PAFV aware formatting of text, cells, etc via D3 palettes
* SuperCalc: category aware calculations (HyperFormula)
* SuperTime: smart time series data parsing, header builder, and non-contiguous time selection
* SuperReplay: Hans Rösling-style (GapFinder) playback of card changes
* SuperLink: every cell and Canvas has an x-callback-URL

SuperIntent: support for Apple Intelligence app intents

SuperVersion: git-style version control (branch, merge, pull)

SuperTemplates: shared header sets and other template support for building apps (which I will likely call shareable views or something like that)

SuperViz: context-aware visualizations following data-to-viz decision tree (charts and beyond)

SuperSort: PAFV aware sort by header

SuperFilter: PAFV aware filter by header (like Excel column auto-filter)

SuperSearch: PAFV aware faceted/tokenized search like HotNotes (fast fuzzy look ahead indexed search)

SuperActive: database segmentation by starred/VIP, active, and archive (⭐️ = hot/in-memory, active = accessible, archive = eventually accessible)

Note: Grid is basically ASCII while SuperGrid is all about rich data types (“TRUE/FALSE” vs. Checkboxes)

[#CardBoard](/tags/CardBoard)

---

[Open in Notes](notes://showNote?identifier=fa451c1a-3d10-4514-b3bb-31fcceacd135)