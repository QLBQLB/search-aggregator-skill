import { SearchResult } from './types.js';
/**
 * URL 规范化 - 移除追踪参数等
 */
export declare function normalizeUrl(url: string): string;
/**
 * 提取主域名
 */
export declare function extractDomain(url: string): string;
/**
 * 提取路径 slug (用于相似度判断)
 */
export declare function extractSlug(url: string): string;
/**
 * 计算字符串相似度 (Levenshtein distance)
 */
export declare function calculateSimilarity(str1: string, str2: string): number;
/**
 * 判断两个 URL 是否相似
 */
export declare function areUrlsSimilar(url1: string, url2: string, threshold?: number): boolean;
/**
 * 按域名分组
 */
export declare function groupByDomain(results: SearchResult[]): Map<string, SearchResult[]>;
/**
 * URL 去重处理
 */
export declare function deduplicateResults(results: SearchResult[], maxPerDomain?: number): SearchResult[];
/**
 * 高级去重（包含相似度判断）
 */
export declare function deduplicateAdvanced(results: SearchResult[], options?: {
    maxPerDomain: number;
    similarityThreshold: number;
}): {
    results: SearchResult[];
    stats: {
        original: number;
        deduped: number;
        rate: number;
    };
};
