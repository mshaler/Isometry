# Phase 114: Contact Body Parser — Research

**Phase:** 114-contact-body-parser
**Milestone:** v7.0 ETL Enrichment
**Status:** RESEARCHED
**Created:** 2026-02-17

## Problem Discovery

During ETL verification, we discovered that Alto-Index Contacts store structured data in **markdown bodies**, not frontmatter. The current ETL only extracts frontmatter keys, so contact-specific properties never reach `node_properties` or the PAFV Navigator.

### Sample Contact File

```markdown
---
title: "Andrew Quinlan"
contact_id: "B7D7D243-7259-487D-BFF7-B2A1F21FECAD:ABPerson"
organization: "Conga"
link: "addressbook://B7D7D243-7259-487D-BFF7-B2A1F21FECAD:ABPerson"
last_modified: 2026-02-17T17:16:13Z
---

# Andrew Quinlan

## Professional

**Organization:** Conga
**Title:** Vice President, Global OEM/ISV Program

## Email Addresses

- **:** drew.quinlan@gmail.com
```

### What Gets Extracted Today

| Source | Field | Destination | Status |
|--------|-------|-------------|--------|
| Frontmatter | `title` | `nodes.name` | ✅ Extracted |
| Frontmatter | `organization` | `nodes.folder` | ✅ Extracted |
| Frontmatter | `contact_id` | Skipped (KNOWN_KEY) | ✅ Correct |
| Frontmatter | `link` | `node_properties.link` | ✅ Extracted |
| Body | `**Title:** ...` | ❌ NOT extracted | Gap |
| Body | Email addresses | ❌ NOT extracted | Gap |
| Body | Phone numbers | ❌ NOT extracted | Gap |

### Current Navigator State (Contacts Dataset)

| Bucket | Count | Properties |
|--------|-------|------------|
| Location | 0/0 | No properties |
| Alphanumeric | 1/1 | Name |
| Time | 2/2 | Created, Modified |
| Category | 2/2 | Folder, Tags |
| Hierarchy | 1/1 | Subfolder |
| Graph | 0/6 | (disabled) |

**Missing:** Job Title, Email, Phone, Company (all in body, not frontmatter)

## Alto-Index Contact Body Patterns

Based on sample analysis, contacts follow these patterns:

### Section Headers
```markdown
## Professional
## Email Addresses
## Phone Numbers
## Addresses
## Social Profiles
## Notes
```

### Key-Value Patterns
```markdown
**Organization:** Company Name
**Title:** Job Title
**Department:** Department Name
```

### List Patterns
```markdown
## Email Addresses
- **Work:** email@work.com
- **Home:** email@home.com
- unlabeled@email.com

## Phone Numbers
- **Mobile:** +1-555-1234
- **Work:** +1-555-5678
```

### Address Block Pattern
```markdown
**Home:**
123 Main Street
City, State 12345
Country
```

## Implementation Strategy

### Parser Approach

1. **Section-aware parsing** — Track current section (`## Professional`, `## Email Addresses`)
2. **Key-value extraction** — Match `**Key:** Value` patterns
3. **List item extraction** — Match `- **Label:** Value` and `- Value` patterns
4. **Multi-line handling** — Address blocks span multiple lines

### Property Naming Convention

| Body Pattern | Property Key | LATCH Bucket |
|--------------|--------------|--------------|
| `**Title:** X` | `job_title` | A (Alphanumeric) |
| `**Organization:** X` | `organization` | C (Category) |
| `**Department:** X` | `department` | C (Category) |
| Email in list | `emails` (array) | A (Alphanumeric) |
| Phone in list | `phones` (array) | A (Alphanumeric) |
| Address block | `addresses` (array of objects) | L (Location) |

### Existing Code to Leverage

- `src/etl/storage/property-storage.ts` — `storeNodeProperties()` already handles typed values
- `src/services/property-classifier.ts` — `discoverDynamicProperties()` surfaces `node_properties`
- `src/etl/alto-parser.ts` — `parseFrontmatter()` pattern for markdown parsing

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/etl/parsers/contact-body-parser.ts` | CREATE | Parse contact body patterns |
| `src/etl/parsers/contact-body-parser.test.ts` | CREATE | Unit tests |
| `src/etl/alto-importer.ts` | MODIFY | Call body parser after frontmatter |
| `src/etl/storage/property-storage.ts` | MODIFY | Handle array values properly |

## Test Data

Located at:
```
~/Library/Containers/com.altoindex.AltoIndex/Data/Documents/alto-index/contacts/
```

Sample files:
- `Andrew-Quinlan.md` — Has Professional section with Title
- `Cathy-Meador.md`
- `DK-Smith.md`

Count: ~5,345 contact files

## Success Criteria

- [ ] Parse `**Key:** Value` patterns from all sections
- [ ] Extract email addresses (labeled and unlabeled)
- [ ] Extract phone numbers (labeled and unlabeled)
- [ ] Store as typed values in `node_properties`
- [ ] Properties appear in LatchNavigator for Contacts dataset
- [ ] ≥5 properties visible in Navigator

---
*Researched: 2026-02-17*
*Source: Live debugging session with Playwright + ETL code review*
