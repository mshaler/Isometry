# Isometry: Product Positioning

*"There's more here than meets the eye, and I want it to meet the eye."*

*February 2026*

---

## The Problem

Every knowledge worker lives in the gap between how their tools organize information and how their minds actually work. We categorize *and* connect. We filter *and* relate. We think in timelines *and* networks *and* hierarchies — often about the same things, simultaneously.

No tool lets you do this. Instead, you get a choice of prisons.

**Excel's Tyranny of the 2D Grid.** Excel may be Microsoft's best product — a genuine masterpiece of software engineering. And yet it is a prison. Every piece of information must be a row in a table with uniform columns. The grid is the view *and* the data model. Want to see the same data differently? Copy it to another sheet. Want to relate two tables? Write a VLOOKUP and pray. The atomic unit is a cell address — A1 — which carries zero semantic meaning. Excel doesn't know what your data *is*. It only knows where it *sits*.

The deeper pathology is that Excel actually *has* a z-axis — it just hides it from you. Consider what a single non-empty cell really contains:

- A **value**: the raw number `147250.4391`
- A **formula**: `=SUM(B3:B6)` — the computational provenance
- A **format**: currency, no decimals — a display decision that discards precision
- A **conditional format**: red because it exceeds a threshold defined somewhere else entirely
- A **displayed result**: `$147,250` — which is none of the above, but a lossy rendering of all of them

That's at least five layers of meaning compressed into one rectangle. The only way to discover any of them is to click the cell and read the formula bar — a fundamentally sequential, one-at-a-time inspection process for a tool that's supposed to give you an overview. And rounding errors are the most obvious symptom of this pathology: the displayed value `$147,250` silently disagrees with the stored value `147250.4391`, which means a column of "rounded" numbers that visually sum to one total will compute to a different one. The spreadsheet lies to your eyes and tells the truth to its formulas, and you're left wondering which to believe.

The grid isn't showing you your data. It's showing you the *outermost skin* of your data while hiding the skeleton, the musculature, and the circulatory system underneath. You make decisions based on the surface of a surface. A cell that says `$147,250` in red tells you three things: a number, a currency context, and an alarm condition. But it hides: where the number comes from, how reliable it is (are the source cells estimates or actuals?), when it last changed, what would make it change, and whether the red threshold is even correct.

Excel is a lossy compression of a multidimensional reality into a 2D surface, and the information lost in that compression is exactly the information you need most. Isometry is the exact inverse: instead of compressing dimensions into a flat grid and hiding the rest, it *selects which dimensions to show* and keeps the others accessible. The value, the formula, the format, the provenance, the temporal history — those are all facets of the same card, and you choose which facets face you. Nothing is hidden; it's just not currently projected onto a plane.

**Notion's Tyranny of Schema-First.** Before you can capture a single thought, you must design a database. Name the properties. Choose the types. Decide the structure. Then, six months later, you have databases with dozens of mostly-empty columns because your needs evolved but your schema didn't. Or you have six separate databases for things that share obvious relationships, with no way to see them together. Notion replaced Excel's spatial prison with a structural one — you must commit to a schema before you understand the shape of your work.

The same trap shows up everywhere. SharePoint gives you "sites" and "lists" — maintenance overhead as organizational theory. Coda gives you "docs" and "tables" — formula maintenance as a second full-time job. Trello gives you columns and cards — but the moment your workflow needs a second dimension, you're stuck. Every tool forces you to bend your thinking to the tool's structure, rather than revealing the structure that's already in your thinking.

---

## The Insight

Two ideas, discovered independently, combine into something neither could achieve alone.

**LATCH separates, GRAPH joins.** This is the fundamental duality of human information organization. LATCH (Location, Alphabet, Time, Category, Hierarchy) represents every possible way to *separate* things — filter, sort, group, partition. GRAPH (Link, Nest, Sequence, Affinity) represents every possible way to *connect* things — relate, contain, order, associate. Every organizational act is one or the other. Traditional tools choose a side: spreadsheets are all LATCH (rows and columns), graph tools are all GRAPH (nodes and edges). Humans do both simultaneously, all the time.

**Any axis can map to any plane.** This is PAFV — Planes, Axes, Facets, Values — a spatial projection algebra for information. Your data has LATCH dimensions already present: everything has a timestamp, a name, a category, a priority. PAFV lets you choose which of those dimensions map to the x-axis, which to the y-axis, which to depth. A view transition isn't rebuilding data or switching databases — it's remapping axes to planes. The same cards, the same relationships, the same filters — just a different projection of the same underlying geometry.

