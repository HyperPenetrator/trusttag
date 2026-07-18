/**
 * Compute the pHash of a base64-encoded image string.
 *
 * @param base64Image - raw base64 string (without data-URI prefix) or full
 *                      data-URI (e.g. "data:image/jpeg;base64,...")
 * @returns 16-character lowercase hex string representing the 64-bit pHash
 */
export declare function computePhash(base64Image: string): Promise<string>;
/**
 * Compute the Hamming distance between two pHash hex strings.
 * Returns the number of differing bits (0 = identical, 64 = completely different).
 */
export declare function hammingDistance(hashA: string, hashB: string): number;
/**
 * Convert a Hamming distance to a normalised [0, 1] similarity score.
 * 0 distance → 1.0 (perfect match), 64 distance → 0.0 (no match).
 */
export declare function hammingToSimilarity(distance: number): number;
//# sourceMappingURL=phash.d.ts.map