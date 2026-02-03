// ============= MCP Server 主入口 =============

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SearchResult, SearchRequest, SearchResponse } from './types.js';
import { deduplicateAdvanced } from './deduplicator.js';
import { searchCache } from './cache.js';
import { parseSearchResults } from './engines.js';

// 创建 MCP Server
const server = new Server(
  {
    name: 'search-aggregator',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * 工具: quick_search
 *
 * 快速搜索 - 单路召回，适用于简单查询
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'quick_search',
        description: `Quick search for simple queries. Single engine recall.

EXAMPLES:
- "Python how to print"
- "React useEffect explained"
- "What is REST API"

USAGE: Call this after getting results from a single search engine (Exa/Brave/Bocha/etc).

PARAMETERS:
- engine: The search engine used (Exa, Brave, Bocha, Metaso, GitHub)
- results: Raw search results from that engine
- query: The search query (for cache)`,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query',
            },
            engine: {
              type: 'string',
              enum: ['Exa', 'Brave', 'Bocha', 'Metaso', 'GitHub'],
              description: 'The search engine used',
            },
            results: {
              type: 'array',
              description: 'Raw results from the search engine',
              items: { type: 'object' },
            },
          },
          required: ['query', 'engine', 'results'],
        },
      },
      {
        name: 'aggregate_search',
        description: `Aggregate and deduplicate results from multiple concurrent search engines.

USE THIS for deep research when you've called multiple search engines in parallel.

WORKFLOW:
1. Call multiple search engines in parallel (Exa, Brave, Bocha, Metaso, etc.)
2. Collect all results
3. Call this tool with all results for deduplication and merging

EXAMPLE:
User: "Analyze Rust adoption trends in 2025"

YOUR RESPONSE:
[Concurrently call mcp__exa__get_code_context_exa, mcp__brave-search__brave_web_search, mcp__bocha__search]
[Then call aggregate_search with all results]

PARAMETERS:
- query: The search query
- engine_results: Map of engine name to its results
- max_per_domain: Max results per domain after dedup (default: 2)`,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query',
            },
            engine_results: {
              type: 'object',
              description: 'Results from each engine, keyed by engine name',
              additionalProperties: {
                type: 'array',
                items: { type: 'object' },
              },
            },
            max_per_domain: {
              type: 'number',
              description: 'Max results per domain (default: 2)',
              default: 2,
            },
            similarity_threshold: {
              type: 'number',
              description: 'Similarity threshold for URL dedup (default: 0.8)',
              default: 0.8,
            },
          },
          required: ['query', 'engine_results'],
        },
      },
      {
        name: 'hybrid_research',
        description: `Full hybrid research mode with mode detection and intelligent routing.

This tool automatically detects the query type and routes accordingly:
- Quick Search: For simple "how to" questions
- Deep Research: For analysis/comparison/trend questions

MODES:
- Mode-A (Technical Analysis): Exa + Brave + Metaso
- Mode-R (Industry Research): Brave + Bocha + Metaso
- Mode-T (Tech Selection): Exa + GitHub
- Mode-F (Full Recall): All engines

USAGE:
1. This tool returns which engines to call based on query analysis
2. You then call those engines in parallel
3. Pass results back to aggregate_search

EXAMPLE QUERIES:
- "Analyze Rust adoption in 2025" → Mode-A
- "Compare Next.js vs Remix" → Mode-T
- "Comprehensive analysis of AI agents" → Mode-F`,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The research query',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'cache_info',
        description: 'Get cache statistics and clear expired entries',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['stats', 'clear_expired', 'clear_all'],
              description: 'Action to perform',
            },
          },
          required: ['action'],
        },
      },
    ],
  };
});

