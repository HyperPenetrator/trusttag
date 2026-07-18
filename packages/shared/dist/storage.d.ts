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
export declare class MockIPFSClient implements IIPFSClient {
    pin(data: Uint8Array<ArrayBuffer>, name: string): Promise<string>;
}
/**
 * Returns the canonical message the owner must sign to derive their
 * encryption key.  Expose this so the UI can display it to the user
 * before requesting the signature.
 */
export declare function getKeyDerivationMessage(): string;
/**
 * Derive an AES-256-GCM CryptoKey from the owner's wallet signature.
 *
 * @param signatureHex  The `0x`-prefixed hex signature returned by
 *                      `signMessage` / `personal_sign`.
 * @param salt          Optional base64 salt (provide when re-deriving to
 *                      decrypt; omit on first call to generate a new salt).
 * @returns { key, saltBase64 }
 */
export declare function deriveEncryptionKey(signatureHex: string, salt?: Uint8Array): Promise<{
    key: CryptoKey;
    saltBase64: string;
}>;
/**
 * AES-256-GCM encrypt a JSON-serialisable object.
 * Returns an EncryptedMetadataBundle ready for IPFS upload.
 */
export declare function encryptBundle(plaintext: object, key: CryptoKey, saltBase64: string): Promise<EncryptedMetadataBundle>;
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
export declare function computeIntegrityHash(bundle: EncryptedMetadataBundle): Promise<`0x${string}`>;
/**
 * Orchestrates the full encrypt → hash → pin flow.
 *
 * @param input        Form data from the registration UI.
 * @param signatureHex Owner's wallet signature for key derivation.
 * @param ipfsClient   Provide a real IIPFSClient in production; defaults to MockIPFSClient.
 * @returns PreparedMetadata — pass integrityHash to mintItem().
 */
export declare function prepareItemMetadata(input: ItemRegistrationInput, signatureHex: string, ipfsClient?: IIPFSClient): Promise<PreparedMetadata>;
