// ============= 结果缓存 =============

import { CacheEntry, SearchResult } from './types.js';

export class SearchCache {
  private cache: Map<string, CacheEntry> = new Map();
  private defaultTTL = 5 * 60 * 1000; // 5分钟默认TTL

  /**
   * 生成缓存键
   */
  private generateKey(query: string, engines: string[]): string {
    return `${query.toLowerCase().trim()}::${engines.sort().join(',')}`;
  }

  /**
   * 获取缓存
   */
  get(query: string, engines: string[]): SearchResult[] | null {
    const key = this.generateKey(query, engines);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.results;
  }

  /**
   * 设置缓存
   */
  set(query: string, engines: string[], results: SearchResult[], ttl?: number): void {
    const key = this.generateKey(query, engines);
    this.cache.set(key, {
      results,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    });
  }

  /**
   * 清除过期缓存
   */
  clearExpired(): number {
    const now = Date.now();
    let cleared = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// 单例实例
export const searchCache = new SearchCache();
