"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockIPFSClient = void 0;
exports.getKeyDerivationMessage = getKeyDerivationMessage;
exports.deriveEncryptionKey = deriveEncryptionKey;
exports.encryptBundle = encryptBundle;
exports.computeIntegrityHash = computeIntegrityHash;
exports.prepareItemMetadata = prepareItemMetadata;
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
class MockIPFSClient {
    async pin(data, name) {
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
exports.MockIPFSClient = MockIPFSClient;
// ─────────────────────────────────────────────────────────────────
// Encryption utilities
// ─────────────────────────────────────────────────────────────────
/** Deterministic signing message used for key derivation. */
const KEY_DERIVATION_MESSAGE = 'TrustTag Protocol: I authorise encryption of my item metadata. ' +
    'This signature is used only for key derivation and does not transfer funds.';
/**
 * Returns the canonical message the owner must sign to derive their
 * encryption key.  Expose this so the UI can display it to the user
 * before requesting the signature.
 */
function getKeyDerivationMessage() {
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
async function deriveEncryptionKey(signatureHex, salt) {
    const sigBytes = hexToBytes(signatureHex);
    // Import signature as raw PBKDF2 key material
    const keyMaterial = await crypto.subtle.importKey('raw', sigBytes.buffer, { name: 'PBKDF2' }, false, ['deriveKey']);
    const actualSalt = salt != null
        ? salt
        : crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.deriveKey({
        name: 'PBKDF2',
        salt: actualSalt.buffer,
        iterations: 200_000,
        hash: 'SHA-256',
    }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, // not extractable — key never leaves SubtleCrypto
    ['encrypt', 'decrypt']);
    return { key, saltBase64: uint8ArrayToBase64(actualSalt) };
}
/**
 * AES-256-GCM encrypt a JSON-serialisable object.
 * Returns an EncryptedMetadataBundle ready for IPFS upload.
 */
async function encryptBundle(plaintext, key, saltBase64) {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(plaintext));
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit GCM IV
    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.buffer }, key, data.buffer);
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
async function computeIntegrityHash(bundle) {
    const cipherBytes = base64ToUint8Array(bundle.ciphertext);
    // We use SHA-256 here because SubtleCrypto doesn't expose Keccak-256.
    // The Solidity verifier stores whatever bytes32 we pass, so what
    // matters is that the same ciphertext always produces the same hash.
    // On-chain verification is done by the owner re-deriving and comparing.
    //
    // TODO: swap to keccak256 via `viem`'s `keccak256` helper for strict
    //       on-chain parity once a runtime keccak lib is added to shared.
    const hashBuf = await crypto.subtle.digest('SHA-256', cipherBytes.buffer);
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
async function prepareItemMetadata(input, signatureHex, ipfsClient = new MockIPFSClient()) {
    // 1. Derive encryption key from wallet signature
    const { key, saltBase64 } = await deriveEncryptionKey(signatureHex);
    // 2. Encrypt the metadata bundle
    const bundle = await encryptBundle(input, key, saltBase64);
    // 3. Compute integrity hash from the ciphertext
    const integrityHash = await computeIntegrityHash(bundle);
    // 4. Serialise the full envelope to bytes and pin to IPFS
    const bundleBytes = new TextEncoder().encode(JSON.stringify(bundle));
    const ipfsCid = await ipfsClient.pin(bundleBytes, `trusttag-item-${Date.now()}.json`);
    const ipfsUri = `ipfs://${ipfsCid}`;
    return { integrityHash, ipfsCid, ipfsUri, bundle };
}
// ─────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────
function hexToBytes(hex) {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
}
function uint8ArrayToBase64(arr) {
    let binary = '';
    for (let i = 0; i < arr.length; i++)
        binary += String.fromCharCode(arr[i]);
    return btoa(binary);
}
function base64ToUint8Array(b64) {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++)
        out[i] = binary.charCodeAt(i);
    return out;
}
