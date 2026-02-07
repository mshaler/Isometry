# Phase 37: Grid Continuum - Discussion Template

**Instructions:** Work through each section below. Add your answers directly in this document, then point Claude to the completed file for context generation.

**Phase Boundary (FIXED):** Deliver seamless transitions between gallery, list, kanban, and grid projections of the same dataset with preserved user context.

---

## 1. Transition Mechanics

### Animation Style & Duration
- **Question:** What style of animation between view transitions? (Morph, fade, slide, zoom, or other?)
- **Answer:**

- **Question:** How long should transitions take? (Instant, 200ms, 500ms, user-configurable?)
- **Answer:**

- **Question:** Should animations be interruptible if user triggers another transition quickly?
- **Answer:**

- **Question:** Any specific easing curves or should we use standard CSS transitions?
- **Answer:**

---

## 2. Context Preservation (SuperPosition)

### Selection State
- **Question:** When switching from kanban to grid, should selected cards remain selected?
- **Answer:**

- **Question:** If a card is selected but not visible in the new view (due to filtering), what happens?
- **Answer:**

### Filter State
- **Question:** Should LATCH filters persist exactly across all view transitions?
- **Answer:**

- **Question:** What about view-specific filters (e.g., kanban column grouping vs grid axis assignment)?
- **Answer:**

### Scroll/Position State
- **Question:** How do we preserve "where the user was" when grid structure changes completely?
- **Answer:**

- **Question:** Should we track semantic position (focused card ID) rather than pixel coordinates?
- **Answer:**

---

## 3. View Switching Interface

### Trigger Mechanism
- **Question:** How does the user switch between views? Toolbar with view icons?
- **Answer:**

- **Question:** Should there be keyboard shortcuts (1=gallery, 2=list, 3=kanban, 4=grid, 5=supergrid)?
- **Answer:**

- **Question:** Any gesture support (pinch to zoom between view densities)?
- **Answer:**

- **Question:** Should view choice persist per dataset or be global?
- **Answer:**

---

## 4. Semantic Positioning

### Focus Tracking
- **Question:** When view structure changes, how do we keep the user oriented to the same logical content?
- **Answer:**

- **Question:** If switching from list (hierarchical) to grid (2D), how do we maintain the user's "place"?
- **Answer:**

- **Question:** Should we auto-scroll to keep the previously focused card in view after transition?
- **Answer:**

- **Question:** What happens if the focused card is filtered out in the new view?
- **Answer:**

---

## 5. View-Specific Behaviors

### Gallery View (0 explicit axes)
- **Question:** Gallery shows cards as icons - should it respect any LATCH sorting or just be chronological?
- **Answer:**

- **Question:** How many cards per row in gallery mode? Fixed grid or responsive?
- **Answer:**

### List View (1 axis hierarchical)
- **Question:** Which LATCH axis drives the list hierarchy by default?
- **Answer:**

- **Question:** Should list view show nested hierarchies (like folder trees) or flat lists?
- **Answer:**

### Kanban View (1 facet columns)
- **Question:** Which LATCH facet drives kanban columns by default? Status? Category?
- **Answer:**

- **Question:** Should kanban allow multiple swimlanes (rows) or just columns?
- **Answer:**

### 2D Grid (2 axes)
- **Question:** Default axis assignment for 2D grid? (Category × Time? Status × Priority?)
- **Answer:**

- **Question:** How do we handle empty cells in 2D grid? Show as blank or hide completely?
- **Answer:**

---

## 6. Data Consistency

### SQL Projection Changes
- **Question:** Each view needs different SQL - should the data query change or just the rendering?
- **Answer:**

- **Question:** How do we ensure the same cards appear consistently across views (no phantom additions/removals)?
- **Answer:**

### Performance
- **Question:** Should we pre-cache data for all views or query on-demand during transition?
- **Answer:**

- **Question:** Any special handling for large datasets (10k+ cards) during transitions?
- **Answer:**

---

## 7. Integration with Existing Features

### PAFV System
- **Question:** How do view transitions interact with existing PAFV axis assignments?
- **Answer:**

- **Question:** Should switching views reset PAFV assignments or try to adapt them?
- **Answer:**

### SuperGrid Features
- **Question:** When transitioning TO SuperGrid, should we preserve zoom/pan levels from previous sessions?
- **Answer:**

- **Question:** Should transition FROM SuperGrid back to simpler views remember the SuperGrid state for return?
- **Answer:**

---

## 8. Edge Cases & Error Handling

### Data Issues
- **Question:** What happens if transitioning to a view that can't display the current data (e.g., no time data for timeline)?
- **Answer:**

- **Question:** How do we handle views with insufficient LATCH dimensions for proper projection?
- **Answer:**

### User Experience
- **Question:** Should there be tooltips or hints explaining what each view shows?
- **Answer:**

- **Question:** Any preview mechanism to show what a view will look like before committing to the transition?
- **Answer:**

---

## Deferred Ideas Section

Use this space to capture any ideas that come up during discussion but belong in future phases:

**Ideas that should be separate phases:**
-

**Future enhancements to note:**
-

---

**When complete:** Point Claude to this file and request context generation from your answers.