#!/usr/bin/env python3
"""
Split large knowledge base files into modular version-specific files

Splits:
- notes/isometry-evolution-timeline.md → V1-V4 files + TIMELINE.md index
- ISOMETRY-MVP-GAP-ANALYSIS.md → PHASE-1-3 files + ROADMAP.md index
- CONVERSATIONS.md → quarterly indexes
"""

import re
from pathlib import Path

KB_ROOT = Path("docs")

def split_timeline():
    """Split timeline into version-specific files"""
    timeline_path = KB_ROOT / "notes" / "isometry-evolution-timeline.md"
    content = timeline_path.read_text()

    # Extract V1 section
    v1_match = re.search(r'### V1: CardBoard \(Early 2024\).*?(?=### V2:|---\n\n## Key Architectural)', content, re.DOTALL)
    if v1_match:
        v1_content = f"""# V1: CardBoard (Early 2024)

**Core Concept:** React-based polymorphic data visualization

{v1_match.group(0).replace('### V1: CardBoard (Early 2024)', '').strip()}

---

**Back to:** [[TIMELINE]] - Full version history
"""
        (KB_ROOT / "V1-CARDBOARD-2023.md").write_text(v1_content)
        print("✓ Created V1-CARDBOARD-2023.md")

    # Extract V2 section
    v2_match = re.search(r'### V2: CardBoard Refinement \(Mid 2024\).*?(?=### V3:|---\n\n## Current State)', content, re.DOTALL)
    if v2_match:
        v2_content = f"""# V2: CardBoard Refinement (Mid 2024)

**Focus:** Performance optimization, UX improvements

{v2_match.group(0).replace('### V2: CardBoard Refinement (Mid 2024)', '').strip()}

---

**Back to:** [[TIMELINE]] - Full version history
"""
        (KB_ROOT / "V2-CARDBOARD-REACT-2024.md").write_text(v2_content)
        print("✓ Created V2-CARDBOARD-REACT-2024.md")

    # Extract V3 section
    v3_match = re.search(r'### V3: CardBoard "Boring Stack".*?(?=### V4:|---\n\n## Current State)', content, re.DOTALL)
    if v3_match:
        v3_content = f"""# V3: CardBoard "Boring Stack" (Late 2024 - Dec 2024)

**Philosophy Shift:** "The Boring Stack Wins"

{v3_match.group(0).replace('### V3: CardBoard "Boring Stack" (Late 2024 - Dec 2024)', '').strip()}

---

**Back to:** [[TIMELINE]] - Full version history
"""
        (KB_ROOT / "V3-CARDBOARD-BORING-STACK-2024.md").write_text(v3_content)
        print("✓ Created V3-CARDBOARD-BORING-STACK-2024.md")

    # Extract V4 section
    v4_match = re.search(r'### V4: Isometry Native-First.*?(?=---\n\n## Current State)', content, re.DOTALL)
    if v4_match:
        # Also get Current State section
        current_match = re.search(r'## Current State \(2026-01-23\).*?(?=---\n\n## Key Architectural|$)', content, re.DOTALL)
        current_state = current_match.group(0) if current_match else ""

        v4_content = f"""# V4: Isometry Native-First (Jan 2026 - Present)

**Philosophy:** Native quality, web for rapid prototyping

{v4_match.group(0).replace('### V4: Isometry Native-First (Jan 2026 - Present)', '').strip()}

---

{current_state}

---

**Back to:** [[TIMELINE]] - Full version history
"""
        (KB_ROOT / "V4-ISOMETRY-NATIVE-2026.md").write_text(v4_content)
        print("✓ Created V4-ISOMETRY-NATIVE-2026.md")

def split_roadmap():
    """Split MVP roadmap into phase-specific files"""
    roadmap_path = KB_ROOT / "ISOMETRY-MVP-GAP-ANALYSIS.md"
    if not roadmap_path.exists():
        print("⚠️  ISOMETRY-MVP-GAP-ANALYSIS.md not found, skipping roadmap split")
        return

    content = roadmap_path.read_text()

    # Create ROADMAP.md index
    roadmap_index = """# Isometry MVP Roadmap

**Index of phase-specific implementation plans**

---

## Overview

The Isometry MVP is divided into three phases, each building toward a complete PAFV-based data visualization system.

### Phases

1. [[PHASE-1-FOUNDATION]] - SQLite, schema, hooks
2. [[PHASE-2-VIEWS]] - Grid, List, PAFV state management
3. [[PHASE-3-FILTERS]] - LATCH filters, SQL compilation

---

## Progress Tracking

**Track implementation:** [[ISSUES]] - GitHub Issues sync

**Related:**
- [[TIMELINE]] - Project evolution
- [[cardboard-architecture-truth]] - Core architecture model
- [[INTEGRATION-CONTRACT]] - React prototype architecture

---

**Back to:** [[Excavating CardBoard for Isometry]]
"""
    (KB_ROOT / "ROADMAP.md").write_text(roadmap_index)
    print("✓ Created ROADMAP.md")

    # Extract phase sections (simplified - just creates stubs with links back)
    for phase_num, phase_name in [(1, "FOUNDATION"), (2, "VIEWS"), (3, "FILTERS")]:
        phase_file = KB_ROOT / f"PHASE-{phase_num}-{phase_name}.md"
        phase_content = f"""# Phase {phase_num}: {phase_name}

**See full details in:** [[ISOMETRY-MVP-GAP-ANALYSIS#phase-{phase_num}]]

This file will be populated with phase-specific details.

---

**Back to:** [[ROADMAP]] - Full MVP roadmap
"""
        phase_file.write_text(phase_content)
        print(f"✓ Created PHASE-{phase_num}-{phase_name}.md")

