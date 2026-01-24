#!/usr/bin/env python3
"""
Sync GitHub Issues to Foam Knowledge Base

Fetches issues from GitHub API and creates/updates markdown files in docs/issues/
with proper frontmatter and wiki-links.

Usage:
    python3 scripts/sync-github-issues.py
"""

import json
import urllib.request
import urllib.error
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# Add scripts directory to path for config import
sys.path.insert(0, str(Path(__file__).parent))
from kb_config import CONFIG

# Configuration from .kb-config.yaml (with fallback defaults)
GITHUB_REPO = CONFIG["github"]["repo"]
GITHUB_API_URL = CONFIG["github"]["api_url"]
ISSUES_DIR = Path("docs") / CONFIG["paths"]["github_issues"]
README_PATH = ISSUES_DIR / "README.md"
AUTO_COMMIT = CONFIG["sync"]["auto_commit"]
COMMIT_PREFIX = CONFIG["sync"]["commit_prefix"]

def fetch_issues():
    """Fetch all issues from GitHub API"""
    url = f"{GITHUB_API_URL}?state=all&per_page=100"

    try:
        with urllib.request.urlopen(url) as response:
            return json.loads(response.read().decode())
    except urllib.error.URLError as e:
        print(f"Error fetching issues: {e}")
        return []

def format_date(iso_date):
    """Convert ISO date to readable format"""
    if not iso_date:
        return None
    dt = datetime.fromisoformat(iso_date.replace('Z', '+00:00'))
    return dt.strftime('%Y-%m-%d')

def extract_labels(issue):
    """Extract label names from issue"""
    return [label['name'] for label in issue.get('labels', [])]

def create_issue_markdown(issue):
    """Generate markdown content for an issue"""
    number = issue['number']
    title = issue['title']
    state = issue['state']
    created = format_date(issue['created_at'])
    updated = format_date(issue['updated_at'])
    closed = format_date(issue['closed_at']) if issue['closed_at'] else None
    labels = extract_labels(issue)
    body = issue.get('body', '').strip()
    url = issue['html_url']

    # Determine phase from title
    phase = None
    if title.startswith('P1'):
        phase = 'phase-1'
    elif title.startswith('P2'):
        phase = 'phase-2'
    elif title.startswith('P3'):
        phase = 'phase-3'

    # Build frontmatter
    frontmatter = f"""---
github_issue: {number}
title: "{title}"
state: {state}
created: {created}
updated: {updated}
"""

    if closed:
        frontmatter += f"closed: {closed}\n"

    if labels:
        frontmatter += f"labels: [{', '.join(labels)}]\n"

    if phase:
        frontmatter += f"phase: {phase}\n"

    frontmatter += f"url: {url}\n---\n"

    # Build content
    content = f"""# Issue #{number}: {title}

**Status:** {state.upper()}
**GitHub:** [{url}]({url})
**Created:** {created}
**Updated:** {updated}
"""

    if closed:
        content += f"**Closed:** {closed}\n"

    if labels:
        content += f"\n**Labels:** {', '.join(f'`{label}`' for label in labels)}\n"

    content += f"\n---\n\n{body}\n"

    # Add related links section
    content += "\n\n---\n\n## Related\n\n"

    if phase == 'phase-1':
        content += "- [[ISOMETRY-MVP-GAP-ANALYSIS]] - MVP Roadmap (Phase 1: Foundation)\n"
    elif phase == 'phase-2':
        content += "- [[ISOMETRY-MVP-GAP-ANALYSIS]] - MVP Roadmap (Phase 2: Views)\n"
    elif phase == 'phase-3':
        content += "- [[ISOMETRY-MVP-GAP-ANALYSIS]] - MVP Roadmap (Phase 3: Filters)\n"

    content += "- [[isometry-evolution-timeline]] - Project timeline\n"

    return frontmatter + content

