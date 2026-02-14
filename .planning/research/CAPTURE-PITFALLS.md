# Domain Pitfalls: Rich Text Editor Features (TipTap)

**Domain:** Adding Apple Notes-style fluency, Notion-style commands, and Obsidian-style power features to TipTap
**Researched:** 2026-02-13
**Overall confidence:** HIGH (based on official TipTap docs, GitHub issues, and battle-tested implementations)

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or major UX failures.

### Pitfall 1: Extension Conflict — History vs Collaboration
**What goes wrong:** Installing Collaboration extension alongside StarterKit's History extension causes undo/redo conflicts, data corruption, and content duplication.
**Why it happens:** Both extensions attempt to manage the same transaction history state.
**Consequences:**
- Undo/redo operations become unpredictable
- Content can duplicate on every collaborative update
- Memory leaks from competing history tracking
- Corrupted document state requiring full reload
**Prevention:**
```typescript
// WRONG
StarterKit.configure({
  // history: true (default)
})
Collaboration.configure({...})

// CORRECT
StarterKit.configure({
  history: false  // TipTap 2
  // OR
  undoRedo: false  // TipTap 3
})
Collaboration.configure({...})
```
**Detection:** Test undo/redo behavior immediately after adding collaboration. If undo steps backward then forward, or content duplicates, History conflict exists.
**Status in Isometry:** ✅ No conflict — currently no Collaboration extension. FLAG for Phase 86+ if real-time collaboration added.

---

### Pitfall 2: Performance Death Spiral — React Re-Renders on Every Keystroke
**What goes wrong:** Without `shouldRerenderOnTransaction: false`, documents with 10,000+ characters experience 1-second lag per keystroke.
**Why it happens:** TipTap fires `onUpdate` on every transaction. Default React integration re-renders the entire component tree on each keystroke.
**Consequences:**
- Typing becomes unusable above 10K characters
- Performance degrades quadratically with node count (1500+ nodes)
- Users abandon long documents or switch to plain text
- Mobile devices become completely unusable
**Prevention:**
```typescript
// CRITICAL: Non-negotiable performance settings
useEditor({
  immediatelyRender: true,
  shouldRerenderOnTransaction: false,  // DO NOT SKIP THIS
  extensions: [...]
})
```
**Detection:**
- Create test document with 15,000 characters
- Type continuously for 10 seconds
- If lag is noticeable, `shouldRerenderOnTransaction` is missing
**Status in Isometry:** ✅ **CORRECTLY IMPLEMENTED** in `useTipTapEditor.ts` (lines 104-105). Document includes warning comments.

---

### Pitfall 3: Memory Leak — Editor Instance Not Destroyed
**What goes wrong:** Re-creating editor instances without destroying previous ones causes memory to balloon, crashing browser after 10-15 card switches.
**Why it happens:** DOM nodes retain references to editor. Extensions with event listeners (Mentions, BubbleMenu) prevent garbage collection.
**Consequences:**
- Memory usage grows by 50-100MB per editor instance
- Browser becomes sluggish after 10 card switches
- Mobile Safari crashes
- Tab eventually becomes unresponsive, requiring reload
**Prevention:**
```typescript
useEffect(() => {
  return () => {
    editor?.destroy();  // MUST call destroy on unmount
  };
}, [editor]);
```
**Detection:**
- Open DevTools Memory profiler
- Switch between 20 cards
- If memory doesn't drop after switching, leak exists
**Status in Isometry:** ⚠️ **VERIFY NEEDED** — TipTap's `useEditor` hook should auto-destroy, but custom extensions (SlashCommands, WikiLink) use Tippy.js instances. Check if Tippy instances are cleaned up in `onExit`.

---

### Pitfall 4: XSS Vulnerability — Unsanitized Paste from Clipboard
**What goes wrong:** Pasting HTML from clipboard executes arbitrary JavaScript via `onload` attributes, `<iframe srcdoc>`, or embedded `<script>` tags.
**Why it happens:** ContentEditable and rich text editors accept pasted HTML without sanitization. TipTap's default paste handling trusts clipboard content.
**Consequences:**
- Stored XSS exploits viewable by other users
- Session hijacking, data exfiltration
- Malicious payloads triggered when viewing cards in Preview pane
- Regulatory compliance violations (SOC2, GDPR)
**Prevention:**
```typescript
import DOMPurify from 'dompurify';

// Add custom paste handler extension
const SafePaste = Extension.create({
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          transformPastedHTML(html) {
            return DOMPurify.sanitize(html, {
              ALLOWED_TAGS: ['p', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'code', 'pre'],
              ALLOWED_ATTR: ['href', 'title']
            });
          }
        }
      })
    ];
  }
});
```
**Detection:**
- Paste: `<img src=x onerror="alert('XSS')">`
- If alert fires, paste sanitization missing
**Status in Isometry:** ❌ **NOT IMPLEMENTED** — TipTap uses default paste handling. **SECURITY GAP** for Phases 86+.

