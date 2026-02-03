# RFC 003: Feedback Loop for Result Quality Optimization

> **Status**: Draft
> **Created**: 2026-02-03
> **Author**: @QLBQLB
> **Issue**: #3

---

## Summary

Implement a feedback mechanism that tracks which search engine results are ultimately adopted by Claude, and uses this data to automatically optimize routing weights. This creates a closed-loop system that improves over time based on actual usage patterns.

---

## Motivation

### Current State
- Engine priorities are based on assumptions about query types
- No data on which engines actually provide useful results
- No way to learn from user/AI satisfaction
- Static weights never improve

### Desired State
- Track which results are adopted in final responses
- Use adoption rates to calculate effective weights
- Per-query-type optimization (news vs code vs academic)
- Continuous improvement based on real usage

---

## Proposed Design

### Feedback Collection Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        User Query                           │
│                  "Rust 2025 adoption trends"                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Concurrent Recall                      │
├─────────────┬─────────────┬─────────────┬─────────────────┤
│    Exa      │   Brave     │   Metaso    │     Bocha       │
│    5 URLs   │    6 URLs   │    4 URLs   │     3 URLs      │
└─────────────┴─────────────┴─────────────┴─────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Claude Processing                       │
│                  (Generates response using sources)         │
└─────────────────────────────────────────────────────────────┘
                            │
                    ┌───────┴───────┐
                    ▼               ▼
            ┌───────────┐   ┌──────────────┐
            │  Adopted  │   │   Ignored    │
            │   URLs    │   │    URLs     │
            └───────────┘   └──────────────┘
                    │               │
                    ▼               ▼
        ┌──────────────────────────────────────┐
        │     Feedback Record Created          │
        │  { queryType, engine, adopted,       │
        │    ignored, timestamp }              │
        └──────────────────────────────────────┘
                    │
                    ▼
        ┌──────────────────────────────────────┐
        │     Weight Optimizer                 │
        │  Updates per-query-type weights      │
        └──────────────────────────────────────┘
```

### Data Structures

```typescript
interface FeedbackRecord {
  id: string
  query: string
  queryType: 'quick' | 'mode-a' | 'mode-r' | 'mode-t' | 'mode-f'
  queryCategory: 'code' | 'news' | 'academic' | 'general'

  engineResults: {
    engine: string
    totalUrls: number
    adoptedUrls: string[]     // URLs used in final response
    ignoredUrls: string[]     // URLs presented but not used
    position: number          // Result ranking position
  }[]

  metadata: {
    timestamp: Date
    responseTime: number
    userSatisfaction?: 'thumbs_up' | 'thumbs_down' | null
  }
}

interface WeightMatrix {
  // Weights for each engine × query type combination
  [queryType: string]: {
    [engine: string]: {
      baseWeight: number        // Initial static weight
      adoptionRate: number      // % of results adopted
      avgPosition: number       // Avg position of adopted results
      recencyScore: number      // Recent performance boost
      effectiveWeight: number   // Final calculated weight
    }
  }
}

// Adoption rate calculation
adoptionRate = (adoptedUrls / totalUrls) × recencyFactor × qualityFactor

recencyFactor = 0.7 × historicalRate + 0.3 × recentRate  // Recent data weighted higher
qualityFactor = 1.0 - (avgPosition / totalResults) × 0.3  // Higher positions weighted higher
```

### Weight Optimization Algorithm

```typescript
class WeightOptimizer {
  private matrix: WeightMatrix
  private readonly MIN_SAMPLES = 10  // Minimum samples before adjusting
  private readonly LEARNING_RATE = 0.1

  updateWeights(records: FeedbackRecord[]): void {
    // Group by query type and engine
    const grouped = this.groupRecords(records)

    for (const [queryType, engines] of Object.entries(grouped)) {
      for (const [engine, data] of Object.entries(engines)) {
        if (data.samples < this.MIN_SAMPLES) continue

        const currentWeight = this.matrix[queryType]?.[engine]?.effectiveWeight || 0.5
        const adoptionRate = data.adopted / data.total
        const targetWeight = this.calculateTargetWeight(adoptionRate)

        // Gradual adjustment (not abrupt changes)
        const newWeight = currentWeight +
          (targetWeight - currentWeight) * this.LEARNING_RATE

        this.updateMatrix(queryType, engine, {
          adoptionRate,
          effectiveWeight: Math.max(0.1, Math.min(1.0, newWeight))
        })
      }
    }
  }

  private calculateTargetWeight(adoptionRate: number): number {
    // Map adoption rate to target weight
    // >50% adoption = 1.0 (highest priority)
    // 20-50% adoption = 0.5-1.0
    // <20% adoption = 0.1-0.5
    if (adoptionRate > 0.5) return 1.0
    if (adoptionRate > 0.2) return 0.5 + (adoptionRate - 0.2)
    return 0.1 + adoptionRate * 2
  }
}
```

### Example Weight Evolution

```
Initial State (Static Weights):
Query Type: "Technical Analysis" (Mode-A)
┌──────────┬──────────┬─────────────┬─────────────┐
│ Engine   │ Base     │ Adoption    │ Effective   │
├──────────┼──────────┼─────────────┼─────────────┤
│ Exa      │ 1.0      │ N/A         │ 1.00        │
│ Brave    │ 0.7      │ N/A         │ 0.70        │
│ Metaso   │ 0.9      │ N/A         │ 0.90        │
└──────────┴──────────┴─────────────┴─────────────┘