def create_index(issues):
    """Generate README.md index of all issues"""

    # Group issues by phase
    phase1 = [i for i in issues if i['title'].startswith('P1')]
    phase2 = [i for i in issues if i['title'].startswith('P2')]
    phase3 = [i for i in issues if i['title'].startswith('P3')]

    open_count = sum(1 for i in issues if i['state'] == 'open')
    closed_count = sum(1 for i in issues if i['state'] == 'closed')

    index = f"""# GitHub Issues

**Purpose:** Track implementation progress via GitHub Issues integration

---

## Overview

**Total Issues:** {len(issues)}
**Open:** {open_count}
**Closed:** {closed_count}

These issues track the Isometry MVP implementation across three phases:
- **Phase 1:** Foundation (SQLite, schema, hooks)
- **Phase 2:** Views (Grid, List, PAFV)
- **Phase 3:** Filters (State, SQL compilation)

---

## Sync

Issues are synced from GitHub using:
```bash
python3 scripts/sync-github-issues.py
```

This creates/updates markdown files in `docs/issues/` with frontmatter linking to GitHub.

**Last synced:** {datetime.now().strftime('%Y-%m-%d %H:%M')}

---

## Phase 1: Foundation

"""

    for issue in sorted(phase1, key=lambda x: x['number']):
        number = issue['number']
        title = issue['title']
        state = issue['state']
        state_emoji = '✅' if state == 'closed' else '🔲'
        index += f"{state_emoji} **Issue #{number}:** [[{number:03d}-{title.lower().replace(':', '').replace(' ', '-')}|{title}]]  \n"

    index += "\n## Phase 2: Views\n\n"

    for issue in sorted(phase2, key=lambda x: x['number']):
        number = issue['number']
        title = issue['title']
        state = issue['state']
        state_emoji = '✅' if state == 'closed' else '🔲'
        index += f"{state_emoji} **Issue #{number}:** [[{number:03d}-{title.lower().replace(':', '').replace(' ', '-')}|{title}]]  \n"

    index += "\n## Phase 3: Filters\n\n"

    for issue in sorted(phase3, key=lambda x: x['number']):
        number = issue['number']
        title = issue['title']
        state = issue['state']
        state_emoji = '✅' if state == 'closed' else '🔲'
        index += f"{state_emoji} **Issue #{number}:** [[{number:03d}-{title.lower().replace(':', '').replace(' ', '-')}|{title}]]  \n"

    index += """
---

## Related

- [[ISOMETRY-MVP-GAP-ANALYSIS]] - Full MVP roadmap
- [[isometry-evolution-timeline]] - Project timeline
- [[Excavating CardBoard for Isometry]] - Historical context

---

## Adding New Issues

1. Create issue on GitHub: https://github.com/mshaler/Isometry/issues/new
2. Run sync script: `python3 scripts/sync-github-issues.py`
3. Commit changes: `git add docs/issues/ && git commit -m "docs: sync GitHub issues"`

---

## Issue Template

When creating new issues on GitHub, use this structure:

```markdown
## Overview
[Brief description of what needs to be implemented]

## Requirements
- [ ] Requirement 1
- [ ] Requirement 2

## Implementation
[Code snippets, approach details]

## Deliverable
- File/component to create
- Acceptance criteria
```
"""

    return index

def sanitize_filename(title):
    """Convert issue title to filename-safe format"""
    # Remove 'P1.1:' prefix
    title = title.split(':', 1)[-1].strip()
    # Convert to lowercase and replace spaces with hyphens
    filename = title.lower().replace(' ', '-').replace('/', '-').replace('→', 'to')
    # Remove special characters
    filename = ''.join(c for c in filename if c.isalnum() or c in '-_')
    return filename

def main():
    """Main sync function"""
    print("Fetching issues from GitHub...")
    issues = fetch_issues()

    if not issues:
        print("No issues found or error occurred")
        return

    print(f"Found {len(issues)} issues")

    # Ensure issues directory exists
    ISSUES_DIR.mkdir(parents=True, exist_ok=True)

    # Create/update individual issue files
    print("\nCreating/updating issue markdown files...")
    for issue in issues:
        number = issue['number']
        title = issue['title']
        filename = f"{number:03d}-{sanitize_filename(title)}.md"
        filepath = ISSUES_DIR / filename

        markdown = create_issue_markdown(issue)

        with open(filepath, 'w') as f:
            f.write(markdown)

        print(f"  ✓ {filepath}")

    # Create index
    print("\nCreating index...")
    index_content = create_index(issues)

    with open(README_PATH, 'w') as f:
        f.write(index_content)

    print(f"  ✓ {README_PATH}")

    print(f"\n✅ Successfully synced {len(issues)} issues to docs/issues/")

    # Auto-commit changes
    print("\nCommitting changes...")
    try:
        # Stage changes
        subprocess.run(['git', 'add', 'docs/issues/'], check=True, capture_output=True)

        # Create commit
        result = subprocess.run(
            ['git', 'commit', '-m', 'docs: sync GitHub issues'],
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
        print("\nNext steps:")
        print("  git push origin main")

    except subprocess.CalledProcessError as e:
        if b'nothing to commit' in e.stderr or 'nothing to commit' in str(e.stderr):
            print("  ℹ️  No changes to commit (issues already up to date)")
        else:
            print(f"  ⚠️  Git commit failed: {e}")
            print("\nManual steps:")
            print("  1. git add docs/issues/")
            print("  2. git commit -m 'docs: sync GitHub issues'")
            print("  3. git push origin main")

if __name__ == "__main__":
    main()
