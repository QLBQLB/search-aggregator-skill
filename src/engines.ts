// ============= 并发搜索引擎调用 =============

import { SearchResult } from './types.js';

/**
 * 搜索引擎配置
 */
const ENGINE_CONFIGS = {
  Exa: {
    name: 'Exa',
    timeout: 10000,
    maxResults: 5
  },
  Brave: {
    name: 'Brave',
    timeout: 8000,
    maxResults: 5
  },
  Bocha: {
    name: 'Bocha',
    timeout: 8000,
    maxResults: 5
  },
  Metaso: {
    name: 'Metaso',
    timeout: 10000,
    maxResults: 3
  },
  GitHub: {
    name: 'GitHub',
    timeout: 8000,
    maxResults: 5
  }
} as const;

type EngineName = keyof typeof ENGINE_CONFIGS;

/**
 * 模拟搜索引擎调用（实际使用时需要通过 MCP 调用）
 *
 * 注意：这是一个 MCP Server，它不能直接调用其他 MCP 工具。
 * 实际的搜索调用应该由 Claude 在使用这个 Server 的工具时，
 * 并发调用原有的 MCP 工具，然后将结果传递给聚合工具进行去重。
 */
export class SearchEngine {
  private config: typeof ENGINE_CONFIGS[EngineName];

  constructor(engine: EngineName) {
    this.config = ENGINE_CONFIGS[engine];
  }

  /**
   * 执行搜索（占位符）
   *
   * 实际实现：这个 Server 不直接调用搜索引擎，
   * 而是提供工具让 Claude 传入搜索结果
   */
  async search(query: string): Promise<SearchResult[]> {
    // 这是一个占位符实现
    // 实际使用时，Claude 会并发调用其他 MCP 工具获取结果
    return [];
  }
}

/**
 * Promise.allSettled 包装器 - 确保单个失败不影响整体
 */
export async function parallelSearch<T>(
  tasks: Map<string, Promise<T>>
): Promise<Map<string, T | Error>> {
  const results = new Map<string, T | Error>();

  const settled = await Promise.allSettled(
    Array.from(tasks.entries()).map(([name, promise]) =>
      promise.then(result => ({ name, result }))
    )
  );

  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      results.set(outcome.value.name, outcome.value.result);
    } else {
      // 失败时记录错误
      results.set(
        Array.from(tasks.keys()).find(k => outcome.reason?.message?.includes(k)) || 'unknown',
        outcome.reason
      );
    }
  }

  return results;
}

/**
 * 解析 Claude 传入的搜索结果
 *
 * Claude 在调用聚合工具时，应该已经并发调用了各搜索引擎，
 * 这里提供解析工具函数
 */
export function parseSearchResults(
  source: string,
  rawData: any
): SearchResult[] {
  const results: SearchResult[] = [];

  try {
    // 根据不同源解析不同格式
    switch (source) {
      case 'Exa':
        if (Array.isArray(rawData)) {
          for (const item of rawData) {
            results.push({
              title: item.title || '',
              url: item.url || '',
              snippet: item.text || item.snippet || '',
              source: 'Exa',
              score: item.score || 0.5
            });
          }
        }
        break;

      case 'Brave':
        if (rawData.results && Array.isArray(rawData.results)) {
          for (const item of rawData.results) {
            results.push({
              title: item.title || '',
              url: item.url || '',
              snippet: item.description || item.snippet || '',
              source: 'Brave',
              publishedDate: item.publishedAt
            });
          }
        }
        break;

      case 'Bocha':
        if (rawData.data && Array.isArray(rawData.data)) {
          for (const item of rawData.data) {
            results.push({
              title: item.title || '',
              url: item.link || item.url || '',
              snippet: item.description || item.snippet || '',
              source: 'Bocha'
            });
          }
        }
        break;

      case 'Metaso':
        if (rawData.data && Array.isArray(rawData.data)) {
          for (const item of rawData.data) {
            results.push({
              title: item.title || '',
              url: item.url || item.link || '',
              snippet: item.content || item.snippet || item.summary || '',
              source: 'Metaso'
            });
          }
        }
        break;

      case 'GitHub':
        if (Array.isArray(rawData)) {
          for (const item of rawData) {
            results.push({
              title: item.name || item.full_name || '',
              url: item.html_url || item.url || '',
              snippet: item.description || '',
              source: 'GitHub',
              score: item.stargazers_count ? item.stargazers_count / 10000 : 0.5
            });
          }
        }
        break;

      default:
        // 通用解析
        if (Array.isArray(rawData)) {
          for (const item of rawData) {
            results.push({
              title: item.title || '',
              url: item.url || item.link || '',
              snippet: item.snippet || item.description || '',
              source: source
            });
          }
        }
    }
  } catch (error) {
    console.error(`Error parsing ${source} results:`, error);
  }

  return results;
}
