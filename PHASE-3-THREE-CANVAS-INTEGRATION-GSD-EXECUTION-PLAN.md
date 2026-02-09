# Phase 3: Three-Canvas Integration - GSD Execution Plan

**Created:** February 8, 2025
**Timeline:** 2 weeks (10 working days)
**Domain:** Three-Canvas Notebook Architecture with SuperGrid Integration

## Executive Summary

Phase 3 completes the Three-Canvas Integration by implementing real Shell functionality (terminal + Claude API) and optimizing SuperGrid as the Preview centerpiece. Research confirms that **NotebookLayout.tsx is already operational** with responsive three-canvas container, **SuperGrid V5 is already embedded** in Preview canvas, and **cross-canvas communication is functional** via NotebookContext.

**Key Success Criteria:**
- ✅ Three-canvas layout operational (Capture, Shell, Preview)
- 🎯 Shell component gains real terminal + Claude API functionality (main work)
- ✅ SuperGrid serves as Preview canvas centerpiece (already implemented)
- ✅ Cross-canvas data flow maintains selection/context state (already working)

**Architecture Truth:** Build on existing foundation rather than rebuild. Focus enhancement over creation.

---

## Current State Assessment

### ✅ Already Complete (High Confidence)

| Component | Status | Evidence |
|-----------|--------|----------|
| **NotebookLayout.tsx** | ✅ Operational | Responsive layout, drag resize, focus management, keyboard shortcuts (Cmd+1/2/3) |
| **SuperGrid V5 Preview** | ✅ Embedded | Lines 315-334 in PreviewComponent.tsx, full PAFV integration |
| **Cross-Canvas Communication** | ✅ Functional | NotebookContext manages state, cell clicks update capture |
| **Responsive Design** | ✅ Working | Mobile/tablet stacking, desktop three-column with drag dividers |
| **Focus Management** | ✅ Implemented | FocusContext with keyboard navigation |

### 🎯 Needs Implementation (Phase 3 Focus)

| Component | Current State | Target |
|-----------|---------------|--------|
| **Shell Terminal** | Mock implementation | Real @xterm/xterm + node-pty |
| **Claude API Integration** | Stubbed hooks | Working @anthropic-ai/sdk |
| **Command Routing** | Placeholder | System vs AI command dispatch |
| **Command History** | None | Persistent history with search |

### 🔧 Optional Enhancements

| Component | Current State | Enhancement Option |
|-----------|---------------|-------------------|
| **Capture Component** | MDEditor working | TipTap upgrade (rich editing) |
| **Resize UX** | Functional | Smoother animations, snap zones |
| **Mobile Canvas Switching** | Stacking | Tab-based canvas priority |

---

## 2-Week Execution Plan

### Week 1: Core Shell Implementation (Days 1-5)

**Goal:** Transform Shell component from mock to fully functional terminal + AI integration

#### Day 1-2: Terminal Foundation (Phase 3.01)
**GSD Cycle:** Terminal Embedding
- **Scope:** Real terminal replaces mock interface
- **Files:** `package.json`, `src/hooks/useTerminal.ts`, `src/components/notebook/ShellComponent.tsx`
- **Dependencies:** `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links`, `node-pty`
- **Outcome:** User can execute system commands (`ls`, `pwd`, `echo`) in functional terminal

**Tasks:**
1. Install terminal emulator dependencies
2. Create `useTerminal` hook with lifecycle management
3. Replace mock terminal in `ShellComponent` with real xterm instance
4. Verify command execution and output display

**Quality Gate:** Terminal accepts keyboard input, displays formatted output, resizes properly

#### Day 3-4: Claude API Integration (Phase 3.02)
**GSD Cycle:** AI Command Execution
- **Scope:** Claude API integration with authentication
- **Files:** `src/hooks/useClaudeAPI.ts`, `src/types/shell.ts`, `src/utils/environmentSetup.ts`
- **Dependencies:** `@anthropic-ai/sdk`, `@types/node`
- **Outcome:** Infrastructure ready for AI command execution

**Tasks:**
1. Install Claude API SDK dependencies
2. Create shell types and Claude API hook
3. Create environment setup utility for API key management
4. **Checkpoint:** User configures API key and validates connection

**Quality Gate:** API key validation works, error handling provides helpful feedback

