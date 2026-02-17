# Phase 114: Contact Body Parser — Requirements

**Phase:** 114-contact-body-parser
**Milestone:** v7.0 ETL Enrichment
**Status:** READY
**Created:** 2026-02-17

## Goal

Parse contact markdown bodies to extract structured data (job title, email, phone) into `node_properties`, making contact-specific properties visible in the PAFV Navigator.

## Requirements

| ID | Priority | Requirement | Acceptance Criteria |
|----|----------|-------------|---------------------|
| 114-01 | P0 | Key-value parser | Parse `**Key:** Value` patterns into `node_properties` |
| 114-02 | P0 | Section awareness | Track current section to contextualize properties |
| 114-03 | P0 | Email extraction | Parse email lists (labeled and unlabeled) into `emails` array |
| 114-04 | P0 | Phone extraction | Parse phone lists (labeled and unlabeled) into `phones` array |
| 114-05 | P0 | Property classifier | `discoverDynamicProperties()` surfaces new properties |
| 114-06 | P1 | Job title | `job_title` property appears in Alphanumeric bucket |
| 114-07 | P1 | Organization | `organization` property appears in Category bucket |
| 114-08 | P2 | Address blocks | Parse multi-line address blocks |
| 114-09 | P2 | Social profiles | Parse social media links |

## Plans

### Plan 114-01: Contact Parser Implementation

**Deliverables:**
1. `src/etl/parsers/contact-body-parser.ts` — Main parser
2. `src/etl/parsers/contact-body-parser.test.ts` — Unit tests
3. Integration with `alto-importer.ts`

**Requirements covered:** 114-01, 114-02, 114-03, 114-04

### Plan 114-02: Property Classifier Integration

**Deliverables:**
1. Verify `discoverDynamicProperties()` finds new properties
2. Test Navigator shows contact-specific properties
3. Integration test with real contact data

**Requirements covered:** 114-05, 114-06, 114-07

## Success Metrics

| Metric | Target |
|--------|--------|
| Properties in Navigator (Contacts) | ≥5 |
| Parser accuracy | ≥95% of `**Key:** Value` patterns |
| Email extraction | ≥95% of emails captured |
| Phone extraction | ≥95% of phones captured |

## Dependencies

- v6.9 Phase 113 (Network Graph Integration) — Complete or parallel
- `node_properties` table schema (already exists)
- `property-classifier.ts` (already exists)

---
*Created: 2026-02-17*
