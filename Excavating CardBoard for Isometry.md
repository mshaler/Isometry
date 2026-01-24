# Excavating CardBoard for Isometry

**Date:** 2026-01-23
**Purpose:** Reconstruct historical context for reproducible spec builds

---

## What This Is

This excavation captures the complete evolution of Isometry (formerly CardBoard) across four major versions, documenting architectural decisions, feature lineage, and lessons learned. Think of it as the "archaeological record" of the project.

## Key Documents Created

### 1. Timeline
[[isometry-evolution-timeline]] - Chronological narrative of V1 → V2 → V3 → V4

**What it covers:**
- V1/V2: CardBoard React monorepo (archived)
- V3: "Boring stack" transition (SQLite + D3)
- V4: Isometry native-first (Swift/SwiftUI + React prototype)
- Key commits with context
- Current state and next steps

### 2. Decision Records (ADRs)

Historical architectural decisions with rationale:

1. [[2024-12-01-boring-stack-over-graph-db]] - Why SQLite instead of Neo4j
2. [[2025-01-16-native-apps-over-electron]] - Why Swift/SwiftUI for production
3. [[2025-01-16-react-prototype-strategy]] - Why maintain dual implementation
4. [[2025-01-19-cloudkit-over-firebase]] - Why CloudKit for sync

### 3. Feature Lineage
[[isometry-feature-lineage]] - How features evolved across versions

**Tracks:**
- SuperGrid → PAFV Grid View (V1 → V3 → V4)
- DimensionNavigator → Axis Assignment (V1 → deferred)
- FilterNav → LATCH Filters (V1 → V3 → V4)
- Graph Analytics (V1 → V3 → V4 native)
- Theme System (new in V4)
- Data Import (new in V4 - Apple Notes)
- Sync/Offline (V1 failed → V4 CloudKit)

### 4. Conversation Archive
`docs/conversations/` - Planning session transcripts with reasoning

**Index:** [[conversations/README]]

**34 historical conversations imported** from Claude.AI Desktop (Sept-Dec 2025)

**Key conversations by phase:**

**V2 Evolution (Sept 2025):**

- [[2025-09-13 - CardBoard.app UI CSS vs JavaScript]]
- [[2025-09-16 - CardBoard app development strategy]]
- [[2025-09-19 - CardBoard app development strategy]]

**Architecture Review (Oct 2025):**

- [[2025-10-24 - CardBoard project architecture review]]
- [[2025-10-24 - CardBoard app data import library]]

**Boring Stack Transition (Nov 2025):**

- [[2025-11-08 - D3 vs graph database for PageRank]] - Led to SQLite decision
- [[2025-11-26 - LLATCH FilterNav design framework]] - LATCH formalization
- [[2025-11-27 - Direct D3.js to SQLite architecture for CardBoardDB]] - Key architecture decision

**V4 Planning (Dec 2025):**

- [[2025-12-05 - Porting D3.js to Swift]]
- [[2025-12-13 - Remapping LLATCH taxonomy concepts]]

**Current Session:**

- [[2026-01-23-foam-workflow-excavation]] - Workflow setup + this excavation

---

## Why This Matters

**Problem:** Context loss across versions
- V1/V2 code archived, lessons forgotten
- V3 decisions not documented
- V4 team doesn't know what was tried before

**Solution:** Reproducible knowledge base
- Decision records explain "why not X"
- Feature lineage shows what worked, what didn't
- Timeline provides narrative continuity

**Use case:**
When building new feature, check:
1. Was this tried in V1/V2? (feature lineage)
2. Why did we choose current approach? (decision records)
3. What's the evolutionary context? (timeline)

---

## Navigation

**Start here:**
- New to project? Read [[isometry-evolution-timeline]]
- Evaluating architecture choice? Check [[2024-12-01-boring-stack-over-graph-db]] and related ADRs
- Implementing V1/V2 feature? See [[isometry-feature-lineage]]
- Current roadmap? See [[ISOMETRY-MVP-GAP-ANALYSIS]]

**Related:**
- [[cardboard-architecture-truth]] - PAFV + LATCH + GRAPH model (constant across versions)
- [[V1V2-PORT-IMPLEMENTATION-PLAN]] - Detailed V1/V2 → V3 port plan
- [[SQLITE-MIGRATION-PLAN]] - V4 native SQLite + CloudKit architecture
- [[INTEGRATION-CONTRACT]] - V4 React prototype architecture

---

## Maintenance

This excavation is a **living document** - update as:
- New versions are released
- Major decisions are made
- Features evolve or get discarded
- Lessons are learned

**Owner:** Michael + Claude Code (via Foam workflow)
