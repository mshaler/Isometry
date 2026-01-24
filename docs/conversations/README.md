# Conversation Archive

**Purpose:** Preserve collaborative planning sessions between Michael and Claude Code

---

## Why Archive Conversations?

Conversations capture:
- **Reasoning** - Why decisions were made, not just what
- **Trade-offs** - Options considered and rejected
- **Context** - Situational factors that influenced choices
- **Evolution** - How ideas developed through discussion

Decision records (ADRs) document outcomes; conversations document the journey.

---

## How to Capture Conversations

### From Claude.AI Desktop

1. After conversation ends, use "Share" button
2. Copy conversation as markdown
3. Create new file: `docs/conversations/YYYY-MM-DD-topic-name.md`
4. Use `_TEMPLATE.md` as structure
5. Add summary and link to related docs
6. Update this index

### From Claude Code (VS Code)

1. Conversations auto-saved in `.claude/` directory
2. After session, copy relevant exchanges
3. Follow same process as above

### What to Archive

Archive conversations that:
- ✅ Led to architectural decisions
- ✅ Explored multiple implementation approaches
- ✅ Debugged complex problems
- ✅ Planned major features
- ❌ Skip trivial bug fixes or simple questions

---

## Conversation Index

### 2026-01-23: Foam Workflow Setup + Excavation
**File:** [[2026-01-23-foam-workflow-excavation]]
**Topics:**
- Foam vs Obsidian decision
- Workflow template setup
- Historical context excavation
- Timeline reconstruction

**Outcome:**
- Foam workflow established
- 4 ADRs created
- Feature lineage documented
- Timeline complete

**Related:**
- [[isometry-evolution-timeline]]
- [[isometry-feature-lineage]]
- All decision records in `docs/decisions/`

---

### Historical Conversations (Claude.AI Desktop Export)

**Source:** Imported from `/Users/mshaler/Developer/Projects/Claude export/` on 2026-01-23

These conversations document the evolution from CardBoard V1/V2 through the "boring stack" transition to Isometry V4.

#### September 2025 - Early CardBoard V2

**2025-09-13:** [[2025-09-13 - CardBoard.app UI CSS vs JavaScript]]

- CSS vs JavaScript for UI implementation
- Early architecture decisions

**2025-09-16:** [[2025-09-16 - CardBoard app development strategy]]

- Development strategy planning
- Tech stack evaluation

**2025-09-19:** [[2025-09-19 - CardBoard app development strategy]]

- Continued strategy refinement
- Implementation approach

#### October 2025 - Architecture Review

**2025-10-24:** [[2025-10-24 - CardBoard project architecture review]]

- Comprehensive architecture assessment
- **Related:** [[cardboard-architecture-truth]]

**2025-10-24:** [[2025-10-24 - CardBoard app data import library]]

- Data import strategy
- Library evaluation

**2025-10-30:** [[2025-10-30 - Maintaining data parity while iterating on D3.js UI]]

- D3.js iteration strategy
- Data consistency patterns

#### November 2025 - D3.js + SQLite Transition

**2025-11-08:** [[2025-11-08 - D3 vs graph database for PageRank]]

- Graph database evaluation
- PageRank implementation approaches
- **Related:** [[2024-12-01-boring-stack-over-graph-db]]

**2025-11-11:** [[2025-11-11 - Organizing D3.js code with modules]]

- D3.js code organization
- Module patterns

**2025-11-18:** [[2025-11-18 - CardBoard data model hierarchy definitions]]

- Data model formalization
- Hierarchy design

**2025-11-18:** [[2025-11-18 - Converting D3.js web view to iOS app]]

- Web to iOS migration planning
- **Related:** [[2025-01-16-native-apps-over-electron]]

**2025-11-22:** [[2025-11-22 - Holistic systems thinking for CardBoard]]

- Systems architecture philosophy
- Design principles

**2025-11-26:** [[2025-11-26 - LLATCH FilterNav design framework]]

- LATCH taxonomy formalization
- FilterNav architecture
- **Related:** [[isometry-feature-lineage]]

**2025-11-27:** [[2025-11-27 - Direct D3.js to SQLite architecture for CardBoardDB]]

- SQLite architecture decision
- D3.js integration strategy
- **Related:** [[2024-12-01-boring-stack-over-graph-db]]

**2025-11-28:** [[2025-11-28 - D3.js CardCanvas architecture for UI components]]

- Canvas rendering architecture
- UI component design

#### December 2025 - Boring Stack Implementation

**2025-12-05:** [[2025-12-05 - Porting D3.js to Swift]]

- D3.js to Swift migration planning
- Native implementation strategy

**2025-12-07:** [[2025-12-07 - Migrating CardBoardDB ETL from Python to D3.js]]

- ETL pipeline migration
- Python to D3.js transition

**2025-12-10:** [[2025-12-10 - Managing Claude artifacts and project context]]

- Context management strategies
- Artifact organization

**2025-12-11:** [[2025-12-11 - CardBoard file size limits]]

- Performance constraints
- File size optimization

**2025-12-13:** [[2025-12-13 - Remapping LLATCH taxonomy concepts]]

- LATCH taxonomy refinement
- Conceptual remapping
- **Related:** [[cardboard-architecture-truth]]

**2025-12-15:** [[2025-12-15 - Dataset taxonomy and sourcing distinctions]]

- Data taxonomy formalization
- Sourcing patterns

---

### [Add more conversations here as they happen]

**Template:**
```markdown
### YYYY-MM-DD: [Topic]
**File:** [[YYYY-MM-DD-topic-slug]]
**Topics:**
- Topic 1
- Topic 2

**Outcome:**
- What was decided/built

**Related:**
- [[linked-doc-1]]
- [[linked-doc-2]]

---
```

---

## Searching Conversations

**By date:**
```bash
ls docs/conversations/2026-01-*
```

**By topic:**
Use Foam search (`Cmd+Shift+F`) for keywords within transcripts

**By decision:**
Check decision records - they link to source conversations

---

## Maintenance

- Archive conversations within 24 hours while fresh
- Add summary and links (don't just paste raw transcript)
- Update this index when adding new conversations
- Periodically review old conversations for lessons learned
