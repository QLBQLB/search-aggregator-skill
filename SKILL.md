---
name: search-aggregator
description: Aggregated search service with concurrent recall, URL deduplication, and result caching. Use when: (1) Research requires multiple search engines, (2) Need to deduplicate results from multiple sources, (3) Want to cache search results for repeated queries.
license: Apache-2.0
---

# Search Aggregator - 搜索聚合服务

并发调用多个搜索引擎，自动去重 URL，结果缓存。

## 工作原理

```
用户查询
    │
    ├─> hybrid_research (模式检测)
    │       │
    │       ├─ 分析查询类型
    │       └─ 返回应该调用的引擎列表
    │
    ├─> Claude 并发调用各搜索引擎
    │       ├── Exa
    │       ├── Brave
    │       ├── Bocha
    │       └─ Metaso
    │
    └─> aggregate_search (聚合去重)
            ├── URL 规范化 (移除追踪参数)
            ├── 域名分组
            ├── 相似度去重
            └─ 返回去重后的结果
```

## 可用工具

### 1. hybrid_research

**用途**: 自动检测查询类型，返回应该调用的搜索引擎

```yaml
输入:
  query: "分析 Rust 在 2025 的采用趋势"

输出:
  mode: "Mode-A"
  modeDescription: "Technical Analysis"
  engines: ["Exa", "Brave", "Metaso"]
  instructions: |
    1. 并发调用上述搜索引擎
    2. 收集结果后调用 aggregate_search
```

**模式对应关系**:

| 模式 | 触发关键词 | 引擎组合 |
|------|-----------|----------|
| Quick | 怎么, 如何, what is | Exa |
| Mode-A | 分析, 评估, 趋势 | Exa + Brave + Metaso |
| Mode-R | 市场, 格局, 竞争 | Brave + Bocha + Metaso |
| Mode-T | 对比, vs, 比较 | Exa + GitHub |
| Mode-F | 全面, 深入, 综述 | 全部引擎 |

### 2. aggregate_search

**用途**: 聚合多个搜索引擎的结果并去重

```yaml
输入:
  query: "搜索查询"
  engine_results:
    Exa: [...]
    Brave: [...]
    Metaso: [...]
  max_per_domain: 2  # 同一域名最多保留2条
  similarity_threshold: 0.8  # URL 相似度阈值

输出:
  results: [...]  # 去重后的结果
  stats:
    totalOriginal: 15
    totalAfterDedup: 8
    dedupRate: 46.7
    engineCounts:
      Exa: 5
      Brave: 6
      Metaso: 4
```

**去重规则**:
- 移除追踪参数: `?ref=twitter`, `&utm_source=google`
- URL 规范化: 统一 https，移除尾部斜杠
- 同域名限流: 最多保留 2 条
- 相似度判断: slug 相似度 > 80% 视为重复

### 3. quick_search

**用途**: 简单查询的快速搜索（单路）

```yaml
输入:
  query: "Python 怎么打印"
  engine: "Exa"
  results: [...]  # 从 Exa 获取的原始结果

输出:
  results: [...]  # 前 5 条结果
  count: 5
```

### 4. cache_info

**用途**: 查看和管理缓存

```yaml
输入:
  action: "stats"  # 或 "clear_expired", "clear_all"

输出:
  size: 10
  keys: ["query1::exa,brave", "query2::metaso"]
```

## 使用流程

### 流程 1: 深度研究

```markdown
用户: "分析 Rust 在 2025 的采用趋势"

1. 调用 hybrid_research(query="...")
   → 返回: mode=Mode-A, engines=[Exa, Brave, Metaso]

2. 并发调用三个搜索引擎:
   - mcp__exa__get_code_context_exa
   - mcp__brave-search__brave_web_search
   - mcp__metaso__metaso_web_search

3. 调用 aggregate_search 合并结果
   → 返回去重后的 8-12 条结果
```

### 流程 2: 快速查询

```markdown
用户: "Python 怎么打印"

1. 调用 hybrid_research(query="...")
   → 返回: mode=quick, engines=[Exa]

2. 调用 mcp__exa__get_code_context_exa

3. 调用 quick_search (可选，用于缓存)
```

## URL 去重示例

```yaml
原始结果:
  - https://example.com/post?ref=twitter
  - https://example.com/post?utm_source=google
  - https://blog.example.com/similar-post
  - https://example.com/post-related
  - https://another.com/article

去重后:
  - https://example.com/post (合并了前2条)
  - https://blog.example.com/similar-post
  - https://another.com/article

统计: 5 → 3 (去重率 40%)
```

## 缓存策略

| 场景 | TTL | 说明 |
|------|-----|------|
| 新闻类查询 | 3 分钟 | 时效性高 |
| 技术文档 | 10 分钟 | 相对稳定 |
| 学术论文 | 30 分钟 | 长期有效 |

## 与其他 MCP 的关系

```
search-aggregator (聚合层)
    │
    ├──> mcp__exa__* (代码/API)
    ├──> mcp__brave-search__* (新闻)
    ├──> mcp__bocha__* (中文)
    ├──> mcp__metaso__* (学术)
    └──> mcp__github__* (项目)
```

本 Server 不直接调用其他 MCP，而是由 Claude 并发调用后传入聚合。
