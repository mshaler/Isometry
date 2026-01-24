---
github_issue: 3
title: "P1.3: Sample Data Generation"
state: open
created: 2026-01-16
updated: 2026-01-16
labels: [mvp, phase-1, sqlite]
phase: phase-1
url: https://github.com/mshaler/Isometry/issues/3
---
# Issue #3: P1.3: Sample Data Generation

**Status:** OPEN
**GitHub:** [https://github.com/mshaler/Isometry/issues/3](https://github.com/mshaler/Isometry/issues/3)
**Created:** 2026-01-16
**Updated:** 2026-01-16

**Labels:** `mvp`, `phase-1`, `sqlite`

---

## Overview
Create realistic sample data for development and testing.

## Requirements
- [ ] 100+ sample notes with varied content
- [ ] Multiple folders (Work, Personal, Projects, etc.)
- [ ] Realistic date distribution (last 90 days)
- [ ] Some notes with tags
- [ ] Some notes with coordinates (for future Location filter)
- [ ] Priority distribution

## Data Generator
```typescript
// src/db/sample-data.ts
export const SAMPLE_NOTES = [
  {
    id: 'note-001',
    type: 'note',
    name: 'Q1 Planning Meeting Notes',
    content: 'Discussed roadmap priorities...',
    folder: 'Work',
    tags: ['meetings', 'planning'],
    priority: 5,
    created_at: '2026-01-10T14:30:00Z',
    modified_at: '2026-01-10T15:45:00Z',
  },
  // ... 99 more
];
```

## Deliverable
- `src/db/sample-data.ts` with 100+ records
- Seed function to populate database


---

## Related

- [[ISOMETRY-MVP-GAP-ANALYSIS]] - MVP Roadmap (Phase 1: Foundation)
- [[isometry-evolution-timeline]] - Project timeline
