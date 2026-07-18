export * from './matcher';
export * from './phash';
export { MatchInput, MatchResult, matchFoundReport } from './matcher';
import { MatchInput, MatchResult } from './matcher';
/**
 * Bulk-check a batch of surrendered items against active LOST reports.
 * Calls matchFoundReport for each item and aggregates results.
 */
export declare function bulkMatchItems(items: MatchInput[]): Promise<MatchResult[][]>;
//# sourceMappingURL=index.d.ts.map