---

### Pitfall 5: Save Race Condition — Debounced Save + Card Switch
**What goes wrong:** Switching cards before debounced save completes causes content from Card A to overwrite Card B.
**Why it happens:**
1. User types in Card A
2. Debounce timer starts (2000ms)
3. User switches to Card B at 1500ms
4. Card B content loads into editor
5. Debounce timer fires at 2000ms, saving **Card B's content** with **Card A's ID**
**Consequences:**
- Silent data corruption
- Users lose content without realizing
- No error message — save appears successful
- Discovered days later when reopening cards
**Prevention:**
```typescript
// Auto-save current card BEFORE loading new one
useEffect(() => {
  const newCardId = selection.lastSelectedId;
  if (newCardId === activeCard?.id) return;

  if (isDirty) {
    saveNow().then(() => {  // ✅ Synchronous save before switch
      loadCard(newCardId);
    });
  } else {
    loadCard(newCardId);
  }
}, [selection.lastSelectedId]);
```
**Detection:**
- Type content in Card A
- Switch to Card B within 2 seconds
- Switch back to Card A
- If Card A shows Card B's content, race condition exists
**Status in Isometry:** ✅ **CORRECTLY IMPLEMENTED** in `CaptureComponent.tsx` (lines 129-150). Auto-saves before card switch.

---

### Pitfall 6: Modal Z-Index War — Slash Menu vs Dialog/Modal
**What goes wrong:** Slash command menu appears behind modals, property editors, or other floating UI, making commands invisible/unusable.
**Why it happens:**
- TipTap BubbleMenu/FloatingMenu uses Floating UI with default z-index (1)
- Tippy.js uses MuiPopper with z-index 3-4
- Application modals use z-index 1000-1300
- CSS specificity wars between libraries
**Consequences:**
- Commands invisible when Properties panel open
- Users can't access slash commands in certain contexts
- Mobile: native text selection overlays slash menu
- "Feature doesn't work" support tickets
**Prevention:**
```typescript
// Set explicit z-index hierarchy
tippy('body', {
  // ... other config
  zIndex: 1400,  // Above Material-UI Dialog (1300)
})

// OR in CSS
.tiptap-menu {
  z-index: 1400 !important;
}
```
**Detection:**
- Open Properties panel
- Type `/` to trigger slash commands
- If menu doesn't appear or is clipped, z-index conflict exists
**Status in Isometry:** ⚠️ **VERIFY NEEDED** — Slash menu uses Tippy.js (lines 137-145 in `useTipTapEditor.ts`). Test with Properties panel expanded.

---

## Moderate Pitfalls

Issues that degrade UX or cause frustration but don't require rewrites.

### Pitfall 7: Keyboard Shortcut Conflicts
**What goes wrong:** Extension keyboard shortcuts override each other or conflict with browser/OS shortcuts.
**Why it happens:** Multiple extensions bind to the same key combinations without priority ordering.
**Prevention:**
```typescript
// Use extension priority to control shortcut precedence
const CustomLink = Link.extend({
  priority: 1000,  // Higher priority = runs first
  addKeyboardShortcuts() {
    return {
      'Mod-k': () => this.editor.commands.setLink(),
    }
  }
})
```
**Common conflicts:**
- `Cmd+K`: Link vs Browser search
- `Cmd+B`: Bold vs Browser bookmarks (intercept with `event.preventDefault()`)
- `Shift+Enter`: Soft break vs extension commands
- `/`: Slash commands vs native search-in-page
**Status in Isometry:** ⚠️ **PARTIAL** — Global `Cmd+S` handled in `CaptureComponent.tsx` (line 244). No priority system for custom extensions yet.

---

