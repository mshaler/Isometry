# Todos

## Pending

- [ ] **NotebookExplorer: New Card Creation** — NotebookExplorer should support creating new cards, not just annotating existing ones. User expects "Card editor" = edit existing + create new. Needs a "New Card" action that inserts into cards table and refreshes Recent Cards list. (Captured: 2026-03-18, Source: v7.0 Phase 90 UAT)
- [ ] **SubscriptionManager.tierForProductID returns .pro for unknown products** — `tierForProductID("unknown.product")` returns `.pro` instead of `.free`. SubscriptionManagerTests/unknownProductReturnsFree() fails. Unknown product IDs should default to free tier. (Captured: 2026-03-24, Source: Phase 119 UAT)
