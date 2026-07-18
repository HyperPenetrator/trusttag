/**
 * storage.ts — TrustTag Protocol metadata encryption + IPFS pinning
 * ==================================================================
 * Implements the off-chain side of the data-flow principle from the PRD:
 *
 *   OFF-CHAIN: encrypted personal data and images
 *   ON-CHAIN:  only the Keccak-256 integrity hash of the ciphertext
 *
 * Flow:
 *   1. buildMetadataBundle()  → assemble a plain JSON bundle from form data
 *   2. deriveEncryptionKey()  → derive an AES-GCM key from the owner's
 *                              wallet signature (wallet → seed → key)
 *   3. encryptBundle()        → AES-256-GCM encrypt → returns ciphertext
 *   4. computeIntegrityHash() → keccak256(ciphertext) → bytes32 for on-chain
 *   5. pinToIPFS()            → upload ciphertext to IPFS (mocked until a
 *                              real web3.storage / Pinata API key is supplied)
 *   6. prepareItemMetadata()  → orchestrates steps 1-5, returns everything
 *                              the mintItem() call needs
 *
 * MOCK NOTICE:
 *   pinToIPFS() is stubbed with MockIPFSClient.  Drop in a real client by
 *   implementing the IIPFSClient interface below and passing it to
 *   prepareItemMetadata().
 *
 * The owner's signature is derived from signing a deterministic message
 * so the key is reproducible (the owner can decrypt their own bundle later)
 * but is never transmitted or stored.
 */

// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

/** Raw form data captured from the registration UI. */
export interface ItemRegistrationInput {
  /** Human-readable item name, e.g. "MacBook Pro 16"". */
  name: string;
  /** Brand or manufacturer, e.g. "Apple". */
  brand: string;
  /** Serial number or unique identifier. */
  serial: string;
  /** Optional purchase proof: receipt number, order ID, etc. */
  purchaseProof?: string;
  /**
   * Item photos encoded as base64 data URIs.
   * These are encrypted before leaving the browser — raw pixels never reach IPFS.
   */
  photosBase64: string[];
  /** Free-text description of unique identifying marks. */
  uniqueMarkings?: string;
}

/** The full encrypted bundle to be pinned to IPFS. */
export interface EncryptedMetadataBundle {
  /** Base64-encoded AES-GCM ciphertext. */
  ciphertext: string;
  /** Base64-encoded 96-bit initialisation vector. */
  iv: string;
  /**
   * Salt used for PBKDF2 key derivation (base64).
   * Not secret — stored alongside the ciphertext so the owner can re-derive
   * the same key from the same signature later.
   */
  salt: string;
  /** ISO-8601 timestamp of encryption. */
  encryptedAt: string;
  /** Protocol version for future migration support. */
  version: '1';
}

/** Result returned by prepareItemMetadata() — everything mintItem() needs. */
export interface PreparedMetadata {
  /** `0x`-prefixed hex string suitable for bytes32 Solidity parameter. */
  integrityHash: `0x${string}`;
  /** IPFS content ID (CID) of the pinned encrypted bundle. */
  ipfsCid: string;
  /** Full IPFS URI: `ipfs://<cid>` */
  ipfsUri: string;
  /** The encrypted bundle that was pinned (for local caching / debugging). */
  bundle: EncryptedMetadataBundle;
}

// ─────────────────────────────────────────────────────────────────
// IPFS client interface + mock
// ─────────────────────────────────────────────────────────────────

export interface IIPFSClient {
  /**
   * Upload `data` to IPFS and return the content identifier (CID).
   * @param data  The bytes to pin.
   * @param name  A human-readable filename hint for the pinning service.
   */
  pin(data: Uint8Array<ArrayBuffer>, name: string): Promise<string>;
}

/**
 * MockIPFSClient — used when no real pinning API key is available.
 *
 * TODO: Replace with a real client, e.g.:
 *   import { Web3Storage } from 'web3.storage';
 *   export class Web3StorageClient implements IIPFSClient { ... }
 *
 *   — or —
 *
 *   import PinataClient from '@pinata/sdk';
 *   export class PinataIPFSClient implements IIPFSClient { ... }
 *
 * The mock deterministically derives a fake CID from the sha-256 of the
 * data so identical bundles always produce the same mock CID, making
 * local integration tests repeatable.
 */
export class MockIPFSClient implements IIPFSClient {
  async pin(data: Uint8Array<ArrayBuffer>, name: string): Promise<string> {
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    const hashHex = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    // Fake CIDv1-style string for local dev
    const mockCid = `bafybeimock${hashHex.slice(0, 32)}`;
    console.info(`[MockIPFSClient] Pinned "${name}" → ${mockCid}`);
    return mockCid;
  }
}

// ─────────────────────────────────────────────────────────────────
// Encryption utilities
// ─────────────────────────────────────────────────────────────────

/** Deterministic signing message used for key derivation. */
const KEY_DERIVATION_MESSAGE =
  'TrustTag Protocol: I authorise encryption of my item metadata. ' +
  'This signature is used only for key derivation and does not transfer funds.';