### Pitfall 8: Slash Command Formatting Interference
**What goes wrong:** After typing `/`, rich text formatting buttons (bold, italic) format the command text itself, creating visual garbage.
**Why it happens:** Slash command trigger is inline text. Formatting applies to current selection/position.
**Prevention:**
```typescript
// Disable formatting buttons while slash menu active
const [isSlashMenuActive, setIsSlashMenuActive] = useState(false);

// In SlashCommands extension config
onStart: () => {
  setIsSlashMenuActive(true);
  // Disable toolbar buttons
}
onExit: () => {
  setIsSlashMenuActive(false);
}

// In toolbar
<button disabled={isSlashMenuActive} onClick={bold}>
  Bold
</button>
```
**Status in Isometry:** ❌ **NOT IMPLEMENTED** — `EditorToolbar` has no awareness of slash menu state.

---

### Pitfall 9: Slash Menu Broken Inside Code Blocks/Blockquotes
**What goes wrong:** Typing `/` inside code blocks or blockquotes doesn't trigger menu, or triggers but inserts at wrong position.
**Why it happens:** Suggestion plugin doesn't check node context. `/` can have semantic meaning inside code.
**Prevention:**
```typescript
// In suggestion config
allow: ({ editor, state }) => {
  const { schema, selection } = state;
  const { $from } = selection;

  // Don't trigger in code blocks or blockquotes
  if ($from.parent.type === schema.nodes.codeBlock ||
      $from.parent.type === schema.nodes.blockquote) {
    return false;
  }
  return true;
}
```
**Status in Isometry:** ⚠️ **VERIFY NEEDED** — SlashCommands extension in `extensions/` not fully reviewed. Check `allow` function.

---

### Pitfall 10: Mobile Keyboard Issues — Selection Overlays Menu
**What goes wrong:** On mobile, native text selection handles (blue circles) appear above slash menu, blocking interaction.
**Why it happens:** Mobile browsers render selection UI at higher z-index than DOM elements. No CSS can override.
**Prevention:**
- Use `user-select: none` on menu container
- Detect mobile and position menu away from selection
- Consider modal overlay instead of floating menu on mobile
```typescript
// Mobile-specific menu positioning
if (isMobile) {
  popup = tippy('body', {
    placement: 'top',  // Above selection instead of below
    offset: [0, 20],
  });
}
```
**Status in Isometry:** ❌ **NOT IMPLEMENTED** — Desktop-first. Mobile support deferred.

---

### Pitfall 11: Undo/Redo Confusion After Slash Commands
**What goes wrong:** After inserting content via slash command, pressing Undo removes the inserted content AND the text typed before the command.
**Why it happens:** Slash command executes as a single transaction. Undo collapses multiple operations.
**Prevention:**
```typescript
// Create undo boundary before slash command insertion
editor.chain()
  .focus()
  .insertContent(content)
  .command(({ tr }) => {
    tr.setMeta('addToHistory', true);  // Force history boundary
    return true;
  })
  .run();
```
**Status in Isometry:** ⚠️ **VERIFY NEEDED** — Slash commands in `extensions/SlashCommands.ts` need transaction metadata review.

---

## Minor Pitfalls

Polish issues that reduce fluency but don't break core functionality.

### Pitfall 12: Slash Menu Disappears on Typos
**What goes wrong:** Menu vanishes if user types invalid command. Must delete and re-type `/`.
**Why it happens:** Fuzzy matching not implemented. Suggestion filter returns empty array.
**Prevention:**
- Implement fuzzy search (Fuse.js)
- Keep menu open with "No commands found" message
- Show closest matches even with typos
**Status in Isometry:** ⚠️ **UNKNOWN** — Depends on suggestion filter implementation. Shows "No commands found" UI (SlashCommandMenu.tsx line 67), but unclear if menu stays open.

---

### Pitfall 13: WikiLink Creation Lag on Large Databases
**What goes wrong:** Typing `[[` causes 500ms+ delay before menu appears when database has 10,000+ cards.
**Why it happens:** `queryCardsForSuggestions` runs full table scan or unindexed FTS5 query.
**Prevention:**
```sql
-- Create FTS5 index on card names
CREATE VIRTUAL TABLE nodes_fts USING fts5(name, summary);

-- Limit query to recent + top matches
SELECT * FROM nodes_fts
WHERE nodes_fts MATCH ?
ORDER BY rank
LIMIT 10;
```
**Status in Isometry:** ✅ **FTS5 EXISTS** — Schema includes `nodes_fts` table. Verify query in `utils/editor/backlinks.ts` uses LIMIT.

---

