# RFC 002: Visual Progress Indication for Deep Research

> **Status**: Draft
> **Created**: 2026-02-03
> **Author**: @QLBQLB
> **Issue**: #2

---

## Summary

Add real-time progress indication for Deep Research mode to improve user experience during concurrent search operations. Users currently wait 10-20 seconds with no feedback, causing anxiety and uncertainty about whether the system is working.

---

## Motivation

### Current State
- Deep Research mode takes 10-20 seconds
- No progress feedback during execution
- Users may wonder if the system is stuck
- No visibility into which engines are being queried

### Desired State
- Clear progress indication for each engine
- Real-time status updates
- Estimated completion time
- Visual feedback during deduplication

---

## Proposed Design

### Progress Display Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Deep Research Mode: "Rust 2025 adoption trends"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[████████████████████░░░░] 60% (3/5 engines)

✓ Exa        - 5 results  (3.2s) [Code/API Docs]
✓ Brave      - 6 results  (1.8s) [News]
✓ Metaso     - 4 results  (2.1s) [Academic]
⏳ GitHub    - scanning...        [Repositories]
⏸ Bocha      - queued            [Chinese]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ Aggregating & deduplicating results...

ETA: ~4 seconds
```

### Progress Callback Interface

```typescript
interface ProgressCallback {
  // Called when starting a new search operation
  onStart?(mode: SearchMode, query: string, totalEngines: number): void

  // Called when an engine starts processing
  onEngineStart?(engine: string, index: number): void

  // Called when an engine completes
  onEngineComplete?(engine: string, count: number, time: number): void

  // Called when an engine fails
  onEngineError?(engine: string, error: string): void

  // Called when deduplication starts
  onDeduplicationStart?(originalCount: number): void

  // Called when deduplication completes
  onDeduplicationComplete?(stats: DedupStats): void

  // Called when entire operation completes
  onComplete?(totalTime: number, resultCount: number): void
}

interface SearchProgress {
  mode: 'quick' | 'deep' | 'mode-a' | 'mode-r' | 'mode-t' | 'mode-f'
  query: string
  startTime: Date
  engines: {
    name: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    resultCount?: number
    time?: number
    error?: string
  }[]
  currentPhase: 'searching' | 'deduplicating' | 'complete'
}

```

### MCP Tool Integration

Add new tool to `search-aggregator`:

```typescript
tool: {
  name: "search_with_progress",
  description: "Execute search with real-time progress updates",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
      mode: { type: "string", enum: ["quick", "deep", "mode-a", "mode-r", "mode-t", "mode-f"] },
      progressCallback: { type: "string", description: "Callback URL or handler" }
    }
  }
}
```

---

## Implementation Plan

### Phase 1: Progress Tracking
- [ ] Create `ProgressTracker` class in `src/progress.ts`
- [ ] Define progress state structure
- [ ] Implement progress update methods

### Phase 2: MCP Integration
- [ ] Add progress reporting to existing tools
- [ ] Create new `search_with_progress` tool
- [ ] Add progress streaming support

### Phase 3: Smart-Search Integration
- [ ] Update SKILL.md with progress display format
- [ ] Add hooks for progress rendering
- [ ] Create default progress template

### Phase 4: UI/UX Polish
- [ ] Add estimated time calculation
- [ ] Add error state display
- [ ] Add cancellation support

---

## Progress Display Levels

### Minimal (for CLI environments)
```
Searching: Exa ✓ Brave ✓ Metaso ⏳ GitHub ⏸ (3/5)
```

### Standard (default)
```
[████████████████░░░░] 60% (3/5 engines)
✓ Exa (5) ✓ Brave (6) ✓ Metaso (4) ⏳ GitHub ⏸ Bocha
```

### Verbose (for debugging)
```
Engine: Exa
  Status: ✓ Complete
  Results: 5
  Time: 3247ms
  URL: https://example.com/search?q=...

Engine: Brave
  Status: ✓ Complete
  Results: 6
  Time: 1842ms
  ...
```

---

## Configuration

```yaml
# config.yml
progress:
  enabled: true
  display_level: standard  # minimal | standard | verbose
  update_interval: 500ms   # Progress update frequency
  show_eta: true
  show_result_counts: true
```

---

## Error Handling

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  Partial Results Available

✓ Exa        - 5 results
✓ Brave      - 6 results
✗ Metaso     - Connection timeout (retrying...)
✓ GitHub     - 3 results

Showing 14 results from 3 engines. Retry Metaso? [Y/n]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Open Questions

1. How to handle progress updates in non-interactive environments?
2. Should progress be persisted for async operations?
3. How to integrate with Claude Code's existing progress display?

---

## Alternatives Considered

| Alternative | Pros | Cons | Decision |
|-------------|------|------|----------|
| Silent mode (current) | Simple | Poor UX | Replaced |
| Only show final result | No clutter | No feedback during wait | Rejected |
| Webhook-based streaming | Real-time | Complex setup | Future option |
| Inline progress (proposed) | Simple, effective | May clutter output | **Selected** |

---

## References

- [CLI Progress Bars](https://www.npmjs.com/package/cli-progress)
- [Indefinite Progress Indicators](https://docs.microsoft.com/en-us/windows/win32/uxguide/progress-bars)
