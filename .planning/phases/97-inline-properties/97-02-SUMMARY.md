# Phase 97-02: Hashtag Mark with Autocomplete

## Completed: 2026-02-14

## Summary

Implemented `#tag` syntax with autocomplete from existing tags and styled badge rendering.

## Deliverables

### 1. TagService
- **File**: `src/services/TagService.ts`
- **Purpose**: Query and cache tags from database
- **Features**:
  - `getAllTags()`: Query distinct tags from nodes.tags JSON array
  - `searchTags()`: Filter tags by prefix (case-insensitive)
  - 1-minute cache TTL for performance
  - Singleton instance for global use

### 2. HashtagExtension
- **File**: `src/components/notebook/editor/extensions/HashtagExtension.ts`
- **Purpose**: TipTap Mark with Suggestion plugin for hashtag autocomplete
- **Features**:
  - Trigger character: `#`
  - Autocomplete dropdown with existing tags
  - Renders as styled green badge
  - Commands: `setHashtag`, `unsetHashtag`

### 3. HashtagMenu Component
- **File**: `src/components/notebook/editor/HashtagMenu.tsx`
- **Purpose**: Dropdown menu for tag suggestions
- **Features**:
  - Keyboard navigation (up/down/enter/escape)
  - Click to select
  - Empty state message

### 4. useHashtagSync Hook
- **File**: `src/hooks/capture/useHashtagSync.ts`
- **Purpose**: Extract hashtags from editor for PropertyEditor sync
- **Features**:
  - Traverses document for hashtag marks
  - Debounced updates (500ms)
  - `syncNow()` for immediate extraction
  - Returns sorted unique tags

### 5. CSS Styles
- **File**: `src/index.css` (modified)
- **Added Styles**:
  - `.hashtag-menu`: Dropdown container
  - `.hashtag-menu__item`: Menu item with hover/selected states
  - `.hashtag-menu__tag`: Green tag styling

### 6. Integration
- **File**: `src/hooks/ui/useTipTapEditor.ts` (modified)
- **Changes**:
  - Added HashtagExtension with suggestion configuration
  - Added Tippy dropdown rendering
  - Added queryTags function using TagService

## Test Verification

```bash
npm run check:types  # Zero TypeScript errors
```

## Usage

Type in the editor:
```
#work
```
Dropdown appears with matching tags. Select to insert styled hashtag.

## Next Steps

- Wire useHashtagSync to PropertyEditor tags field
- Phase 98: Isometry Embeds & Polish
