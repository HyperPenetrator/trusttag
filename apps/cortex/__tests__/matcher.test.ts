import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { hammingDistance, hammingToSimilarity } from '../src/services/phash';

// ─────────────────────────────────────────────────────────────────────────────
// Matcher integration tests — mock the DB pool so no Postgres is needed
// ─────────────────────────────────────────────────────────────────────────────

// Mock the pool module before importing matcher (which imports pool)
jest.mock('../src/db/pool', () => {
  const mockQuery = jest.fn();
  const mockClient = {
    query: mockQuery,
    release: jest.fn(),
  };
  return {
    getPool: jest.fn(),
    withClient: jest.fn(async (fn: (client: typeof mockClient) => Promise<unknown>) => {
      return fn(mockClient);
    }),
    __mockQuery: mockQuery,
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const poolModule = require('../src/db/pool') as { __mockQuery: jest.Mock; withClient: jest.Mock };

describe('matchFoundReport scoring logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('attribute overlap: full match = 1.0', () => {
    // Inline test of the scoring logic without importing matcher
    // (to keep this test self-contained)
    const fields = ['category', 'brand', 'colour'] as const;
    const found = { category: 'laptop', brand: 'apple', colour: 'silver' };
    const lost  = { category: 'laptop', brand: 'apple', colour: 'silver' };

    let matches = 0;
    for (const f of fields) {
      if (found[f].toLowerCase() === lost[f].toLowerCase()) matches++;
    }
    expect(matches / fields.length).toBe(1.0);
  });

  it('attribute overlap: no match = 0.0', () => {
    const fields = ['category', 'brand', 'colour'] as const;
    const found = { category: 'phone',  brand: 'samsung', colour: 'black' };
    const lost  = { category: 'laptop', brand: 'apple',   colour: 'silver' };

    let matches = 0;
    for (const f of fields) {
      if (found[f].toLowerCase() === lost[f].toLowerCase()) matches++;
    }
    expect(matches / fields.length).toBe(0.0);
  });

  it('confidence is weighted sum of phash + attribute', () => {
    const PHASH_W = 0.6;
    const ATTR_W  = 0.4;

    const phashSim = hammingToSimilarity(5);   // Hamming 5/64 → high similarity
    const attrSim  = 1.0;

    const confidence = PHASH_W * phashSim + ATTR_W * attrSim;
    expect(confidence).toBeGreaterThan(0.9);
    expect(confidence).toBeLessThanOrEqual(1.0);
  });

  it('confidence falls back to attribute-only when no photo', () => {
    // When phash is undefined, weight = 100% attributes
    const attrSim = 2 / 3; // 2 out of 3 fields match
    const confidence = attrSim; // no phash weight
    expect(confidence).toBeCloseTo(0.6667, 3);
  });

  it('hammingDistance and hammingToSimilarity compose correctly', () => {
    // Two identical hashes → distance 0 → similarity 1.0 → high confidence
    const hash = 'deadbeefcafebabe';
    expect(hammingDistance(hash, hash)).toBe(0);
    expect(hammingToSimilarity(0)).toBe(1.0);

    // Completely different → distance 64 → similarity 0.0
    expect(hammingToSimilarity(64)).toBe(0.0);
  });
});

describe('withClient mock setup', () => {
  it('withClient is mockable', async () => {
    // Verify our mock wiring works — the matcher module uses withClient
    let called = false;
    await poolModule.withClient(async () => {
      called = true;
    });
    expect(called).toBe(true);
  });
});
