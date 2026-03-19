# Requirements: Isometry v7.1 Notebook Card Editor

**Defined:** 2026-03-18
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.

## v7.1 Requirements

Requirements for Notebook Card Editor milestone. Each maps to roadmap phases.

### Card Editing

- [x] **EDIT-01**: User can edit a card's title inline in the Notebook panel and changes persist to cards.name
- [x] **EDIT-02**: User can edit a card's content in the Notebook panel and changes persist to cards.content (not ui_state)
- [x] **EDIT-03**: Notebook uses shadow-buffer architecture — snapshot on card load, mutable buffer during edit, single MutationManager mutation on commit (blur/switch/save)
- [x] **EDIT-04**: All card edits support undo/redo via MutationManager (Cmd+Z / Cmd+Shift+Z)
- [x] **EDIT-05**: Existing notebook:{cardId} data in ui_state is migrated to cards.content on first launch with sentinel guard (notebook:migration:v1)
- [x] **EDIT-06**: Card edits trigger CloudKit sync via existing dirty flag pipeline (mutated changeset dispatch)
- [x] **EDIT-07**: Notebook resets to idle state when the active card is deleted by undo (MutationManager subscriber safety)

### Card Creation

- [x] **CREA-01**: User can create a new card by typing in an empty Notebook panel — first meaningful input (non-whitespace name) triggers card creation
- [x] **CREA-02**: Card creation uses buffering state machine (idle → buffering → editing) to prevent ghost cards from IME composition, auto-correct, or accidental touches
- [x] **CREA-03**: New card is auto-selected in SelectionProvider after creation so Notebook binds to it immediately
- [x] **CREA-04**: New card triggers CloudKit changeset dispatch so it syncs to other devices
- [x] **CREA-05**: New card is visible in all active views immediately after creation (StateCoordinator re-query)

### Property Editors

- [ ] **PROP-01**: User can edit all 26 card fields via typed property inputs in the Notebook panel
- [ ] **PROP-02**: Text fields (name, content, summary, folder, status, url, mime_type, source, source_id, source_url, location_name) use text inputs
- [ ] **PROP-03**: Date fields (due_at, completed_at, event_start, event_end) use native date picker inputs
- [ ] **PROP-04**: Number fields (priority, sort_order, latitude, longitude) use number inputs with appropriate step/range
- [ ] **PROP-05**: Boolean field (is_collective) uses a toggle/checkbox
- [ ] **PROP-06**: Tags field uses a chip editor — user can add/remove tag pills with autocomplete from existing tags in the dataset
- [ ] **PROP-07**: Card type (card_type) is editable via a select dropdown (note/task/event/resource/person) — updateCard path extended to support card_type changes
- [ ] **PROP-08**: Each property edit creates a single undo step via updateCardMutation with correct before/after snapshots
- [ ] **PROP-09**: Null-safe coercion utility converts input values to correct SQL types (empty string → null for nullable fields, string → number for numeric fields, ISO format for dates)

### Card Dimensions

- [ ] **DIMS-01**: Cards render at 4 dimension levels: 1x (single-line row with icon + truncated title), 2x (icon + title + content preview), 5x (full card with header/content/collapsible properties), 10x (hero/full-page display)
- [ ] **DIMS-02**: Card dimension rendering is CSS-driven via data attributes, independent of SuperDensityProvider
- [ ] **DIMS-03**: User can switch card dimension via a control in the UI
- [ ] **DIMS-04**: Chosen dimension persists per view in ui_state

## Future Requirements

### Card Editor Enhancements

- **CENH-01**: Inline property editing from SuperGrid cells (double-click to edit)
- **CENH-02**: Card templates — presets for common card types with default property values
- **CENH-03**: Batch property editing — select multiple cards and edit a shared property
- **CENH-04**: Property visibility configuration — hide/show properties per card type

## Out of Scope

| Feature | Reason |
|---------|--------|
| In-grid cell editing | Cards have rich content; Notebook is the editor (D-locked out of scope) |
| Schema-on-read extras (EAV table) | Deferred per D-008; 26 fixed columns sufficient |
| Card relationship editing in Notebook | Connection CRUD is a separate concern; Notebook edits card fields only |
| Rich text editing (WYSIWYG) | Markdown + preview is the established pattern; contentEditable for formatting toolbar only |
| Drag-and-drop property reordering | Fixed property layout per card type for v7.1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EDIT-01 | Phase 91 | Complete |
| EDIT-02 | Phase 91 | Complete |
| EDIT-03 | Phase 91 | Complete |
| EDIT-04 | Phase 91 | Complete |
| EDIT-05 | Phase 91 | Complete |
| EDIT-06 | Phase 91 | Complete |
| EDIT-07 | Phase 91 | Complete |
| CREA-01 | Phase 92 | Complete |
| CREA-02 | Phase 92 | Complete |
| CREA-03 | Phase 92 | Complete |
| CREA-04 | Phase 92 | Complete |
| CREA-05 | Phase 92 | Complete |
| PROP-01 | Phase 93 | Pending |
| PROP-02 | Phase 93 | Pending |
| PROP-03 | Phase 93 | Pending |
| PROP-04 | Phase 93 | Pending |
| PROP-05 | Phase 93 | Pending |
| PROP-06 | Phase 93 | Pending |
| PROP-07 | Phase 93 | Pending |
| PROP-08 | Phase 93 | Pending |
| PROP-09 | Phase 93 | Pending |
| DIMS-01 | Phase 94 | Pending |
| DIMS-02 | Phase 94 | Pending |
| DIMS-03 | Phase 94 | Pending |
| DIMS-04 | Phase 94 | Pending |

**Coverage:**
- v7.1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 — Phase traceability mapped after roadmap creation*