Together: your data has both LATCH coordinates *and* GRAPH edges at all times. Isometry lets you choose whether to *separate* or *join* the same information, projected onto whatever spatial arrangement reveals what you need to see.

---

## What Isometry Does Differently

### Data-first, not schema-first

In Notion, you design a database schema, then pour data into it. In Isometry, data arrives with whatever properties it naturally carries. A Slack message has a sender, timestamp, and channel. An email has a sender, timestamp, subject, and thread. A GitHub notification has a repo, author, and event type. They share *some* properties. They diverge on others. Isometry doesn't force them into a single flat table with dozens of mostly-empty columns, nor does it exile them to separate databases that can't talk to each other.

Cards are cards. They have what they have. You choose how to look at them.

When you view your morning Inbox, PAFV projects cards onto Priority × Source. LATCH filters to "unprocessed." Cards that lack a priority get surfaced for triage rather than hidden by a NULL filter. You operate on the *shared subset* of properties across heterogeneous cards — the timestamps they all have, the sources they all came from, the urgency they all carry — without requiring that they share everything else.

### Schema-on-read via projection selection

This is the key mechanism. Instead of declaring a rigid schema up front (schema-on-write), Isometry applies structure at the moment you look at your data (schema-on-read). The PAFV projection you choose determines which properties become the organizing axes. Switch projections, and different properties become salient.

Tasks and markdown documents on a shared project timeline — they don't need the same schema. They just need to share the Time facet and the Project category. PAFV projects them onto the same plane via the properties they *do* share. The properties they don't share remain available when you drill into an individual card.

This is what the graph analytics world discovered but graph databases failed to commercialize. Neo4j and friends spent a decade trying to convince people to write Cypher instead of SQL, competing on query syntax when the real value was in *heterogeneous edge semantics* — the fact that structurally different entities can coexist in the same queryable space without schema unification. They had the right data model and marketed the wrong thing.

### Edges are cards too

In traditional tools, relationships are second-class citizens. A Notion relation is a pointer. A spreadsheet reference is a cell address. Isometry treats relationships as first-class objects with their own properties, their own timestamps, their own categories. An email between you and Sarah isn't just a link between two contact cards — it *is* a card: with a subject, a date, a channel, a sentiment, a priority.

This means LATCH applies to relationships as well as entities. Filter *messages* by time period. Sort *dependencies* by priority. Group *collaborations* by project. The connective tissue of your work becomes as searchable, filterable, and projectable as the nodes themselves.

### Polymorphic views as projection, not reconstruction

When you switch from a list view to a kanban board in Notion, the app rebuilds the page. Different query, different rendering, different state. If you had something selected, it's gone.

In Isometry, a view transition is a continuous spatial remapping. The same cards, bound to the same SVG elements, flow from one arrangement to another. Selection persists. Filters persist. Focus persists. The animation isn't decorative — it's a proof: the data didn't change, only the projection did.

The dimensionality progression tells the story:

- **List**: 1 axis → 1 plane (y only)
- **Kanban**: 2 axes → x (category) + y (sequence within)
- **Grid**: 2 axes → x + y fully mapped
- **SuperGrid**: 2 axes + faceted subgrids (z as nested planes)
- **Charts**: 2 axes + statistical aggregation
- **Network Graph**: GRAPH edges replace LATCH axes entirely

Each step reveals another dimension that was *always present* in the data. By the time you reach the graph view, you've watched a flat list transform into a living network without a single data reload.

### The personal topology analyzer

Most productivity tools ask "how do you want to organize this?" Isometry asks "let me show you what's already here."

Every dataset has latent structure that traditional tools leave buried. Isometry's deepest purpose is to surface that structure through projection selection — to make the invisible visible. At its most powerful, this means revealing the gap between *declared values* and *actual behavior*. Your calendar says "Family" is important. Your modification patterns say you spend 14 hours a day in "Work" cards. The data knows. Isometry shows it.

The goal is not to optimize your life. The goal is to see it clearly.

---

## The Inbox: A Concrete Example

First thing in the morning, you want to scan a unified, curated, prioritized inbox without being flooded by notifications from Slack, Mail, Messages, GitHub, and other sources simultaneously.

In Notion, you'd need a single "Inbox" database with properties for every possible source, or separate databases you can't view together. Either way, you decide the schema before the first message arrives.

In Isometry, each message lands as a card with whatever properties it naturally has. The Slack message has a channel. The email has a thread. The GitHub notification has a repository. They all have a sender, a timestamp, and an urgency.

Your morning Inbox view: Priority (H axis) × Source (C axis), filtered to unprocessed, sorted by timeline. One view. Every source. No schema design required.

