// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PoCT — Proof-of-Custody Token
 * @author TrustTag Protocol
 * @notice Non-transferable ERC-721 Soulbound Token representing verified physical-item
 *         ownership. One token per registered item, permanently bound to the registrant's
 *         wallet address.
 *
 * @dev Transfer and safeTransferFrom are unconditionally reverted for all callers,
 *      including the token owner, approved operators, and the contract admin.
 *      The ONLY way to move a token to a new wallet is via `recoverToNewWallet`,
 *      which is callable exclusively by the contract owner (protocol admin) after
 *      off-chain identity verification of the original registrant.
 *
 *      Data-flow principle (per TrustTag PRD §6):
 *        ON-CHAIN  → only hashes, status flags, timestamps.
 *        OFF-CHAIN → encrypted item photos, receipts, and identifying details,
 *                    stored on IPFS/Filecoin and content-addressed by the
 *                    `metadataIntegrityHash` stored in this contract.
 *
 *      Personal data MUST NOT be stored on-chain. Only `bytes32` integrity
 *      hashes are accepted by the minting function.
 */
contract PoCT is ERC721, Ownable {

    // ─────────────────────────────────────────────
    // Enums & Structs
    // ─────────────────────────────────────────────

    /**
     * @notice Lifecycle status of a registered item.
     * @dev    Status transitions are append-only in the happy path:
     *         SAFE → LOST → RECOVERED
     *         The admin may also transition LOST → SAFE (e.g. owner found it themselves).
     */
    enum ItemStatus {
        SAFE,       // Registered and with its owner
        LOST,       // Owner has declared the item missing
        RECOVERED   // Item has been returned and handoff confirmed on-chain
    }

    /**
     * @notice On-chain record for a registered item.
     * @dev    Contains ONLY hashes, timestamps, and status — no personal data.
     */
    struct ItemRecord {
        /**
         * @notice Keccak-256 hash of the encrypted off-chain metadata bundle.
         *
         * Any change to the bundle (photos, serial numbers, receipts, or any
         * other identifying details stored off-chain) changes this hash completely
         * and unpredictably — this proves the metadata has not been tampered with
         * since registration.
         *
         * This is NOT used for similarity matching; see Cortex's separate
         * perceptual hash (pHash) for that purpose.
         *
         * @dev The bundle itself is encrypted client-side before being pinned to
         *      IPFS/Filecoin. This hash is derived from the encrypted ciphertext,
         *      not the plaintext, so the raw metadata remains private.
         */
        bytes32 metadataIntegrityHash;

        /// @notice Block timestamp at the moment the SBT was minted.
        uint256 registrationTimestamp;

        /// @notice Current lifecycle status of the item.
        ItemStatus status;
    }

    // ─────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────

    /// @dev Auto-incrementing token ID counter.
    uint256 private _nextTokenId;

    /// @dev tokenId → on-chain item record.
    mapping(uint256 => ItemRecord) private _items;

    // ─────────────────────────────────────────────
    // Custom Errors
    // ─────────────────────────────────────────────

    /// @notice Thrown when any standard ERC-721 transfer is attempted.
    error PoCT__Soulbound();

    /// @notice Thrown when querying or acting on a token that does not exist.
    error PoCT__TokenDoesNotExist(uint256 tokenId);

    /// @notice Thrown when a non-owner account calls a token-owner-only function.
    error PoCT__CallerIsNotTokenOwner(uint256 tokenId, address caller);

    /// @notice Thrown when the proposed status transition is not permitted.
    error PoCT__InvalidStatusTransition(ItemStatus from, ItemStatus to);

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    /**
     * @notice Emitted when a new item is registered and its SBT minted.
     * @param registrant           The wallet that minted (and now owns) the token.
     * @param tokenId              The newly minted token ID.
     * @param metadataIntegrityHash Keccak-256 of the encrypted off-chain metadata bundle.
     * @param registrationTimestamp Block timestamp of registration.
     */
    event ItemRegistered(
        address indexed registrant,
        uint256 indexed tokenId,
        bytes32 indexed metadataIntegrityHash,
        uint256 registrationTimestamp
    );

    /**
     * @notice Emitted when an item's lifecycle status changes.
     * @param tokenId   The affected token.
     * @param oldStatus Previous status.
     * @param newStatus Updated status.
     * @param changedBy Address that triggered the transition.
     */
    event StatusChanged(
        uint256 indexed tokenId,
        ItemStatus oldStatus,
        ItemStatus newStatus,
        address indexed changedBy
    );

    /**
     * @notice Emitted when the contract admin moves a token to a new wallet
     *         following a verified lost-wallet recovery.
     * @param tokenId    The recovered token.
     * @param oldWallet  The original (lost) wallet address.
     * @param newWallet  The replacement wallet provided by the registrant.
     */
    event WalletRecovered(
        uint256 indexed tokenId,
        address indexed oldWallet,
        address indexed newWallet
    );

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    constructor() ERC721("ProofOfCustodyToken", "PoCT") Ownable(msg.sender) {}

    // ─────────────────────────────────────────────
    // Core Write Functions
    // ─────────────────────────────────────────────

    /**
     * @notice Register a physical item and mint a non-transferable Proof-of-Custody Token.
     * @dev    Any wallet may self-register items. One token is minted per call.
     *         `metadataIntegrityHash` must be the Keccak-256 hash of the *encrypted*
     *         metadata bundle already pinned to IPFS/Filecoin by the caller.
     *         Passing a hash of unencrypted data or raw plaintext is a protocol
     *         violation and degrades privacy, but cannot be prevented on-chain.
     * @param metadataIntegrityHash Keccak-256 hash of the encrypted off-chain metadata bundle.
     * @return tokenId The ID of the freshly minted token.
     */
    function mintItem(bytes32 metadataIntegrityHash) external returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);

        _items[tokenId] = ItemRecord({
            metadataIntegrityHash: metadataIntegrityHash,
            registrationTimestamp: block.timestamp,
            status: ItemStatus.SAFE
        });

        emit ItemRegistered(msg.sender, tokenId, metadataIntegrityHash, block.timestamp);
    }

    /**
     * @notice Update the lifecycle status of a registered item.
     * @dev    Only the current token owner may call this function.
     *         Permitted transitions:
     *           SAFE → LOST       (owner declares item missing)
     *           LOST → RECOVERED  (owner confirms handoff)
     *           LOST → SAFE       (owner found it without external help)
     *         RECOVERED is a terminal state; no further transitions are allowed.
     * @param tokenId The token whose status is being updated.
     * @param newStatus The target status.
     */
    function setStatus(uint256 tokenId, ItemStatus newStatus) external {
        _requireTokenExists(tokenId);
        _requireCallerIsTokenOwner(tokenId);

        ItemStatus current = _items[tokenId].status;

        // Enforce valid transition graph
        if (current == ItemStatus.SAFE && newStatus == ItemStatus.LOST) {
            // SAFE → LOST: allowed
        } else if (current == ItemStatus.LOST && newStatus == ItemStatus.RECOVERED) {
            // LOST → RECOVERED: allowed
        } else if (current == ItemStatus.LOST && newStatus == ItemStatus.SAFE) {
            // LOST → SAFE: owner found the item themselves
        } else {
            revert PoCT__InvalidStatusTransition(current, newStatus);
        }

        _items[tokenId].status = newStatus;
        emit StatusChanged(tokenId, current, newStatus, msg.sender);
    }

    /**
     * @notice Admin-only: transfer a token from a lost wallet to a replacement wallet
     *         after the original registrant's identity has been verified off-chain.
     * @dev    This is the SOLE mechanism by which a PoCT token can change hands.
     *         It bypasses the Soulbound transfer block intentionally.
     *         The admin MUST perform rigorous off-chain verification (government ID,
     *         unique item challenge-response, etc.) before calling this function.
     *         Emits {WalletRecovered}.
     * @param tokenId   The token to migrate.
     * @param newWallet The replacement wallet address provided by the verified registrant.
     */
    function recoverToNewWallet(uint256 tokenId, address newWallet) external onlyOwner {
        _requireTokenExists(tokenId);
        require(newWallet != address(0), "PoCT: new wallet is zero address");

        address oldWallet = ownerOf(tokenId);
        // Internal transfer bypasses our Soulbound override (calls _update directly)
        _transfer(oldWallet, newWallet, tokenId);

        emit WalletRecovered(tokenId, oldWallet, newWallet);
    }

    // ─────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────

    /**
     * @notice Retrieve the full on-chain record for a registered item.
     * @param tokenId The token to query.
     * @return metadataIntegrityHash Keccak-256 hash of the encrypted off-chain metadata bundle.
     * @return registrationTimestamp Block timestamp at the time of registration.
     * @return status               Current lifecycle status of the item.
     */
    function getItem(uint256 tokenId)
        external
        view
        returns (
            bytes32 metadataIntegrityHash,
            uint256 registrationTimestamp,
            ItemStatus status
        )
    {
        _requireTokenExists(tokenId);
        ItemRecord storage rec = _items[tokenId];
        return (rec.metadataIntegrityHash, rec.registrationTimestamp, rec.status);
    }

    // ─────────────────────────────────────────────
    // Soulbound Transfer Overrides
    // ─────────────────────────────────────────────

    /**
     * @dev Unconditionally reverts. Soulbound tokens are non-transferable.
     *      Use `recoverToNewWallet` (admin-only) for lost-wallet recovery.
     */
    function transferFrom(address, address, uint256) public pure override {
        revert PoCT__Soulbound();
    }

    /**
     * @dev Unconditionally reverts. Soulbound tokens are non-transferable.
     *      Use `recoverToNewWallet` (admin-only) for lost-wallet recovery.
     */
    function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
        revert PoCT__Soulbound();
    }

    // ─────────────────────────────────────────────
    // Internal Helpers
    // ─────────────────────────────────────────────

    /**
     * @dev Reverts if `tokenId` has never been minted (or was burned).
     *      Uses the ERC-721 `_ownerOf` internal to avoid external call overhead.
     */
    function _requireTokenExists(uint256 tokenId) internal view {
        if (_ownerOf(tokenId) == address(0)) {
            revert PoCT__TokenDoesNotExist(tokenId);
        }
    }

    /**
     * @dev Reverts if `msg.sender` is not the current ERC-721 owner of `tokenId`.
     */
    function _requireCallerIsTokenOwner(uint256 tokenId) internal view {
        if (ownerOf(tokenId) != msg.sender) {
            revert PoCT__CallerIsNotTokenOwner(tokenId, msg.sender);
        }
    }
}
