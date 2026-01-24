#!/usr/bin/env python3
"""
Import Apple Notes from alto-index Export to Foam Knowledge Base

Imports notes from ClaudeAI and CardBoard folders in alto-index export,
preserving frontmatter and copying associated images.

Usage:
    python3 scripts/import-apple-notes.py
"""

import os
import shutil
import subprocess
from pathlib import Path
from datetime import datetime

# Configuration
ALTO_INDEX_BASE = Path("/Users/mshaler/Library/Containers/com.altoindex.AltoIndex/Data/Documents/alto-index/notes/Learning")
TARGET_BASE = Path("docs/notes/apple-notes")

FOLDERS_TO_IMPORT = {
    "ClaudeAI": ALTO_INDEX_BASE / "ClaudeAI",
    "CardBoard": ALTO_INDEX_BASE / "CardBoard"
}

def sanitize_filename(filename):
    """Remove alto-index ID suffix from filename"""
    # Remove patterns like "-140026.md"
    if filename.endswith('.md'):
        parts = filename.rsplit('-', 1)
        if len(parts) == 2 and parts[1].replace('.md', '').isdigit():
            return parts[0] + '.md'
    return filename

def copy_folder_notes(source_folder, target_folder_name):
    """Copy all notes and images from source folder to target"""
    source = Path(source_folder)
    target = TARGET_BASE / target_folder_name

    if not source.exists():
        print(f"  ⚠️  Source folder not found: {source}")
        return 0, 0

    # Create target directory
    target.mkdir(parents=True, exist_ok=True)

    # Copy all markdown files
    md_files = list(source.glob("*.md"))
    image_files = list(source.glob("*.png")) + list(source.glob("*.jpg")) + list(source.glob("*.jpeg"))

    md_count = 0
    img_count = 0

    for md_file in md_files:
        # Sanitize filename
        clean_name = sanitize_filename(md_file.name)
        target_file = target / clean_name

        # Copy file
        shutil.copy2(md_file, target_file)
        md_count += 1

    # Copy images
    for img_file in image_files:
        target_file = target / img_file.name
        shutil.copy2(img_file, target_file)
        img_count += 1

    return md_count, img_count

def create_index():
    """Create README.md index for Apple Notes"""
    index_content = f"""# Apple Notes Archive

**Purpose:** Imported notes from Apple Notes (ClaudeAI and CardBoard folders)

**Source:** alto-index export from `/Users/mshaler/Library/Containers/com.altoindex.AltoIndex/Data/Documents/alto-index/notes/Learning/`

**Last imported:** {datetime.now().strftime('%Y-%m-%d %H:%M')}

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
"""

    readme_path = TARGET_BASE / "README.md"
    with open(readme_path, 'w') as f:
        f.write(index_content)

    return readme_path

def main():
    """Main import function"""
    print("Importing Apple Notes from alto-index export...")
    print()

    total_md = 0
    total_img = 0

    for folder_name, source_path in FOLDERS_TO_IMPORT.items():
        print(f"Importing {folder_name}...")
        md_count, img_count = copy_folder_notes(source_path, folder_name)
        total_md += md_count
        total_img += img_count
        print(f"  ✓ {md_count} markdown files")
        print(f"  ✓ {img_count} images")
        print()

    print("Creating index...")
    index_path = create_index()
    print(f"  ✓ {index_path}")
    print()

    print(f"✅ Successfully imported {total_md} notes and {total_img} images")

    # Auto-commit changes
    print()
    print("Committing changes...")
    try:
        # Stage changes
        subprocess.run(['git', 'add', 'docs/notes/apple-notes/'], check=True, capture_output=True)

        # Create commit
        result = subprocess.run(
            ['git', 'commit', '-m', 'docs: sync Apple Notes from alto-index'],
            check=True,
            capture_output=True,
            text=True
        )

        # Extract commit hash
        commit_hash = subprocess.run(
            ['git', 'rev-parse', '--short', 'HEAD'],
            check=True,
            capture_output=True,
            text=True
        ).stdout.strip()

        print(f"  ✓ Committed as {commit_hash}")
        print()
        print("Next steps:")
        print("  git push origin main")

    except subprocess.CalledProcessError as e:
        if b'nothing to commit' in e.stderr or 'nothing to commit' in str(e.stderr):
            print("  ℹ️  No changes to commit (notes already up to date)")
        else:
            print(f"  ⚠️  Git commit failed: {e}")
            print()
            print("Manual steps:")
            print("  1. git add docs/notes/apple-notes/")
            print("  2. git commit -m 'docs: sync Apple Notes from alto-index'")
            print("  3. git push origin main")

if __name__ == "__main__":
    main()
