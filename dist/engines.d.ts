import { SearchResult } from './types.js';
/**
 * 搜索引擎配置
 */
declare const ENGINE_CONFIGS: {
    readonly Exa: {
        readonly name: "Exa";
        readonly timeout: 10000;
        readonly maxResults: 5;
    };
    readonly Brave: {
        readonly name: "Brave";
        readonly timeout: 8000;
        readonly maxResults: 5;
    };
    readonly Bocha: {
        readonly name: "Bocha";
        readonly timeout: 8000;
        readonly maxResults: 5;
    };
    readonly Metaso: {
        readonly name: "Metaso";
        readonly timeout: 10000;
        readonly maxResults: 3;
    };
    readonly GitHub: {
        readonly name: "GitHub";
        readonly timeout: 8000;
        readonly maxResults: 5;
    };
};
type EngineName = keyof typeof ENGINE_CONFIGS;
/**
 * 模拟搜索引擎调用（实际使用时需要通过 MCP 调用）
 *
 * 注意：这是一个 MCP Server，它不能直接调用其他 MCP 工具。
 * 实际的搜索调用应该由 Claude 在使用这个 Server 的工具时，
 * 并发调用原有的 MCP 工具，然后将结果传递给聚合工具进行去重。
 */
export declare class SearchEngine {
    private config;
    constructor(engine: EngineName);
    /**
     * 执行搜索（占位符）
     *
     * 实际实现：这个 Server 不直接调用搜索引擎，
     * 而是提供工具让 Claude 传入搜索结果
     */
    search(query: string): Promise<SearchResult[]>;
}
/**
 * Promise.allSettled 包装器 - 确保单个失败不影响整体
 */
export declare function parallelSearch<T>(tasks: Map<string, Promise<T>>): Promise<Map<string, T | Error>>;
/**
 * 解析 Claude 传入的搜索结果
 *
 * Claude 在调用聚合工具时，应该已经并发调用了各搜索引擎，
 * 这里提供解析工具函数
 */
export declare function parseSearchResults(source: string, rawData: any): SearchResult[];
export {};
