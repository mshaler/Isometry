# Conversation: Foam Workflow Setup + Historical Excavation

**Date:** 2026-01-23
**Participants:** Michael, Claude Code
**Session:** Claude Code (VS Code)
**Context:** Deciding between Foam/Obsidian/Nimbalyst for documentation workflow, then reconstructing Isometry's historical evolution
**Outcome:** Foam workflow established, complete historical knowledge base created

---

## Summary

This conversation had two major phases:

1. **Workflow Decision** - Evaluated Foam vs Obsidian vs Nimbalyst for documentation. Chose Foam for tight integration with Claude Code in VS Code, eliminating context switching between apps.

2. **Historical Excavation** - Reconstructed the complete evolution of Isometry (formerly CardBoard) from V1 through V4, creating timeline, decision records, and feature lineage documentation.

Key insight: The value of keeping documentation workflow in the same environment as code editing and AI collaboration outweighed Obsidian's superior UX features.

---

## Key Decisions Made

1. **Foam over Obsidian** - Integration with Claude Code in VS Code worth the UX trade-offs
2. **Apple Notes for capture only** - Quick capture stays in Notes, structured work in Foam
3. **Dual templates** - Working examples (canvas pan/zoom) alongside blank templates
4. **Daily notes enabled** - Foam journal feature (`Alt+D`) for quick captures
5. **Wiki-link migration** - Converted existing cross-references to `[[wiki-links]]`
6. **Conversation archival** - Decided to preserve planning conversations as historical context

## Related Documents

Created:
- [[isometry-evolution-timeline]]
- [[isometry-feature-lineage]]
- [[2024-12-01-boring-stack-over-graph-db]]
- [[2025-01-16-native-apps-over-electron]]
- [[2025-01-16-react-prototype-strategy]]
- [[2025-01-19-cloudkit-over-firebase]]
- All templates in `docs/{specs,plans,decisions,notes,journal}/`
- [[Excavating CardBoard for Isometry]] - Master index

Updated:
- [[CLAUDE]] - Added "Documentation Workflow" section
- [[ISOMETRY-MVP-GAP-ANALYSIS]] - Converted to wiki-links

---

## Conversation Flow

### Phase 1: Workflow Tool Selection

**User question:** Foam vs Obsidian vs Nimbalyst for documentation?

**Key exchanges:**
- Foam pros: Zero context switching, direct Claude Code integration, git-native
- Obsidian pros: Better markdown preview, superior graph view, mobile apps
- Trade-off analysis: Integration vs UX quality
- Decision: Foam wins because workflow integration > visual polish

**Outcome:** Use Foam for all structured docs, Apple Notes for capture only

---

### Phase 2: Template System Design

**User input:** Want working examples, not just blank templates

**Design decisions:**
- Create 4 template types (specs, plans, decisions, notes)
- Add 4 working examples (canvas pan/zoom feature)
- Include Daily Notes feature for quick captures
- Set up wiki-link navigation

**Outcome:** Complete template system with examples

---

### Phase 3: Historical Context Excavation

**User request:** "Reconstruct timeline of past specs, decisions, issues, and insights"

**Approach:**
- Read V1V2 port docs
- Read git history for commits
- Read SQLite migration plan
- Extract architectural decisions
- Map feature evolution

**Deliverables:**
1. Timeline (V1 → V2 → V3 → V4 narrative)
2. 4 ADRs (boring stack, native apps, React prototype, CloudKit)
3. Feature lineage (7 major features tracked)
4. Master index (navigation entry point)

**Outcome:** Reproducible knowledge base capturing entire project evolution

---

### Phase 4: Conversation Archival Setup

**User request:** "Can we add markdown versions of our chat transcripts to this knowledge base?"

**Solution:**
- Created `docs/conversations/` directory
- Template for conversation logs
- Index/README for navigation
- Linked to timeline

**Outcome:** Infrastructure for preserving planning conversations

---

## Follow-up Actions

- [x] Create Foam templates
- [x] Create working examples
- [x] Create timeline
- [x] Create ADRs
- [x] Create feature lineage
- [x] Set up conversation archival
- [ ] Export this conversation as full markdown transcript (manual step)
- [ ] Add conversation to timeline references

## How to Complete This Record

1. Export this conversation from Claude Code:
   - Use VS Code command palette → search for conversation export
   - Or manually copy from `.claude/` conversation files

2. Replace "Conversation Flow" section with full transcript

3. Keep summary and decisions at top for quick reference

## Tags

#workflow #documentation #foam #excavation #timeline #decisions #architecture #meta
