export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
    source: string;
    publishedDate?: string;
    score?: number;
}
export interface SearchEngineConfig {
    name: string;
    enabled: boolean;
    weight: number;
    timeout: number;
}
export interface SearchRequest {
    query: string;
    mode: 'quick' | 'deep';
    engines: string[];
    maxResults?: number;
}
export interface SearchResponse {
    results: SearchResult[];
    stats: {
        totalOriginal: number;
        totalAfterDedup: number;
        dedupRate: number;
        engineCounts: Record<string, number>;
        durationMs: number;
    };
}
export interface CacheEntry {
    results: SearchResult[];
    timestamp: number;
    ttl: number;
}
