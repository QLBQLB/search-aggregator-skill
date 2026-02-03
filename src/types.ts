// ============= 类型定义 =============

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string; // Exa, Brave, Bocha, Metaso, GitHub
  publishedDate?: string;
  score?: number; // 相关性评分
}

export interface SearchEngineConfig {
  name: string;
  enabled: boolean;
  weight: number; // 权重 0-1
  timeout: number; // 超时时间(ms)
}

export interface SearchRequest {
  query: string;
  mode: 'quick' | 'deep';
  engines: string[]; // ['Exa', 'Brave', 'Bocha', 'Metaso']
  maxResults?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  stats: {
    totalOriginal: number;
    totalAfterDedup: number;
    dedupRate: number; // 去重率 %
    engineCounts: Record<string, number>;
    durationMs: number;
  };
}

export interface CacheEntry {
  results: SearchResult[];
  timestamp: number;
  ttl: number; // Time to live (ms)
}
