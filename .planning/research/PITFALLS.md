# Domain Pitfalls

**Domain:** Hybrid note-taking/development tool with Claude Code integration
**Researched:** January 25, 2026

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Terminal Security Vulnerabilities
**What goes wrong:** Terminal embedding allows arbitrary command execution, potential security exploits
**Why it happens:** Terminal components inherit system privileges, inadequate sandboxing
**Consequences:** Security breaches, system compromise, user trust loss
**Prevention:**
- Implement command filtering and validation
- Use restricted shell environments
- Sandbox terminal processes with limited file system access
- Validate all Claude API responses before terminal execution
**Detection:** Unusual file system activity, unexpected network connections, privilege escalation attempts

### Pitfall 2: Claude API Rate Limiting and Cost Explosion
**What goes wrong:** Uncontrolled API calls lead to rate limiting or unexpected costs
**Why it happens:** Poor request management, no caching, excessive conversation context
**Consequences:** Service interruptions, budget overruns, degraded user experience
**Prevention:**
- Implement request queuing and rate limiting
- Cache responses for repeated queries
- Truncate conversation history intelligently
- Add usage monitoring and budget alerts
**Detection:** Sudden API cost spikes, 429 rate limit errors, degraded response times

### Pitfall 3: SQLite Schema Migration Hell
**What goes wrong:** Extensions to existing Isometry schema break backward compatibility
**Why it happens:** Schema changes without proper migrations, foreign key constraint violations
**Consequences:** Data loss, main app breakage, migration rollback requirements
**Prevention:**
- Use proper SQLite migration patterns with version tracking
- Test schema changes against existing data
- Maintain foreign key relationships carefully
- Implement rollback procedures
**Detection:** Foreign key constraint failures, missing data after migrations, main app query failures

## Moderate Pitfalls

Mistakes that cause delays or technical debt.

### Pitfall 1: Context State Explosion
**What goes wrong:** NotebookContext becomes overly complex with too many responsibilities
**Why it happens:** Adding features without clear separation of concerns
**Consequences:** Performance issues, difficult debugging, tight coupling
**Prevention:**
- Keep NotebookContext focused on coordination only
- Use separate contexts for component-specific state
- Implement proper memoization for context values

### Pitfall 2: Terminal Component Memory Leaks
**What goes wrong:** xterm.js instances not properly disposed, memory usage grows over time
**Why it happens:** Missing cleanup in React useEffect hooks
**Consequences:** Performance degradation, browser crashes, poor user experience
**Prevention:**
- Proper terminal disposal in cleanup functions
- Monitor memory usage in development
- Implement terminal instance recycling

### Pitfall 3: Three-Component Layout Complexity
**What goes wrong:** Complex responsive behavior, component sizing conflicts
**Why it happens:** Insufficient planning for responsive design, CSS grid/flexbox conflicts
**Consequences:** Poor mobile experience, layout breaks, maintenance burden
**Prevention:**
- Start with fixed layout, add responsiveness incrementally
- Use CSS Grid for main layout structure
- Test thoroughly on different screen sizes

### Pitfall 4: WKWebView vs React State Synchronization
**What goes wrong:** Browser component state gets out of sync with React state
**Why it happens:** Two separate execution contexts, async communication
**Consequences:** Inconsistent UI, data loss, user confusion
**Prevention:**
- Establish clear message passing protocols
- Use single source of truth for shared state
- Implement proper error handling for communication failures

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

### Pitfall 1: Markdown Editor Performance with Large Documents
**What goes wrong:** Editor becomes sluggish with large markdown files
**Why it happens:** Lack of virtualization, real-time preview rendering
**Prevention:**
- Implement document size limits
- Use debounced preview updates
- Consider lazy loading for large documents

### Pitfall 2: Claude API Response Parsing Errors
**What goes wrong:** Malformed API responses break the UI
**Why it happens:** Inadequate response validation, changing API formats
**Prevention:**
- Implement robust response parsing with fallbacks
- Add comprehensive error handling
- Validate response structure before processing

### Pitfall 3: Terminal Theme Inconsistency
**What goes wrong:** Terminal theme doesn't match Isometry themes
**Why it happens:** xterm.js has separate theming system
**Prevention:**
- Create theme mapping between Isometry and xterm.js
- Update terminal theme when main theme changes
- Test both NeXTSTEP and Modern themes

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Foundation | SQLite schema conflicts | Start with separate notebook_cards table, migrate carefully |
| Capture | Markdown editor integration complexity | Start simple with @uiw/react-md-editor defaults |
| Shell | Terminal security issues | Implement command filtering early |
| Shell | Claude API integration complexity | Start with basic request/response, add features incrementally |
| Preview | WKWebView communication issues | Use established message passing patterns |
| Integration | Context provider hierarchy conflicts | Test thoroughly with existing providers |

## Technology-Specific Pitfalls

### React + xterm.js Integration
**Common Issue:** React re-renders destroying terminal state
**Solution:** Use refs and careful useEffect dependencies
**Example:**
```typescript
// Bad: terminal recreated on every render
const Terminal = () => {
  const terminal = new XTerminal();
  return <div ref={ref} />;
};

// Good: terminal created once and persisted
const Terminal = () => {
  const terminalRef = useRef<XTerminal>();
  useEffect(() => {
    if (!terminalRef.current) {
      terminalRef.current = new XTerminal();
    }
    return () => terminalRef.current?.dispose();
  }, []);
};
```

### SQLite Schema Extension
**Common Issue:** Foreign key constraint violations when extending schema
**Solution:** Use proper migration patterns
**Example:**
```sql
-- Bad: Direct foreign key to nodes without existence check
ALTER TABLE notebook_cards ADD COLUMN node_id TEXT REFERENCES nodes(id);

-- Good: Proper migration with constraint handling
PRAGMA foreign_keys = OFF;
-- migration steps
PRAGMA foreign_keys = ON;
```

### Claude API Integration
**Common Issue:** Conversation context grows too large
**Solution:** Implement context window management
**Example:**
```typescript
// Bad: Accumulating unlimited conversation history
const conversation = [...previousMessages, newMessage];

// Good: Managed context window
const conversation = manageContextWindow(previousMessages, newMessage, MAX_TOKENS);
```

## Dependencies and Compatibility Risks

### Version Compatibility Matrix
| Library | Version | Risk Level | Notes |
|---------|---------|------------|-------|
| react-xtermjs | ^2.0.2 | Low | New library, active maintenance |
| @uiw/react-md-editor | ^4.0.4 | Low | Stable, frequent updates |
| @anthropic-ai/sdk | ^0.24.0 | Medium | API changes possible |
| xterm.js | ^5.3.0 | Low | Mature, stable API |

### Breaking Change Monitoring
- **Claude API**: Monitor for breaking changes in API responses
- **xterm.js**: Major version updates may require integration changes
- **React**: Future concurrent features may affect terminal integration
- **Safari/WKWebView**: iOS updates may change security policies

## Sources

- [xterm.js Security Considerations](https://xtermjs.org/docs/guides/security/) - HIGH confidence
- [React Context Performance](https://kentcdodds.com/blog/how-to-optimize-your-context-value) - HIGH confidence
- [SQLite Migration Best Practices](https://sqlite.org/lang_altertable.html) - HIGH confidence
- [WKWebView Security Model](https://developer.apple.com/documentation/webkit/wkwebview) - HIGH confidence
- [Anthropic Rate Limiting Guide](https://platform.claude.com/docs/en/api-limits) - HIGH confidence