#### Day 5: Command Routing System (Phase 3.03)
**GSD Cycle:** Intelligent Command Dispatch
- **Scope:** Route commands to appropriate handler (system vs AI)
- **Files:** `src/hooks/useCommandRouter.ts`, `src/hooks/useProjectContext.ts`, `src/utils/commandParsing.ts`
- **Outcome:** Commands execute through correct handler with project context

**Tasks:**
1. Create command router with type detection
2. Implement project context hook for AI commands
3. Create command parsing utilities
4. Integrate router with Shell component

**Quality Gate:** System commands go to terminal, AI commands go to Claude API

### Week 2: History & Polish (Days 6-10)

#### Day 6-7: Command History (Phase 3.04)
**GSD Cycle:** Persistent Command History
- **Scope:** History management with persistence and navigation
- **Files:** `src/hooks/useCommandHistory.ts`, `src/utils/commandHistory.ts`, `src/types/shell.ts`
- **Outcome:** Full history system with search and navigation

**Tasks:**
1. Create command history hook with localStorage persistence
2. Add history utilities for search and filtering
3. Implement arrow key navigation in terminal
4. Add history indicators for command types

**Quality Gate:** History persists across sessions, arrow key navigation works

#### Day 8-9: SuperGrid Optimization & Cross-Canvas Polish
**GSD Cycle:** Preview Canvas Enhancement
- **Scope:** Optimize SuperGrid integration and data flow
- **Files:** `src/components/notebook/PreviewComponent.tsx`, `src/contexts/NotebookContext.tsx`
- **Outcome:** SuperGrid performs optimally as Preview centerpiece

**Tasks:**
1. Optimize SQL queries for SuperGrid performance
2. Enhance cell selection → Capture integration
3. Add SuperGrid → Shell context passing
4. Polish cross-canvas state synchronization

**Quality Gate:** SuperGrid selections update Capture smoothly, no re-render loops

#### Day 10: Integration Testing & Polish
**GSD Cycle:** End-to-End Validation
- **Scope:** Full three-canvas workflow testing
- **Outcome:** Production-ready three-canvas integration

**Tasks:**
1. End-to-end workflow testing (Capture → Shell → Preview)
2. Mobile/tablet responsive behavior validation
3. Performance testing with larger datasets
4. Documentation update and demo preparation

**Quality Gate:** Complete workflow functions smoothly across all screen sizes

---

## Detailed Plan Execution

### Phase 3.01: Terminal Embedding (Wave 1)

**Objective:** Replace mock terminal with functional @xterm/xterm integration

**Technical Scope:**
- Install: `@xterm/xterm@^5.3.0`, `@xterm/addon-fit@^0.8.0`, `node-pty@^1.0.0`
- Create: `useTerminal` hook with lifecycle management
- Transform: `ShellComponent` from mock to functional terminal
- Support: Process spawning, command execution, output display

**Success Criteria:**
- Terminal renders with proper theming and font
- User can execute basic commands: `pwd`, `ls`, `echo "test"`
- Terminal resizes with container changes
- Process cleanup on component unmount

**Risk Mitigation:**
- Test on both macOS and Windows development environments
- Fallback to mock terminal if node-pty fails to spawn process
- Clear error messages for permission/security issues

### Phase 3.02: Claude API Integration (Wave 2)

**Objective:** Integrate Claude API with secure authentication

**Technical Scope:**
- Install: `@anthropic-ai/sdk@^0.27.0`
- Create: Type definitions for shell commands and responses
- Implement: API key validation and environment setup
- Build: Error handling for rate limits, auth failures, network issues

**User Setup Required:**
1. Navigate to https://console.anthropic.com/account/keys
2. Create new API key
3. Set environment variable: `export ANTHROPIC_API_KEY=sk-ant-...`
4. Restart development server: `npm run dev`

**Success Criteria:**
- API key validation prevents unauthorized access
- Environment setup provides clear instructions
- Error messages guide user to proper configuration
- Foundation ready for command execution

**Risk Mitigation:**
- Graceful degradation when API unavailable
- Clear setup instructions prevent user frustration
- Rate limiting handling with retry suggestions

### Phase 3.03: Command Routing (Wave 3)

**Objective:** Intelligent command dispatch with project context

**Technical Scope:**
- Command type detection (system vs AI commands)
- Project context aggregation (active card, database state, file structure)
- Router integration with existing hooks
- Context injection for AI commands