After 100 Queries:
Query Type: "Technical Analysis" (Mode-A)
┌──────────┬──────────┬─────────────┬─────────────┐
│ Engine   │ Base     │ Adoption    │ Effective   │
├──────────┼──────────┼─────────────┼─────────────┤
│ Exa      │ 1.0      │ 65%         │ 0.95        │
│ Brave    │ 0.7      │ 45%         │ 0.82 ↑      │
│ Metaso   │ 0.9      │ 15%         │ 0.55 ↓      │
└──────────┴──────────┴─────────────┴─────────────┘

Insight: For technical analysis, Metaso (academic) is less relevant
than expected. Brave (news) provides better industry insights.
```

---

## Implementation Plan

### Phase 1: Feedback Collection
- [ ] Create `FeedbackCollector` class in `src/feedback.ts`
- [ ] Define feedback record schema
- [ ] Add feedback submission to MCP tools

### Phase 2: Storage Layer
- [ ] Implement local JSON storage for feedback records
- [ ] Add data retention policy (90 days default)
- [ ] Add privacy controls (no query content stored by default)

### Phase 3: Weight Optimizer
- [ ] Create `WeightOptimizer` class
- [ ] Implement weight calculation algorithm
- [ ] Add scheduled weight recalculation

### Phase 4: Integration
- [ ] Update `hybrid_research` to use optimized weights
- [ ] Add `feedback_info` tool to view statistics
- [ ] Add opt-in/opt-out controls

### Phase 5: User Feedback UI
- [ ] Add thumbs up/down mechanism
- [ ] Create dashboard for viewing stats
- [ ] Export feedback data (for analysis)

---

## MCP Tools

### New Tool: `submit_feedback`

```typescript
{
  name: "submit_feedback",
  description: "Submit feedback on search result quality",
  inputSchema: {
    type: "object",
    properties: {
      queryId: { type: "string" },
      engineResults: {
        type: "array",
        items: {
          type: "object",
          properties: {
            engine: { type: "string" },
            adoptedUrls: { type: "array", items: { type: "string" } },
            ignoredUrls: { type: "array", items: { type: "string" } }
          }
        }
      },
      satisfaction: {
        type: "string",
        enum: ["thumbs_up", "thumbs_down", "neutral"]
      }
    }
  }
}
```

### New Tool: `feedback_stats`

```typescript
{
  name: "feedback_stats",
  description: "View feedback statistics and optimized weights",
  inputSchema: {
    type: "object",
    properties: {
      queryType: { type: "string" },
      engine: { type: "string" }
    }
  }
}
```

---

## Configuration

```yaml
# config.yml
feedback:
  enabled: true
  storage_path: "./data/feedback.json"
  retention_days: 90

  privacy:
    store_query_content: false  # Only store query type, not content
    anonymize_urls: true         # Hash URLs before storing

  optimization:
    min_samples: 10              # Minimum feedback before adjusting
    learning_rate: 0.1           # How fast to adapt (0-1)
    update_interval: 3600        # Recalculate weights every hour

  ui:
    prompt_for_feedback: true    # Ask user for thumbs up/down
    show_stats_in_tool: true     # Include in feedback_info output
```

---

## Privacy Considerations

| Data Type | Storage | Retention | Notes |
|-----------|---------|-----------|-------|
| Query content | Hashed only | 90 days | Not stored in plaintext |
| URLs | Hashed by default | 90 days | Can be disabled |
| Engine names | Stored | 90 days | Needed for analytics |
| Adoption status | Stored | 90 days | Core feedback signal |
| User satisfaction | Stored | 90 days | Thumbs up/down |

---

## Open Questions

1. How to handle cases where multiple engines return the same URL?
2. Should feedback be shared across users (federated learning)?
3. How to handle cold start for new query types?

---

## Alternatives Considered

| Alternative | Pros | Cons | Decision |
|-------------|------|------|----------|
| No feedback (current) | Privacy, simple | No improvement | Replaced |
| Manual tuning | Control | Labor intensive | Rejected |
| Crowdsourced feedback | Lots of data | Privacy concerns | Future option |
| Local opt-in (proposed) | Privacy + improvement | Slower learning | **Selected** |

---

## Future Enhancements

- [ ] Federated learning across installations
- [ ] A/B testing for weight changes
- [ ] ML-based rank aggregation
- [ ] Context-aware weighting (time of day, user preferences)
- [ ] Export/import weight profiles

---

## References

- [Learning to Rank](https://en.wikipedia.org/wiki/Learning_to_rank)
- [Multi-armed Bandit](https://en.wikipedia.org/wiki/Multi-armed_bandit)
- [Counterfactual Learning to Rank](https://arxiv.org/abs/1807.01120)
