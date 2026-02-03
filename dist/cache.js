// ============= 结果缓存 =============
export class SearchCache {
    cache = new Map();
    defaultTTL = 5 * 60 * 1000; // 5分钟默认TTL
    /**
     * 生成缓存键
     */
    generateKey(query, engines) {
        return `${query.toLowerCase().trim()}::${engines.sort().join(',')}`;
    }
    /**
     * 获取缓存
     */
    get(query, engines) {
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
    set(query, engines, results, ttl) {
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
    clearExpired() {
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
    clear() {
        this.cache.clear();
    }
    /**
     * 获取缓存统计
     */
    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}
// 单例实例
export const searchCache = new SearchCache();