You scan, triage, and act. Promote a message to a task — the GRAPH edges preserve provenance. This task *came from* that email, which *mentioned* this person, who *owns* that project. The message card transforms through its lifecycle: from Inbox item to active task to completed work, accumulating edges and properties along the way, never losing its history.

Cards might exist in Inbox only as Priority organized by Source ranked by timeline/urgency, and then become entirely different kinds of Cards in other contexts. The schema is fluid because it was never rigid in the first place.

---

## The Lineage

**Lotus Improv (1991)** saw this first. It separated data from view — revolutionary, decades ahead of its time. But Improv only showed different *slices*: rotate a data cube, see a different cross-section. Isometry shows different *geometries*: the same data rendered as a list, a board, a grid, a network — each revealing structure the others can't.

Improv also lacked the relational dimension entirely. It was a multidimensional spreadsheet without graphs. Isometry treats LATCH (Improv's categories) and GRAPH (relationships between entities) as equal, interoperable, co-present systems. Humans don't just categorize — they connect. No previous tool has unified both operations under a single projection algebra.

**Trello (2011)** proved that cards on a spatial canvas are the natural unit of knowledge work. Drag, drop, reorder — the physical metaphor works. But Trello gave you exactly one view: columns. The moment your workflow needed a second dimension, you were stuck.

**The graph databases (2010s)** — Neo4j, ArangoDB, and others — discovered heterogeneous edge semantics: structurally different entities coexisting in the same queryable space. But they competed on query syntax (Cypher vs. SQL) instead of running toward *graph synthetics* — the visualization and analytical power of treating relationships as first-class, property-bearing entities. They had the right data model and marketed the wrong thing.

Isometry takes the data model the graph world built, the spatial metaphor Trello proved, and the projection algebra Improv pioneered — and unifies them with the LATCH/GRAPH duality that no previous tool recognized.

---

## Why Now

The constraints that killed Improv are gone:

- **The hardware can handle it.** Commodity devices run complex spatial computations in real time.
- **D3.js can render it.** A mature, battle-tested visualization library that treats data binding as the primitive, not cell addresses.
- **SQLite can query it.** The boring, universal, embedded database — with FTS5 for search, recursive CTEs for graph traversal, and WAL mode for performance.
- **Knowledge workers are drowning.** Rigid single-view tools create more organizational overhead than they eliminate. People maintain Notion databases the way they used to maintain SharePoint sites — as a second job.

JavaScript won precisely *because* it was the anti-Flash: ugly, universal, running everywhere without vendor lock-in. Isometry's stack follows the same principle.

The boring stack, serving a non-boring idea.

---

## Where Isometry Sits

Isometry is not a spreadsheet with extra features. It is not a project manager with better views. It is not a graph database with a pretty frontend.

Isometry is what happens when you stop choosing between separation and connection, between tabular and relational, between grid and graph — and instead treat them as two aspects of the same underlying reality.

The data is already dimensional. The relationships already exist. The structure is already there. Traditional tools just refuse to show it to you.

*Isometry: The next-dimension spreadsheet.*

---

## Technical Foundation

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Data model** | Labeled Property Graph in SQLite | Edges are first-class cards; no graph DB overhead |
| **Projection algebra** | PAFV (Planes → Axes → Facets → Values) | Any axis maps to any plane; views are remappings |
| **Separation operations** | LATCH (Location, Alphabet, Time, Category, Hierarchy) | Complete taxonomy of human organization |
| **Connection operations** | GRAPH (Link, Nest, Sequence, Affinity) | Complete taxonomy of human relation |
| **Rendering** | D3.js | Data binding IS state management; transitions are proofs |
| **Storage** | SQLite (sql.js for web, native for iOS) | Boring, universal, embedded, capable |
| **Sync** | CloudKit (native); deferred for web | Apple ecosystem first |

---

## Key Principles

1. **LATCH separates, GRAPH joins** — the fundamental duality of human information organization
2. **Any axis maps to any plane** — view transitions are remappings, not reconstructions
3. **Edges are cards** — relationships are first-class, searchable, filterable, projectable
4. **Schema-on-read** — structure emerges from projection selection, not upfront declaration
5. **Data-first** — capture first, organize by looking at it, not by pre-designing containers
6. **Boring stack wins** — SQLite + D3.js; proven tools, elegant combination
7. **See it clearly** — revelation, not optimization; awareness, not pressure

---

*Document Version: 1.0*
*Authors: Michael + Claude*
*Project: Isometry (formerly CardBoard)*
