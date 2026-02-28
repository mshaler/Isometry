# Isometry v5 Data Explorer Specification

## Overview

Data Explorer is Isometry's ETL subsystem handling import, export, sync, and the Data Catalog.

## Import Formats

| Format | Extensions | Library |
|--------|------------|---------|
| Markdown | `.md` | gray-matter |
| Excel | `.xlsx`, `.xls` | xlsx |
| Word | `.docx` | mammoth |
| JSON | `.json` | native |
| HTML | `.html` | turndown |
| CSV | `.csv`, `.tsv` | papaparse |
| Alto-Index | JSON bundle | custom (Apple Notes) |

## Canonical Node Schema

All imports map to unified LATCH fields:
- **L**: latitude, longitude, location_name
- **A**: name (primary sort)
- **T**: created_at, modified_at, due_at, event_start, event_end
- **C**: card_type, folder, tags, status
- **H**: priority, importance, sort_order

## Architecture

- **TypeScript**: File-based ETL (MD, XLSX, JSON, HTML, CSV)
- **Swift**: System frameworks (EventKit, Contacts, Apple Notes live)
- **Canonical schema**: All sources → CanonicalNode → sql.js

## Data Catalog

| Component | Description |
|-----------|-------------|
| Settings | User preferences |
| Templates | Card/view templates |
| CAS | Content-addressable storage |
| Apps | Published Isometry apps |

## Key Principles

1. All data flows through CanonicalNode schema
2. Source tracking for deduplication
3. Idempotent imports (re-import updates, doesn't duplicate)
