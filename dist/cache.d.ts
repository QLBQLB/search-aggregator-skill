import { SearchResult } from './types.js';
export declare class SearchCache {
    private cache;
    private defaultTTL;
    /**
     * 生成缓存键
     */
    private generateKey;
    /**
     * 获取缓存
     */
    get(query: string, engines: string[]): SearchResult[] | null;
    /**
     * 设置缓存
     */
    set(query: string, engines: string[], results: SearchResult[], ttl?: number): void;
    /**
     * 清除过期缓存
     */
    clearExpired(): number;
    /**
     * 清除所有缓存
     */
    clear(): void;
    /**
     * 获取缓存统计
     */
    getStats(): {
        size: number;
        keys: string[];
    };
}
export declare const searchCache: SearchCache;