**Command Detection Logic:**
```typescript
// System commands: direct terminal execution
ls, pwd, cd, npm, git, curl

// Claude commands: prefixed or natural language
claude "analyze this code"
ai: what does this function do?
ask: help me debug this error
```

**Success Criteria:**
- Commands route to appropriate handler
- AI commands receive project context
- System commands execute in correct working directory
- Clear feedback for command type and execution status

### Phase 3.04: Command History (Wave 4)

**Objective:** Persistent history with search and navigation

**Technical Scope:**
- localStorage persistence for command history
- Arrow key navigation (up/down for history)
- History search and filtering
- Type indicators for system vs AI commands

**History Features:**
- Persistent across browser sessions
- Search by command text or output
- Filter by command type (system/AI)
- Export/import functionality for backup

**Success Criteria:**
- History persists across sessions
- Arrow key navigation works in terminal
- Search finds relevant commands quickly
- Type indicators clear and helpful

---

## Quality Gates & Testing Strategy

### Continuous Quality Checks

**Every GSD Cycle:**
1. `npm run typecheck` → Zero TypeScript errors
2. `npm run test` → All tests pass
3. Manual testing in three-canvas layout
4. Cross-browser compatibility check (Chrome, Firefox, Safari)

### Phase-Specific Gates

**Phase 3.01 Gate:**
- Terminal accepts keyboard input
- Commands execute and show output
- Terminal resizes without breaking

**Phase 3.02 Gate:**
- API key validation working
- Error messages helpful and clear
- Environment setup documented

**Phase 3.03 Gate:**
- System commands → terminal
- AI commands → Claude API
- Project context passed correctly

**Phase 3.04 Gate:**
- History navigation functional
- Persistence working across sessions
- Search returns relevant results

### Performance Validation

**SuperGrid Performance:**
- Test with 1000+ nodes
- Verify 60fps during interactions
- Memory usage remains stable

**Cross-Canvas Performance:**
- No re-render loops during state updates
- Smooth animations during focus changes
- Responsive resize performance

**Terminal Performance:**
- Smooth scrolling with large output
- No input lag during command execution
- Clean process termination

---

## Risk Assessment & Mitigation

### High-Risk Areas

#### 1. Node-pty Process Spawning
**Risk:** Platform-specific compilation issues, permission problems
**Mitigation:**
- Test early on target platforms
- Provide fallback to web-based terminal simulator
- Clear setup documentation for development environment

#### 2. Claude API Rate Limiting
**Risk:** API quotas exceeded during development/testing
**Mitigation:**
- Implement exponential backoff with clear user feedback
- Local caching for repeated similar queries
- Development mode with mock responses

#### 3. Cross-Canvas State Synchronization
**Risk:** Race conditions causing infinite re-render loops
**Mitigation:**
- Use uni-directional data flow patterns
- Implement state ownership boundaries
- Add React strict mode testing

### Medium-Risk Areas

#### 4. Mobile Canvas Experience
**Risk:** Three canvases competing for limited mobile screen space
**Mitigation:**
- Implement canvas priority system for mobile
- Add swipe gestures for canvas switching
- Test on real mobile devices early

#### 5. Terminal Security
**Risk:** Arbitrary command execution in development environment
**Mitigation:**
- Limit terminal access to project directory
- Add command validation for sensitive operations
- Clear warnings about command execution scope

---

## Success Metrics

### Functional Metrics

**Primary:**
- ✅ User can execute system commands in functional terminal
- ✅ User can send AI commands to Claude API and receive responses
- ✅ SuperGrid cell selections update Capture canvas context
- ✅ Command history persists and navigation works

**Secondary:**
- Cross-canvas focus management with keyboard shortcuts
- Responsive behavior across mobile/tablet/desktop
- Terminal performance with large output
- API error handling with helpful messages

### Performance Metrics

**Terminal:**
- Command execution latency < 100ms for local commands
- Terminal scroll performance > 30fps with 1000+ lines
- Memory usage stable during extended session

**SuperGrid:**
- Grid rendering < 16ms for 500+ cells
- View transitions < 200ms
- Selection state updates < 50ms

**Cross-Canvas:**
- State synchronization < 50ms
- No memory leaks during extended usage
- Focus changes < 100ms

### User Experience Metrics

**Discoverability:**
- Keyboard shortcuts discoverable via help/tooltips
- Command type indicators clear and consistent
- Error messages actionable and helpful

