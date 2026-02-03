// ============= URL 去重工具 =============
/**
 * URL 规范化 - 移除追踪参数等
 */
export function normalizeUrl(url) {
    try {
        const parsed = new URL(url);
        // 移除追踪参数
        const trackingParams = [
            'ref', 'source', 'utm_source', 'utm_medium', 'utm_campaign',
            'utm_term', 'utm_content', 'fbclid', 'gclid', 'msclkid',
            '_ga', '_gid', 'mc_cid', 'mc_eid'
        ];
        trackingParams.forEach(param => {
            parsed.searchParams.delete(param);
        });
        // 统一为 https
        if (parsed.protocol === 'http:') {
            parsed.protocol = 'https:';
        }
        // 移除尾部斜杠
        let normalized = parsed.toString();
        if (normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }
        return normalized;
    }
    catch {
        return url;
    }
}
/**
 * 提取主域名
 */
export function extractDomain(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname.replace('www.', '');
    }
    catch {
        return url;
    }
}
/**
 * 提取路径 slug (用于相似度判断)
 */
export function extractSlug(url) {
    try {
        const parsed = new URL(url);
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        return pathParts[pathParts.length - 1] || '';
    }
    catch {
        return '';
    }
}
/**
 * 计算字符串相似度 (Levenshtein distance)
 */
export function calculateSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    if (len1 === 0)
        return len2 === 0 ? 1 : 0;
    if (len2 === 0)
        return 0;
    const matrix = Array(len1 + 1).fill(null)
        .map(() => Array(len2 + 1).fill(0));
    for (let i = 0; i <= len1; i++)
        matrix[i][0] = i;
    for (let j = 0; j <= len2; j++)
        matrix[0][j] = j;
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(matrix[i - 1][j] + 1, // deletion
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }
    const maxLen = Math.max(len1, len2);
    return 1 - matrix[len1][len2] / maxLen;
}
/**
 * 判断两个 URL 是否相似
 */
export function areUrlsSimilar(url1, url2, threshold = 0.8) {
    const slug1 = extractSlug(url1);
    const slug2 = extractSlug(url2);
    if (!slug1 || !slug2)
        return false;
    const similarity = calculateSimilarity(slug1, slug2);
    return similarity >= threshold;
}
/**
 * 按域名分组
 */
export function groupByDomain(results) {
    const groups = new Map();
    for (const result of results) {
        const domain = extractDomain(result.url);
        if (!groups.has(domain)) {
            groups.set(domain, []);
        }
        groups.get(domain).push(result);
    }
    return groups;
}
/**
 * URL 去重处理
 */
export function deduplicateResults(results, maxPerDomain = 2) {
    const normalized = new Map();
    const domainGroups = groupByDomain(results);
    // 第一遍：完全相同 URL 去重，保留分数最高的
    for (const result of results) {
        const normalizedUrl = normalizeUrl(result.url);
        const existing = normalized.get(normalizedUrl);
        if (!existing || (result.score || 0) > (existing.score || 0)) {
            normalized.set(normalizedUrl, result);
        }
    }
    // 第二遍：按域名限流
    const final = [];
    const domainUsed = new Map();
    for (const result of normalized.values()) {
        const domain = extractDomain(result.url);
        const used = domainUsed.get(domain) || 0;
        if (used < maxPerDomain) {
            final.push(result);
            domainUsed.set(domain, used + 1);
        }
    }
    return final;
}
/**
 * 高级去重（包含相似度判断）
 */
export function deduplicateAdvanced(results, options = {
    maxPerDomain: 2,
    similarityThreshold: 0.8
}) {
    const original = results.length;
    // 按相关性排序
    const sorted = [...results].sort((a, b) => (b.score || 0) - (a.score || 0));
    // 去重容器
    const kept = [];
    const normalizedUrls = new Set();
    const seenSlugs = new Map();
    for (const result of sorted) {
        const normalizedUrl = normalizeUrl(result.url);
        const slug = extractSlug(result.url);
        const domain = extractDomain(result.url);
        // 检查是否已存在相同 URL
        if (normalizedUrls.has(normalizedUrl)) {
            continue;
        }
        // 检查相似 slug
        let isSimilar = false;
        if (slug) {
            for (const [existingSlug, existingResult] of seenSlugs) {
                if (calculateSimilarity(slug, existingSlug) >= options.similarityThreshold) {
                    isSimilar = true;
                    break;
                }
            }
        }
        if (isSimilar) {
            continue;
        }
        // 检查域名限制
        const domainCount = kept.filter(r => extractDomain(r.url) === domain).length;
        if (domainCount >= options.maxPerDomain) {
            continue;
        }
        // 保留此结果
        kept.push(result);
        normalizedUrls.add(normalizedUrl);
        if (slug) {
            seenSlugs.set(slug, result);
        }
    }
    return {
        results: kept,
        stats: {
            original,
            deduped: kept.length,
            rate: original > 0 ? Math.round((1 - kept.length / original) * 100) : 0
        }
    };
}
