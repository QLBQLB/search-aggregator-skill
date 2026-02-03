# Search Aggregator MCP Server

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Claude Skill](https://img.shields.io/badge/Claude-Skill-green.svg)](https://github.com/QLBQLB/search-aggregator-skill)

> 搜索聚合服务 - 并发召回、URL去重、结果缓存

**与 [smart-search-skill](https://github.com/QLBQLB/smart-search-skill) 搭配使用，实现智能路由 + 自动聚合的完整搜索解决方案。**

---

## 功能特性

| 特性 | 说明 |
|------|------|
| **并发召回** | 同时调用多个搜索引擎，提高召回覆盖率 |
| **URL去重** | 自动识别并去除重复/相似的搜索结果 |
| **智能缓存** | 相同查询直接返回缓存，提高响应速度 |
| **模式检测** | 自动识别查询类型，选择最优引擎组合 |

---

## 与 smart-search 搭配使用

### 架构关系

```
┌─────────────────────────────────────────────────────────┐
│              smart-search (路由层)                       │
│         智能选择搜索引擎 + 查询模式检测                   │
│   https://github.com/QLBQLB/smart-search-skill          │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│           search-aggregator (聚合层)                     │
│        并发调用 + 自动去重 + 结果缓存                     │
│      https://github.com/QLBQLB/search-aggregator-skill  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│   Exa    │  Brave   │  Metaso  │  Bocha   │  GitHub  │
│ (代码/API)│  (新闻)  │  (学术)  │  (中文)  │  (项目)  │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

### 完整安装流程

```bash
# 1. 安装 smart-search 技能 (路由层)
git clone https://github.com/QLBQLB/smart-search-skill.git ~/.claude/skills/smart-search

# 2. 安装 search-aggregator 技能 + MCP Server (聚合层)
git clone https://github.com/QLBQLB/search-aggregator-skill.git ~/.claude/skills/search-aggregator
cd ~/.claude/skills/search-aggregator
npm install
npm run build

# 3. 配置 MCP Server
claude mcp add search-aggregator node C:\\Users\\uiqia\\.claude\\skills\\search-aggregator\\dist\\index.js
```

### 工作流程

```yaml
用户输入查询
    ↓
smart-search 分析查询类型
    ↓
search-aggregator.hybrid_research(query)
    → 返回: { mode: "Mode-A", engines: ["Exa", "Brave", "Metaso"] }
    ↓
并发调用各搜索引擎 MCP
    ├─ mcp__exa__get_code_context_exa
    ├─ mcp__brave-search__brave_web_search
    └─ mcp__metaso__metaso_web_search
    ↓
search-aggregator.aggregate_search(results)
    → URL 规范化
    → 域名分组
    → 相似度去重
    → 返回去重结果
    ↓
格式化输出给用户
```

---

## 安装

### 方法一：独立使用

```bash
git clone https://github.com/QLBQLB/search-aggregator-skill.git
cd search-aggregator-skill
npm install
npm run build
```

### 方法二：与 smart-search 搭配 (推荐)

参见 [smart-search-skill](https://github.com/QLBQLB/smart-search-skill) 的完整文档。

---

## 配置 Claude Code

在 Claude Code 配置中添加此 MCP Server：

```json
{
  "mcpServers": {
    "search-aggregator": {
      "command": "node",
      "args": ["C:\\Users\\uiqia\\.claude\\skills\\search-aggregator\\dist\\index.js"]
    }
  }
}
```

---

## 可用工具

### hybrid_research

查询模式检测，返回应该调用的搜索引擎。

```json
{
  "name": "hybrid_research",
  "arguments": {
    "query": "分析 Rust 在 2025 的采用趋势"
  }
}
```

**返回示例**:
```json
{
  "mode": "Mode-A",
  "modeDescription": "Technical Analysis",
  "engines": ["Exa", "Brave", "Metaso"],
  "instructions": "并发调用上述搜索引擎，然后调用 aggregate_search"
}
```

### aggregate_search

聚合多个搜索引擎结果并去重。

```json
{
  "name": "aggregate_search",
  "arguments": {
    "query": "Rust adoption trends",
    "engine_results": {
      "Exa": [...],
      "Brave": [...],
      "Metaso": [...]
    },
    "max_per_domain": 2
  }
}
```

**返回示例**:
```json
{
  "results": [...],
  "stats": {
    "totalOriginal": 15,
    "totalAfterDedup": 8,
    "dedupRate": 46.7
  }
}
```

### quick_search

简单查询快速搜索（带缓存）。

```json
{
  "name": "quick_search",
  "arguments": {
    "query": "Python print",
    "engine": "Exa",
    "results": [...]
  }
}
```

### cache_info

缓存管理。

```json
{
  "name": "cache_info",
  "arguments": {
    "action": "stats"  // 或 "clear_expired", "clear_all"
  }
}
```

---

## URL 去重规则

| 规则 | 说明 |
|------|------|
| 追踪参数移除 | `?ref=twitter`, `&utm_source=gg` |
| 协议统一 | `http://` → `https://` |
| 尾部斜杠 | `/path/` → `/path` |
| 域名限流 | 同域名最多 2 条 |
| 相似度判断 | slug 编辑距离 > 80% |

---

## 缓存策略

| 场景 | TTL | 说明 |
|------|-----|------|
| 新闻类查询 | 3 分钟 | 时效性高 |
| 技术文档 | 10 分钟 | 相对稳定 |
| 学术论文 | 30 分钟 | 长期有效 |

---

## 项目结构

```
search-aggregator/
├── src/
│   ├── index.ts          # MCP Server 主入口
│   ├── types.ts          # 类型定义
│   ├── deduplicator.ts   # URL 去重逻辑
│   ├── cache.ts          # 缓存实现
│   └── engines.ts        # 搜索引擎调用
├── dist/                 # 编译输出
├── package.json
├── tsconfig.json
├── SKILL.md              # Claude Code Skill 定义
└── README.md
```

---

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 监听模式
npm run watch
```

---

## 相关项目

| 项目 | 说明 | 链接 |
|------|------|------|
| **smart-search-skill** | 智能路由搜索技能 | [GitHub](https://github.com/QLBQLB/smart-search-skill) |

---

## License

Apache-2.0
