export interface MatchInput {
    finderAddress?: string;
    category: string;
    brand: string;
    colour: string;
    distinguishing?: string;
    phash?: string;
    locationHint?: string;
    description?: string;
    foundAt?: string;
}
export interface MatchResult {
    foundReportId: string;
    lostItemId: number;
    tokenId: string;
    ownerAddress: string;
    phashSimilarity: number;
    attributeOverlap: number;
    confidenceScore: number;
    status: 'Pending' | 'Verified' | 'Rejected';
}
/**
 * 1. Persist the FoundReport to found_reports.
 * 2. Load all active LOST items from lost_items.
 * 3. Score each by:
 *      confidenceScore = PHASH_WEIGHT * phashSimilarity
 *                      + ATTR_WEIGHT  * attributeOverlap
 * 4. Persist top-N matches (score > 0) to match_candidates.
 * 5. Return results ordered by confidenceScore descending.
 */
export declare function matchFoundReport(input: MatchInput, topN?: number): Promise<MatchResult[]>;
//# sourceMappingURL=matcher.d.ts.map