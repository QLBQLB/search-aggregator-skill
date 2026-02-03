# RFC 001: Dynamic Weighting for Search Engines

> **Status**: Draft
> **Created**: 2026-02-03
> **Author**: @QLBQLB
> **Issue**: #[TBD]

---

## Summary

Implement a dynamic weighting system that adjusts search engine priorities based on real-time health checks and historical performance metrics. Currently, the P0-P8 priority system is static; this RFC proposes making it adaptive to engine availability and performance.

---

## Motivation

### Current State
- Static priority levels (P0-P8) are fixed regardless of engine health
- If Exa (P0) is down or slow, queries still route to it first
- No automatic fallback based on real-time performance

### Desired State
- Engine weights adjust automatically based on health
- Degraded engines automatically get lower priority
- Healthy engines get boosted priority

---

## Proposed Design

### Health Check Service

```typescript
interface HealthCheckConfig {
  interval: number      // Check interval in seconds (default: 60)
  timeout: number       // Request timeout (default: 5000ms)
  retryCount: number    // Retry attempts before marking degraded (default: 3)
}

interface HealthMetrics {
  engine: string
  status: 'healthy' | 'degraded' | 'down'
  responseTime: number  // Average response time in ms
  successRate: number   // Success percentage (0-100)
  errorRate: number     // Error percentage (0-100)
  lastCheck: Date
  consecutiveFailures: number
}
```

### Weight Calculation Algorithm

```
Base Weight × Health Factor × Performance Factor = Dynamic Weight

Health Factor:
- healthy:    1.0
- degraded:   0.5
- down:       0.1

Performance Factor:
- successRate >= 95%:  1.2 (boost)
- successRate >= 80%:  1.0 (normal)
- successRate < 80%:   0.6 (penalty)
- responseTime > 5s:   0.8 (slow penalty)
```

### Example

```
Initial State:
┌──────────┬──────────┬─────────────┬─────────────┐
│ Engine   │ Base Prio│ Health      │ Dynamic Wt  │
├──────────┼──────────┼─────────────┼─────────────┤
│ Exa      │ P0 (1.0) │ healthy     │ 1.0 × 1.0 = 1.0 │
│ Brave    │ P2 (0.7) │ healthy     │ 0.7 × 1.0 = 0.7 │
│ Metaso   │ P1 (0.9) │ degraded    │ 0.9 × 0.5 = 0.45 │
└──────────┴──────────┴─────────────┴─────────────┘

After Exa Degrades (response time spike):
┌──────────┬──────────┬─────────────┬─────────────┐
│ Engine   │ Base Prio│ Health      │ Dynamic Wt  │
├──────────┼──────────┼─────────────┼─────────────┤
│ Exa      │ P0 (1.0) │ degraded    │ 1.0 × 0.5 = 0.5 │  ←降级
│ Brave    │ P2 (0.7) │ healthy     │ 0.7 × 1.2 = 0.84 │ ←自动升为最高
│ Metaso   │ P1 (0.9) │ healthy     │ 0.9 × 1.0 = 0.9 │
└──────────┴──────────┴─────────────┴─────────────┘

New routing order for quick search: Metaso → Brave → Exa
```

---

## Implementation Plan

### Phase 1: Health Check Service
- [ ] Create `HealthChecker` class in `src/health.ts`
- [ ] Implement periodic health checks for each engine
- [ ] Store metrics in memory with TTL

### Phase 2: Weight Calculator
- [ ] Create `WeightCalculator` class in `src/weights.ts`
- [ ] Implement weight calculation algorithm
- [ ] Expose `getEffectivePriorities()` function

### Phase 3: Integration
- [ ] Update `hybrid_research` to use dynamic weights
- [ ] Add fallback to static weights if health check unavailable
- [ ] Add configuration options

### Phase 4: Observability
- [ ] Add health status to `cache_info` output
- [ ] Add weight change logging
- [ ] Expose health metrics via MCP tool

---

## Configuration

```yaml
# config.yml
dynamic_weighting:
  enabled: true

health_check:
  interval: 60s
  timeout: 5s
  retry_count: 3

thresholds:
  degraded_success_rate: 80
  boost_success_rate: 95
  slow_response_time: 5000  # ms

weights:
  min_weight: 0.1    # Prevent complete exclusion
  boost_factor: 1.2
  penalty_factor: 0.6
```

---

## Open Questions

1. Should health check results persist across restarts?
2. How to handle engines that are temporarily rate-limited?
3. Should users be able to manually override weights?

---

## Alternatives Considered

| Alternative | Pros | Cons | Decision |
|-------------|------|------|----------|
| Keep static weights | Simple, predictable | No adaptation to failures | Rejected |
| Circuit breaker pattern | Fast failure | Too aggressive, may recover too slowly | Partially adopted |
| Full ML-based routing | Optimal long-term | Complex, requires lots of data | Future consideration |

---

## References

- [Resilience4j Circuit Breaker](https://resilience4j.readme.io/docs/circuitbreaker)
- [AWS Route53 Health Checks](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-failover.html)