### Pitfall 14: Keyboard Navigation Breaks with Scroll
**What goes wrong:** Selected item in slash menu scrolls out of view when navigating with arrow keys.
**Why it happens:** Arrow key handler updates state but doesn't call `scrollIntoView()`.
**Prevention:**
```typescript
useEffect(() => {
  const element = document.querySelector(`[data-index="${selectedIndex}"]`);
  element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}, [selectedIndex]);
```
**Status in Isometry:** ❌ **NOT IMPLEMENTED** — `SlashCommandMenu.tsx` updates `selectedIndex` but doesn't scroll.

---

## Integration Pitfalls (Isometry-Specific)

### Pitfall 15: Markdown Serialization vs ProseMirror JSON Mismatch
**What goes wrong:** Content stored as plain text (`editor.getText()`) loses formatting. Or: storing ProseMirror JSON breaks search.
**Why it happens:** TipTap supports both formats. Choosing wrong format for storage.
**Consequences:**
- `getText()`: Loses **all** formatting (bold, links, lists)
- ProseMirror JSON: Not FTS5-searchable, not human-readable
- HTML export: Security risk, bloated storage
**Prevention:**
```typescript
// CORRECT: Store as Markdown (best of both worlds)
import { generateMarkdown } from '@tiptap/markdown';

const markdown = editor.storage.markdown.getMarkdown();

// On load
editor.commands.setContent(markdownContent, {
  emitUpdate: false  // Don't trigger save
});
```
**Status in Isometry:** ⚠️ **LOSSY STORAGE** — Currently using `editor.getText()` (line 250, 267 in `useTipTapEditor.ts`). **TODO comment acknowledges this** (line 249, 266). `@tiptap/markdown` installed but not used. **HIGH PRIORITY FIX** for Phase 86.

---

### Pitfall 16: Auto-Save Thrashing on PropertyEditor Updates
**What goes wrong:** Updating properties in PropertyEditor triggers TipTap `onUpdate`, causing double-saves and race conditions.
**Why it happens:** Property updates modify `activeCard`, which triggers TipTap content reload, which fires `onUpdate`.
**Prevention:**
```typescript
// Use ref to suppress onUpdate during property changes
const isPropertyUpdateRef = useRef(false);

// In PropertyEditor onChange
isPropertyUpdateRef.current = true;
updateCard(cardId, { properties });
setTimeout(() => { isPropertyUpdateRef.current = false; }, 0);

// In TipTap onUpdate
onUpdate: ({ editor }) => {
  if (isPropertyUpdateRef.current) return;  // Skip
  // ... save logic
}
```
**Status in Isometry:** ⚠️ **VERIFY NEEDED** — `propertyUpdateCount` state exists (CaptureComponent.tsx line 99) but doesn't gate TipTap saves. Check for thrashing.

---

### Pitfall 17: Custom Event Coupling — SlashCommands → CaptureComponent
**What goes wrong:** Using `window.dispatchEvent` creates hidden coupling. Events fire even when Capture pane unmounted.
**Why it happens:** Global event bus pattern convenient but lacks lifecycle management.
**Prevention:**
```typescript
// Option A: Pass callbacks directly to extensions
SlashCommands.configure({
  onSaveCard: (markdown) => handleSaveCard(markdown),
  onSendToShell: (content) => handleSendToShell(content)
})

// Option B: Use context
<EditorCommandContext.Provider value={{ handleSaveCard, handleSendToShell }}>
  <TipTapEditor />
</EditorCommandContext.Provider>
```
**Status in Isometry:** ⚠️ **LOOSE COUPLING** — Lines 194, 216-217 in `CaptureComponent.tsx` use custom events. Works but fragile. Consider refactor if adding more commands.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **Phase 86: Rich Formatting** | Markdown serialization lossy (Pitfall 15) | Implement `@tiptap/markdown` immediately. Test round-trip: TipTap → Markdown → TipTap. |
| **Phase 86: Keyboard Fluency** | Shortcut conflicts with browser (Pitfall 7) | Audit all shortcuts. Add priority system. Document unavailable shortcuts (e.g., Cmd+W). |
| **Phase 86: Slash Commands++** | Menu z-index wars when Properties open (Pitfall 6) | Test all z-index combinations. Set Tippy z-index: 1400. |
| **Phase 87: Wiki-Links** | FTS5 query lag on 10K+ cards (Pitfall 13) | Add LIMIT 10 to backlinks query. Test with 50,000-card database. |
| **Phase 87: Backlinks** | Link creation without edge records (Data integrity) | `createLinkEdge` already exists (`useTipTapEditor.ts` line 72). Ensure called on every `[[link]]` insertion. |
| **Phase 88: Templates** | Template insertion breaks undo (Pitfall 11) | Set `addToHistory: true` in template insertion transaction. |
| **Phase 88: Smart Blocks** | Extension transaction ordering conflicts (Pitfall 17) | Use `priority` on all custom extensions. Higher priority = earlier execution. |
| **Future: Collaboration** | History vs Collaboration conflict (Pitfall 1) | Disable StarterKit undoRedo. Test undo immediately. |
| **Future: Mobile** | Selection UI overlays menus (Pitfall 10) | Redesign for mobile: modal overlays instead of floating menus. |