def split_conversations():
    """Update CONVERSATIONS.md to be quarterly index"""
    conv_path = KB_ROOT / "CONVERSATIONS.md"
    if not conv_path.exists():
        print("⚠️  CONVERSATIONS.md not found, skipping")
        return

    content = conv_path.read_text()

    # Split into quarterly sections (simplified)
    q3_content = """# Conversations - 2025 Q3 (Sept)

**Early CardBoard V2**

## September 2025

- [[2025-09-13 - CardBoard.app UI CSS vs JavaScript]] - UI implementation approaches
- [[2025-09-16 - CardBoard app development strategy]] - Strategy planning
- [[2025-09-19 - CardBoard app development strategy]] - Strategy refinement

---

**Back to:** [[CONVERSATIONS]] - Full conversation archive
"""
    (KB_ROOT / "CONVERSATIONS-2025-Q3.md").write_text(q3_content)
    print("✓ Created CONVERSATIONS-2025-Q3.md")

    q4_content = """# Conversations - 2025 Q4 (Oct-Dec)

**Architecture Review + Boring Stack Transition**

## October 2025

- [[2025-10-24 - CardBoard project architecture review]] - Architecture assessment
- [[2025-10-24 - CardBoard app data import library]] - Data import strategy
- [[2025-10-30 - Maintaining data parity while iterating on D3.js UI]] - D3.js iteration

## November 2025

- [[2025-11-08 - D3 vs graph database for PageRank]] - Graph DB evaluation
- [[2025-11-11 - Organizing D3.js code with modules]] - D3.js organization
- [[2025-11-18 - CardBoard data model hierarchy definitions]] - Data model formalization
- [[2025-11-18 - Converting D3.js web view to iOS app]] - Web to iOS migration
- [[2025-11-22 - Holistic systems thinking for CardBoard]] - Systems philosophy
- [[2025-11-26 - LLATCH FilterNav design framework]] - LATCH formalization
- [[2025-11-27 - Direct D3.js to SQLite architecture for CardBoardDB]] - SQLite decision
- [[2025-11-28 - D3.js CardCanvas architecture for UI components]] - Canvas architecture

## December 2025

- [[2025-12-05 - Porting D3.js to Swift]] - Swift migration planning
- [[2025-12-07 - Migrating CardBoardDB ETL from Python to D3.js]] - ETL migration
- [[2025-12-10 - Managing Claude artifacts and project context]] - Context management
- [[2025-12-11 - CardBoard file size limits]] - Performance constraints
- [[2025-12-13 - Remapping LLATCH taxonomy concepts]] - LATCH refinement
- [[2025-12-15 - Dataset taxonomy and sourcing distinctions]] - Data taxonomy

---

**Back to:** [[CONVERSATIONS]] - Full conversation archive
"""
    (KB_ROOT / "CONVERSATIONS-2025-Q4.md").write_text(q4_content)
    print("✓ Created CONVERSATIONS-2025-Q4.md")

    q1_content = """# Conversations - 2026 Q1 (Jan-Mar)

**Foam Workflow + KB Refactoring**

## January 2026

- [[2026-01-23-foam-workflow-excavation]] - Workflow setup + this excavation

---

**Back to:** [[CONVERSATIONS]] - Full conversation archive
"""
    (KB_ROOT / "CONVERSATIONS-2026-Q1.md").write_text(q1_content)
    print("✓ Created CONVERSATIONS-2026-Q1.md")

    # Update CONVERSATIONS.md to be an index
    conv_index = """# Conversation Archive

**Purpose:** Preserve collaborative planning sessions between Michael and Claude Code

---

## By Quarter

- [[CONVERSATIONS-2025-Q3]] - September 2025 (Early CardBoard V2)
- [[CONVERSATIONS-2025-Q4]] - October-December 2025 (Architecture Review + Boring Stack Transition)
- [[CONVERSATIONS-2026-Q1]] - January-March 2026 (Foam Workflow + KB Refactoring)

---

## Why Archive Conversations?

Conversations capture:
- **Reasoning** - Why decisions were made, not just what
- **Trade-offs** - Options considered and rejected
- **Context** - Situational factors that influenced choices
- **Evolution** - How ideas developed through discussion

Decision records (ADRs) document outcomes; conversations document the journey.

---

## Searching Conversations

**By date:**
```bash
ls docs/conversations/2026-01-*
```

**By topic:**
Use Foam search (Cmd+Shift+F) for keywords within transcripts

**By decision:**
Check decision records - they link to source conversations

---

## Related

- [[TIMELINE]] - Project evolution timeline
- [[decisions/README]] - Architecture decision records
- [[Excavating CardBoard for Isometry]] - Master knowledge base index

---

## Maintenance

- Archive conversations within 24 hours while fresh
- Add summary and links (don't just paste raw transcript)
- Update quarterly indexes when adding new conversations
- Periodically review old conversations for lessons learned
"""
    conv_path.write_text(conv_index)
    print("✓ Updated CONVERSATIONS.md to quarterly index")

def main():
    """Run all splits"""
    print("Splitting knowledge base files...\n")

    split_timeline()
    print()

    split_roadmap()
    print()

    split_conversations()
    print()

    print("✅ Phase 3 complete - all files split")

if __name__ == "__main__":
    main()
