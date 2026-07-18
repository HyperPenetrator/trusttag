export * from './matcher';
export * from './phash';
export { MatchInput, MatchResult, matchFoundReport } from './matcher';

import { MatchInput, matchFoundReport, MatchResult } from './matcher';

/**
 * Bulk-check a batch of surrendered items against active LOST reports.
 * Calls matchFoundReport for each item and aggregates results.
 */
export async function bulkMatchItems(items: MatchInput[]): Promise<MatchResult[][]> {
  const results = await Promise.all(items.map(item => matchFoundReport(item)));
  return results;
}