**Workflow Integration:**
- Smooth transition from SuperGrid → Capture editing
- AI context automatically includes relevant project state
- History search finds commands quickly

---

## Dependencies & Prerequisites

### External Dependencies

**Required for Phase 3:**
```json
{
  "@xterm/xterm": "^5.3.0",
  "@xterm/addon-fit": "^0.8.0",
  "@xterm/addon-web-links": "^0.9.0",
  "node-pty": "^1.0.0",
  "@anthropic-ai/sdk": "^0.27.0",
  "@types/node": "^20.0.0"
}
```

**Already Available:**
- React 18 + TypeScript 5.2
- Tailwind CSS + shadcn/ui
- sql.js + SuperGrid V5
- NotebookContext + FocusContext

### Environment Setup

**Development Environment:**
- Node.js 18+ for node-pty compilation
- Python 3.x for native module compilation (Windows)
- Xcode command line tools (macOS)

**API Configuration:**
- Anthropic API key from console.anthropic.com
- Environment variable configuration
- Development vs production key management

### System Requirements

**Minimum:**
- 4GB RAM for development server + terminal processes
- 1GB disk space for dependencies
- Modern browser with WebAssembly support

**Recommended:**
- 8GB+ RAM for optimal performance
- SSD for fast dependency installation
- macOS/Linux for best node-pty compatibility

---

## Deliverables & Documentation

### Code Deliverables

**Week 1:**
- `src/hooks/useTerminal.ts` - Terminal lifecycle management
- `src/hooks/useClaudeAPI.ts` - Claude API integration
- `src/hooks/useCommandRouter.ts` - Command routing logic
- Updated `src/components/notebook/ShellComponent.tsx`

**Week 2:**
- `src/hooks/useCommandHistory.ts` - History management
- `src/utils/commandHistory.ts` - History persistence utilities
- Enhanced `src/components/notebook/PreviewComponent.tsx`
- Updated `src/contexts/NotebookContext.tsx`

### Documentation Updates

**Technical Documentation:**
- Shell component API documentation
- Command routing system architecture
- Cross-canvas communication patterns
- Performance optimization guidelines

**User Documentation:**
- Three-canvas workflow guide
- Keyboard shortcuts reference
- Command history usage
- Troubleshooting common issues

### Demo & Testing Artifacts

**Integration Demo:**
- Complete three-canvas workflow demonstration
- Shell command execution examples
- SuperGrid → Capture → Shell flow
- Mobile responsive behavior showcase

**Test Suite:**
- Unit tests for all new hooks
- Integration tests for cross-canvas communication
- End-to-end tests for complete workflows
- Performance regression tests

---

## Next Steps & Future Phases

### Immediate Post-Phase 3

**Phase 4: Platform & Tooling (Planned)**
- Tauri desktop shell wrapper
- GSD GUI visual interface
- Advanced MCP integration
- Production deployment automation

### Enhanced Features (Future)

**TipTap Capture Upgrade:**
- Rich text editing with collaborative features
- Enhanced slash commands with templates
- Real-time preview synchronization

**Advanced Shell Features:**
- Tab completion for custom commands
- Syntax highlighting in terminal
- Multi-session terminal management

**SuperGrid Enhancements:**
- Advanced filtering and search
- Custom visualization modes
- Export and sharing functionality

### Architecture Evolution

**Planned Improvements:**
- WebAssembly performance optimization
- Service worker for offline functionality
- Enhanced mobile touch interactions

**Long-term Vision:**
- Desktop app with native file system access
- Cloud synchronization and collaboration
- Plugin architecture for extensibility

---

## Conclusion

Phase 3 builds upon solid architectural foundations to deliver a complete three-canvas notebook integration. The 2-week timeline focuses on enhancing existing components rather than rebuilding infrastructure, with special emphasis on transforming the Shell component from mock to production-ready functionality.

**Success depends on:**
1. **Building incrementally** on proven NotebookLayout and SuperGrid foundations
2. **Quality-first execution** with continuous testing and validation
3. **User experience focus** ensuring smooth cross-canvas workflows
4. **Performance awareness** maintaining 60fps interactions throughout

The plan balances ambition with achievability, providing clear milestones and risk mitigation while delivering substantial user value through real terminal and AI integration capabilities.

---

*This execution plan provides the roadmap for transforming Isometry's three-canvas notebook from prototype to production-ready integration platform.*