/**
 * Returns the canonical message the owner must sign to derive their
 * encryption key.  Expose this so the UI can display it to the user
 * before requesting the signature.
 */
export function getKeyDerivationMessage(): string {
  return KEY_DERIVATION_MESSAGE;
}

/**
 * Derive an AES-256-GCM CryptoKey from the owner's wallet signature.
 *
 * @param signatureHex  The `0x`-prefixed hex signature returned by
 *                      `signMessage` / `personal_sign`.
 * @param salt          Optional base64 salt (provide when re-deriving to
 *                      decrypt; omit on first call to generate a new salt).
 * @returns { key, saltBase64 }
 */
export async function deriveEncryptionKey(
  signatureHex: string,
  salt?: Uint8Array
): Promise<{ key: CryptoKey; saltBase64: string }> {
  const sigBytes = hexToBytes(signatureHex);

  // Import signature as raw PBKDF2 key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    sigBytes.buffer as ArrayBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const actualSalt: Uint8Array<ArrayBuffer> =
    salt != null
      ? (salt as Uint8Array<ArrayBuffer>)
      : (crypto.getRandomValues(new Uint8Array(16)) as Uint8Array<ArrayBuffer>);

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: actualSalt.buffer as ArrayBuffer,
      iterations: 200_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // not extractable — key never leaves SubtleCrypto
    ['encrypt', 'decrypt']
  );

  return { key, saltBase64: uint8ArrayToBase64(actualSalt) };
}

/**
 * AES-256-GCM encrypt a JSON-serialisable object.
 * Returns an EncryptedMetadataBundle ready for IPFS upload.
 */
export async function encryptBundle(
  plaintext: object,
  key: CryptoKey,
  saltBase64: string
): Promise<EncryptedMetadataBundle> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(plaintext));
  const iv = crypto.getRandomValues(new Uint8Array(12)) as Uint8Array<ArrayBuffer>; // 96-bit GCM IV

  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    data.buffer as ArrayBuffer
  );

  return {
    ciphertext: uint8ArrayToBase64(new Uint8Array(cipherBuf)),
    iv: uint8ArrayToBase64(iv),
    salt: saltBase64,
    encryptedAt: new Date().toISOString(),
    version: '1',
  };
}

// ─────────────────────────────────────────────────────────────────
// Integrity hash
// ─────────────────────────────────────────────────────────────────

/**
 * Compute the Keccak-256 integrity hash of the encrypted bundle's
 * ciphertext.  This is what gets stored on-chain via mintItem().
 *
 * We hash the *ciphertext* (not the JSON envelope) so the hash is
 * stable regardless of timestamp or version fields in the envelope.
 *
 * Returns a `0x`-prefixed 32-byte hex string compatible with the
 * `bytes32` Solidity type.
 */
export async function computeIntegrityHash(
  bundle: EncryptedMetadataBundle
): Promise<`0x${string}`> {
  const cipherBytes = base64ToUint8Array(bundle.ciphertext);

  // We use SHA-256 here because SubtleCrypto doesn't expose Keccak-256.
  // The Solidity verifier stores whatever bytes32 we pass, so what
  // matters is that the same ciphertext always produces the same hash.
  // On-chain verification is done by the owner re-deriving and comparing.
  //
  // TODO: swap to keccak256 via `viem`'s `keccak256` helper for strict
  //       on-chain parity once a runtime keccak lib is added to shared.
  const hashBuf = await crypto.subtle.digest('SHA-256', cipherBytes.buffer as ArrayBuffer);
  const hex = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `0x${hex}`;
}

// ─────────────────────────────────────────────────────────────────
// Main orchestration function
// ─────────────────────────────────────────────────────────────────

/**
 * Orchestrates the full encrypt → hash → pin flow.
 *
 * @param input        Form data from the registration UI.
 * @param signatureHex Owner's wallet signature for key derivation.
 * @param ipfsClient   Provide a real IIPFSClient in production; defaults to MockIPFSClient.
 * @returns PreparedMetadata — pass integrityHash to mintItem().
 */
export async function prepareItemMetadata(
  input: ItemRegistrationInput,
  signatureHex: string,
  ipfsClient: IIPFSClient = new MockIPFSClient()
): Promise<PreparedMetadata> {
  // 1. Derive encryption key from wallet signature
  const { key, saltBase64 } = await deriveEncryptionKey(signatureHex);

  // 2. Encrypt the metadata bundle
  const bundle = await encryptBundle(input, key, saltBase64);

  // 3. Compute integrity hash from the ciphertext
  const integrityHash = await computeIntegrityHash(bundle);

  // 4. Serialise the full envelope to bytes and pin to IPFS
  const bundleBytes = new TextEncoder().encode(JSON.stringify(bundle)) as Uint8Array<ArrayBuffer>;
  const ipfsCid = await ipfsClient.pin(bundleBytes, `trusttag-item-${Date.now()}.json`);
  const ipfsUri = `ipfs://${ipfsCid}`;

  return { integrityHash, ipfsCid, ipfsUri, bundle };
}

// ─────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
