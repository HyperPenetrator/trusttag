import sharp from 'sharp';

// ─────────────────────────────────────────────────────────────────────────────
// Perceptual Hash (pHash) — DCT-based image fingerprinting
// ─────────────────────────────────────────────────────────────────────────────
//
// IMPORTANT DISTINCTION: pHash is NOT a cryptographic hash.
//
// Unlike the SHA-256/Keccak-256 metadataIntegrityHash stored on PoCT.sol,
// visually similar images intentionally produce similar (low Hamming-distance)
// pHashes — this is what makes fuzzy matching of found-item photos possible.
//
// pHash provides ZERO tamper-evidence guarantees and must NEVER be used to
// verify data integrity or substituted for metadataIntegrityHash.
//
// Design:
//  1. Resize the image to 32×32 pixels (fast DCT over a small grid)
//  2. Convert to greyscale
//  3. Compute a 32×32 2-D DCT (Discrete Cosine Transform)
//  4. Take the top-left 8×8 block (low-frequency components carry visual "shape")
//  5. Compute the mean of those 64 values
//  6. Produce a 64-bit binary string: '1' if cell > mean, '0' otherwise
//  7. Encode as a 16-char hex string for compact storage
//
// Hamming distance ≤ 10 is considered a "strong visual match" (configurable
// via PHASH_HAMMING_THRESHOLD in .env). Values > 20 are typically unrelated
// images.
// ─────────────────────────────────────────────────────────────────────────────

const DCT_SIZE = 32;   // process on a 32×32 grid
const HASH_SIZE = 8;   // use top-left 8×8 low-frequency block → 64-bit hash

/**
 * Compute a 2-D DCT-II on a square greyscale grid.
 * Returns a flat array of DCT_SIZE × DCT_SIZE coefficients.
 */
function dct2d(pixels: number[], n: number): number[] {
  const out: number[] = new Array(n * n).fill(0);

  // Row-wise 1-D DCT
  const rowDct: number[] = new Array(n * n).fill(0);
  for (let row = 0; row < n; row++) {
    for (let k = 0; k < n; k++) {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        sum += pixels[row * n + j] * Math.cos((Math.PI / n) * (j + 0.5) * k);
      }
      rowDct[row * n + k] = sum;
    }
  }

  // Column-wise 1-D DCT
  for (let col = 0; col < n; col++) {
    for (let k = 0; k < n; k++) {
      let sum = 0;
      for (let i = 0; i < n; i++) {
        sum += rowDct[i * n + col] * Math.cos((Math.PI / n) * (i + 0.5) * k);
      }
      out[k * n + col] = sum;
    }
  }

  return out;
}

/**
 * Compute the pHash of a base64-encoded image string.
 *
 * @param base64Image - raw base64 string (without data-URI prefix) or full
 *                      data-URI (e.g. "data:image/jpeg;base64,...")
 * @returns 16-character lowercase hex string representing the 64-bit pHash
 */
export async function computePhash(base64Image: string): Promise<string> {
  // Strip data-URI prefix if present
  const raw = base64Image.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(raw, 'base64');

  // Resize → greyscale → raw pixel values
  const { data: pixels } = await sharp(buffer)
    .resize(DCT_SIZE, DCT_SIZE, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelArray: number[] = Array.from(pixels);

  // Compute 2-D DCT
  const dct = dct2d(pixelArray, DCT_SIZE);

  // Extract top-left HASH_SIZE × HASH_SIZE low-frequency block
  const lowFreq: number[] = [];
  for (let row = 0; row < HASH_SIZE; row++) {
    for (let col = 0; col < HASH_SIZE; col++) {
      lowFreq.push(dct[row * DCT_SIZE + col]);
    }
  }

  // Mean (excluding DC component at [0,0] which skews the average)
  const dcExcluded = lowFreq.slice(1);
  const mean = dcExcluded.reduce((a, b) => a + b, 0) / dcExcluded.length;

  // Build 64-bit binary string
  const bits = lowFreq.map((v) => (v > mean ? '1' : '0')).join('');

  // Pack into 16 hex chars (4 bits per char)
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }

  return hex;
}

/**
 * Compute the Hamming distance between two pHash hex strings.
 * Returns the number of differing bits (0 = identical, 64 = completely different).
 */
export function hammingDistance(hashA: string, hashB: string): number {
  if (hashA.length !== hashB.length) {
    throw new Error(
      `pHash length mismatch: ${hashA.length} vs ${hashB.length}. Both must be 16-char hex strings.`
    );
  }

  let distance = 0;
  for (let i = 0; i < hashA.length; i++) {
    const a = parseInt(hashA[i], 16);
    const b = parseInt(hashB[i], 16);
    const xor = a ^ b;
    // Count set bits in the XOR nibble
    distance += xor.toString(2).split('').filter((c) => c === '1').length;
  }
  return distance;
}

/**
 * Convert a Hamming distance to a normalised [0, 1] similarity score.
 * 0 distance → 1.0 (perfect match), 64 distance → 0.0 (no match).
 */
export function hammingToSimilarity(distance: number): number {
  return Math.max(0, 1 - distance / 64);
}