---

## Testing Checklist: "Looks Done But Isn't"

Before marking any editor feature complete, verify:

- [ ] **Performance**: Tested with 25,000-character document (should type smoothly)
- [ ] **Memory**: Switch between 20 cards, memory returns to baseline
- [ ] **Race conditions**: Type content, switch cards within 2 seconds, verify no data loss
- [ ] **Undo/Redo**: After slash command insertion, undo only removes insertion (not prior typing)
- [ ] **Keyboard conflicts**: All shortcuts work in Electron/Tauri shell (not just browser)
- [ ] **Z-index**: Slash menu visible when Properties panel open, modals open, other floating UI present
- [ ] **Paste security**: Paste `<img src=x onerror="alert('XSS')">` — no alert should fire
- [ ] **Mobile (if applicable)**: Slash menu usable on iOS Safari, Android Chrome
- [ ] **Edge cases**: Slash commands work in first line, last line, inside lists, after images
- [ ] **Formatting**: Bold, italic, links survive round-trip through Markdown storage
- [ ] **FTS5 search**: Formatted content still searchable (proves Markdown storage working)

---

## Warning Signs (Detect Issues Early)

| Warning Sign | Indicates | Action |
|--------------|-----------|--------|
| Browser DevTools shows 100MB+ "Detached DOM trees" | Memory leak (Pitfall 3) | Add editor.destroy(), audit Tippy cleanup |
| Typing lag increases over time in same session | Re-render on transaction (Pitfall 2) | Verify `shouldRerenderOnTransaction: false` |
| Undo removes more than expected | Transaction boundary issue (Pitfall 11) | Add `addToHistory` metadata |
| Slash menu sometimes invisible | Z-index conflict (Pitfall 6) | Audit all z-index values, test with all panes open |
| Card content "swaps" between cards | Save race condition (Pitfall 5) | Add synchronous save before card switch |
| Search finds cards but not content | Lossy serialization (Pitfall 15) | Implement Markdown storage ASAP |
| Bold/Italic buttons active during slash commands | Formatting interference (Pitfall 8) | Track slash menu state, disable toolbar |

---

## Sources