/**
 * 处理工具调用
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'quick_search': {
        const { query, engine, results } = args as {
          query: string;
          engine: string;
          results: any[];
        };

        // 检查缓存
        const cached = searchCache.get(query, [engine]);
        if (cached) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    cached: true,
                    results: cached.slice(0, 5), // Quick search 只返回前5条
                    count: cached.length,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // 解析结果
        const parsed = parseSearchResults(engine, results);

        // 缓存结果
        searchCache.set(query, [engine], parsed);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  cached: false,
                  results: parsed.slice(0, 5),
                  count: parsed.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'aggregate_search': {
        const { query, engine_results, max_per_domain = 2, similarity_threshold = 0.8 } = args as {
          query: string;
          engine_results: Record<string, any[]>;
          max_per_domain?: number;
          similarity_threshold?: number;
        };

        // 检查缓存
        const engines = Object.keys(engine_results);
        const cached = searchCache.get(query, engines);
        if (cached) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    cached: true,
                    results: cached,
                    stats: {
                      totalOriginal: cached.length,
                      totalAfterDedup: cached.length,
                      dedupRate: 0,
                      engineCounts: engines.reduce((acc, e) => ({ ...acc, [e]: 0 }), {}),
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // 解析所有引擎结果
        const allResults: SearchResult[] = [];
        const engineCounts: Record<string, number> = {};

        for (const [engine, rawResults] of Object.entries(engine_results)) {
          const parsed = parseSearchResults(engine, rawResults);
          allResults.push(...parsed);
          engineCounts[engine] = parsed.length;
        }

        // 去重
        const { results: deduped, stats } = deduplicateAdvanced(allResults, {
          maxPerDomain: max_per_domain,
          similarityThreshold: similarity_threshold,
        });

        // 构建最终统计
        const finalStats = {
          totalOriginal: stats.original,
          totalAfterDedup: stats.deduped,
          dedupRate: stats.rate,
          engineCounts,
        };

        // 缓存结果
        searchCache.set(query, engines, deduped);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  cached: false,
                  results: deduped,
                  stats: finalStats,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'hybrid_research': {
        const { query } = args as { query: string };

        // 分析查询类型，决定使用哪个模式
        const mode = detectMode(query);
        const engines = getEnginesForMode(mode);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  query,
                  mode,
                  modeDescription: getModeDescription(mode),
                  engines,
                  instructions: `
1. Call the following search engines in parallel:
${engines.map((e) => `   - ${e}`).join('\n')}

2. After collecting all results, call aggregate_search with:
   - query: "${query}"
   - engine_results: { ${engines.map(e => `${e}: <results>`).join(', ')} }
   - max_per_domain: 2
                  `.trim(),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'cache_info': {
        const { action } = args as { action: 'stats' | 'clear_expired' | 'clear_all' };

        switch (action) {
          case 'stats': {
            const stats = searchCache.getStats();
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(stats, null, 2),
                },
              ],
            };
          }
          case 'clear_expired': {
            const cleared = searchCache.clearExpired();
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ cleared, message: `Cleared ${cleared} expired entries` }, null, 2),
                },
              ],
            };
          }
          case 'clear_all': {
            searchCache.clear();
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ message: 'Cache cleared' }, null, 2),
                },
              ],
            };
          }
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: error instanceof Error ? error.message : String(error),
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// ============= 辅助函数 =============

type SearchMode = 'quick' | 'Mode-A' | 'Mode-R' | 'Mode-T' | 'Mode-F';

/**
 * 检测查询类型，返回搜索模式
 */
function detectMode(query: string): SearchMode {
  const lowerQuery = query.toLowerCase();

  // Quick Search 触发词
  const quickKeywords = [
    '怎么', '如何', '什么', 'what is', 'how to', 'how do i',
    '定义', '是', 'meaning', 'explain', '快速', 'quick'
  ];

  for (const keyword of quickKeywords) {
    if (lowerQuery.includes(keyword)) {
      return 'quick';
    }
  }

  // Deep Research - 各模式触发词
  const techAnalysisKeywords = ['分析', '评估', '趋势', 'analysis', 'evaluate', 'trends'];
  const industryResearchKeywords = ['市场', '格局', '竞争', 'market', 'competition', 'industry'];
  const techSelectionKeywords = ['对比', '比较', 'vs', 'versus', 'compare', 'difference'];
  const fullRecallKeywords = ['全面', '深入', '综述', 'comprehensive', 'in-depth', 'overview'];

  for (const keyword of techSelectionKeywords) {
    if (lowerQuery.includes(keyword)) {
      return 'Mode-T'; // 技术选型优先
    }
  }

  for (const keyword of fullRecallKeywords) {
    if (lowerQuery.includes(keyword)) {
      return 'Mode-F';
    }
  }

  for (const keyword of industryResearchKeywords) {
    if (lowerQuery.includes(keyword)) {
      return 'Mode-R';
    }
  }

  for (const keyword of techAnalysisKeywords) {
    if (lowerQuery.includes(keyword)) {
      return 'Mode-A';
    }
  }

  // 默认返回技术分析模式
  return 'Mode-A';
}

/**
 * 获取模式对应的搜索引擎
 */
function getEnginesForMode(mode: SearchMode): string[] {
  switch (mode) {
    case 'quick':
      return ['Exa']; // 默认 Exa，可根据 P0-P8 规则调整
    case 'Mode-A':
      return ['Exa', 'Brave', 'Metaso'];
    case 'Mode-R':
      return ['Brave', 'Bocha', 'Metaso'];
    case 'Mode-T':
      return ['Exa', 'GitHub'];
    case 'Mode-F':
      return ['Exa', 'Brave', 'Bocha', 'Metaso'];
    default:
      return ['Exa'];
  }
}

/**
 * 获取模式描述
 */
function getModeDescription(mode: SearchMode): string {
  switch (mode) {
    case 'quick':
      return 'Quick Search - Single engine, fast response';
    case 'Mode-A':
      return 'Technical Analysis - Code + News + Academic';
    case 'Mode-R':
      return 'Industry Research - News (EN) + News (CN) + Academic';
    case 'Mode-T':
      return 'Technology Selection - Docs + GitHub Projects';
    case 'Mode-F':
      return 'Full Recall - All engines for comprehensive coverage';
    default:
      return 'Unknown mode';
  }
}

// ============= 启动服务器 =============

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Search Aggregator MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
