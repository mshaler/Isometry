# Apple Notes Archive

**Purpose:** Imported notes from Apple Notes (ClaudeAI and CardBoard folders)

**Source:** alto-index export from `/Users/mshaler/Library/Containers/com.altoindex.AltoIndex/Data/Documents/alto-index/notes/Learning/`

**Last imported:** 2026-01-23 20:26

---

## Overview

These notes were imported from Apple Notes folders where early project ideas,
research, and planning were captured before being formalized into specs and
decision records.

### ClaudeAI Folder

Notes about Claude AI, Claude Code, agent development, and AI tooling research.

**Location:** [apple-notes/ClaudeAI/](ClaudeAI/)

**Related:**
- [[conversations/README]] - Planning conversations with Claude
- [[isometry-evolution-timeline]] - How Claude AI influenced the project

### CardBoard Folder

Project-specific notes from CardBoard V1/V2/V3 development, including early
design sketches, implementation ideas, and research notes.

**Location:** [apple-notes/CardBoard/](CardBoard/)

**Related:**
- [[isometry-feature-lineage]] - Feature evolution across versions
- [[decisions/2024-12-01-boring-stack-over-graph-db]] - Key architecture decision
- [[V1V2-PORT-IMPLEMENTATION-PLAN]] - V1/V2 port documentation

---

## Note Format

Notes are preserved with alto-index frontmatter:

```yaml
---
title: "Note Title"
id: 140026
created: 2026-01-13T04:24:54Z
modified: 2026-01-18T15:49:52Z
folder: "Learning/ClaudeAI"
attachments: [...]
source: notes://showNote?identifier=...
---
```

The `source` field links back to the original Apple Note (requires Apple Notes.app).

---

## Importing New Notes

To re-import notes after updating in Apple Notes:

1. Export from Apple Notes using alto-index
2. Run import script:
   ```bash
   python3 scripts/import-apple-notes.py
   ```
3. Commit changes:
   ```bash
   git add docs/notes/apple-notes/
   git commit -m "docs: sync Apple Notes from alto-index"
   ```

---

## Related

- [[Excavating CardBoard for Isometry]] - Master knowledge base index
- [[isometry-evolution-timeline]] - Project timeline
- [[conversations/README]] - Conversation archive
- [[issues/README]] - GitHub Issues tracking

---

## Maintenance

- Re-import periodically to sync updates from Apple Notes
- When formalizing notes into specs/decisions, link back to source note
- Archive or remove outdated notes as project evolves