### TipTap Official Documentation (HIGH confidence)
- [Integration performance](https://tiptap.dev/docs/guides/performance) — Performance best practices
- [Extensions configuration](https://tiptap.dev/docs/editor/getting-started/configure) — Extension conflicts
- [Keyboard shortcuts](https://tiptap.dev/docs/editor/core-concepts/keyboard-shortcuts) — Shortcut conflicts
- [Extension API](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension) — Priority and transaction ordering
- [BubbleMenu extension](https://tiptap.dev/docs/editor/extensions/functionality/bubble-menu) — Z-index issues

### TipTap GitHub Issues (HIGH confidence)
- [Issue #4491: Editor notoriously slow with large content](https://github.com/ueberdosis/tiptap/issues/4491) — Performance degradation
- [Issue #5031: Performance issue with large documents](https://github.com/ueberdosis/tiptap/issues/5031) — Vue 2→3 migration slowdown
- [Issue #5654: Memory leak when discarding editors](https://github.com/ueberdosis/tiptap/issues/5654) — Memory leak root cause
- [Issue #2547: Potential memory leak with mentions](https://github.com/ueberdosis/tiptap/issues/2547) — Extension-specific leak
- [Issue #265: LinkBubbleMenu not displayed in MUI Dialog](https://github.com/sjdemartini/mui-tiptap/issues/265) — Z-index modal conflicts
- [Issue #8415: Sticky toolbar hides bubble menu](https://github.com/mantinedev/mantine/issues/8415) — TipTap 3 z-index regression
- [Discussion #2871: How to save with delay](https://github.com/ueberdosis/tiptap/discussions/2871) — Debounce best practices
- [Discussion #5677: Efficient database saving](https://github.com/ueberdosis/tiptap/discussions/5677) — Save patterns

### Liveblocks Guides (MEDIUM confidence)
- [TipTap best practices and tips](https://liveblocks.io/docs/guides/tiptap-best-practices-and-tips) — History vs Collaboration conflict

### ContentEditable Research (MEDIUM confidence)
- [Why ContentEditable is Terrible (Medium Engineering)](https://medium.engineering/why-contenteditable-is-terrible-122d8a40e480) — Mobile keyboard issues
- [ContentEditable — The Good, the Bad and the Ugly (CKEditor)](https://ckeditor.com/blog/ContentEditable-The-Good-the-Bad-and-the-Ugly/) — Cross-browser issues

### Security Research (HIGH confidence)
- [XSS when pasting HTML (Joplin CVE)](https://github.com/laurent22/joplin/security/advisories/GHSA-m59c-9rrj-c399) — Paste XSS vulnerability
- [How to Prevent XSS in React Rich Text Editor (Syncfusion)](https://www.syncfusion.com/blogs/post/react-rich-text-editor-xss-prevention) — DOMPurify sanitization
- [$1,000 Bounty: Stored XSS in Trix Editor (Medium)](https://medium.com/h7w/1-000-bounty-stored-xss-in-trix-editor-v2-1-1-via-malicious-paste-payload-4fa413fcde28) — Real-world XSS exploit

### Slash Commands UX (MEDIUM confidence)
- [Element-Web Issue #30801: Rich text editor formatting slash commands](https://github.com/element-hq/element-web/issues/30801) — Formatting interference
- [Configuring TinyMCE slash commands](https://www.tiny.cloud/blog/slash-commands-rich-text-editor/) — UX best practices

### Apple Notes UX Research (LOW confidence)
- [Easy Ways to Undo in Apple Notes (Challix)](https://challix.com/blogs/apple-tips-tricks/how-to-undo-and-redo-in-the-notes-app) — Discoverability issues
- [How to Undo in Notes on Mac (Macpaw)](https://macpaw.com/how-to/undo-in-notes-on-mac) — Multiple undo methods confusion

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Extension Conflicts** | HIGH | Verified in official TipTap docs and migration guides |
| **Performance** | HIGH | Multiple GitHub issues confirm `shouldRerenderOnTransaction: false` critical |
| **Memory Leaks** | HIGH | Root cause identified in GitHub issue #5654 with reproduction steps |
| **XSS Security** | HIGH | CVEs and bounty reports provide concrete exploit examples |
| **Save Race Conditions** | HIGH | Common pattern in debounced save implementations |
| **Z-Index Issues** | HIGH | Documented in multiple UI framework integrations |
| **Keyboard Conflicts** | MEDIUM | General rich text editor issue, less TipTap-specific documentation |
| **Mobile Issues** | MEDIUM | ContentEditable research applicable, but TipTap-specific testing needed |
| **Slash Command UX** | MEDIUM | Patterns from other editors, not TipTap-native research |
| **Isometry Integration** | HIGH | Based on direct code review of existing implementation |

---

## Recommendations for Roadmap

### Immediate (Phase 86 Start)
1. **Fix Markdown serialization** (Pitfall 15) — Currently losing formatting on save
2. **Add paste sanitization** (Pitfall 4) — Security vulnerability
3. **Verify memory cleanup** (Pitfall 3) — Tippy.js instances in custom extensions

### Before Phase 86 Complete
4. **Implement keyboard shortcut priority** (Pitfall 7) — Prevent future conflicts
5. **Test slash menu z-index** (Pitfall 6) — With all panes/modals
6. **Add scroll-into-view** for keyboard navigation (Pitfall 14) — Polish

### Phase 87+ (As Features Added)
7. **LIMIT backlinks queries** (Pitfall 13) — Scalability
8. **Add undo boundaries** to slash commands (Pitfall 11) — UX fluency
9. **Disable toolbar during slash menu** (Pitfall 8) — Prevent formatting garbage

### Future (Collaboration/Mobile)
10. **Test History vs Collaboration** immediately (Pitfall 1) — Data corruption risk
11. **Redesign menus for mobile** (Pitfall 10) — Modal overlays, not floating

---

**Next Steps for Roadmap Creation:**
- Phase 86 should include Markdown serialization fix as **P0 blocker**
- Phase 86 should include paste sanitization as **security requirement**
- Phase 87 should verify memory cleanup before adding more extensions
- Phase 88 should implement keyboard priority system before complex shortcuts
- All phases: Use testing checklist above for acceptance criteria
