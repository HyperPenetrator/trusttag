// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./PoCT.sol";

/**
 * @title RewardEscrow
 * @author TrustTag Protocol
 * @notice Manages ERC-20 stablecoin bounty deposits tied to specific PoCT Soulbound Tokens.
 *         Secures funds until a handoff is verified, or allows the owner to reclaim
 *         funds after a custom timeout period expires.
 */
contract RewardEscrow is Ownable {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────
    // Structs & State
    // ─────────────────────────────────────────────

    struct EscrowDeposit {
        address depositor;       // Original owner who posted the bounty
        IERC20 token;            // The ERC-20 token used (e.g. USDC, USDT)
        uint256 amount;          // Locked reward amount
        uint256 releaseTimeout;  // Block timestamp after which owner can reclaim
        bool isActive;           // True if deposit is locked and active
    }

    /// @notice The Proof-of-Custody Token (SBT) registry.
    PoCT public immutable poctRegistry;

    /// @notice The contract authorized to verify handoffs and release funds (e.g. HandoffVerifier).
    address public handoffVerifier;

    /// @notice Default timeout duration (180 days).
    uint256 public constant DEFAULT_TIMEOUT = 180 days;

    /// @notice tokenId => active Escrow deposit details.
    mapping(uint256 => EscrowDeposit) private _deposits;

    // ─────────────────────────────────────────────
    // Custom Errors
    // ─────────────────────────────────────────────
    error Escrow__NotTokenOwner();
    error Escrow__NoActiveDeposit();
    error Escrow__DepositAlreadyActive();
    error Escrow__NotAuthorizedVerifier();
    error Escrow__TimeoutNotExpired();
    error Escrow__InvalidTimeout();
    error Escrow__ZeroAmount();

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────
    event BountyDeposited(
        uint256 indexed tokenId,
        address indexed depositor,
        address indexed token,
        uint256 amount,
        uint256 releaseTimeout
    );

    event BountyReleased(
        uint256 indexed tokenId,
        address indexed finder,
        address indexed token,
        uint256 amount
    );

    event BountyReclaimed(
        uint256 indexed tokenId,
        address indexed depositor,
        address indexed token,
        uint256 amount
    );

    event HandoffVerifierUpdated(address indexed oldVerifier, address indexed newVerifier);

    // ─────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────
    modifier onlyHandoffVerifier() {
        if (msg.sender != handoffVerifier) revert Escrow__NotAuthorizedVerifier();
        _;
      }

    // ─────────────────────────────────────────────
    // Constructor & Config
    // ─────────────────────────────────────────────

    constructor(address _poctRegistry) Ownable(msg.sender) {
        require(_poctRegistry != address(0), "PoCT address cannot be zero");
        poctRegistry = PoCT(_poctRegistry);
    }

    /**
     * @notice Set or update the handoff verifier contract address.
     * @param _handoffVerifier The new verifier address.
     */
    function setHandoffVerifier(address _handoffVerifier) external onlyOwner {
        require(_handoffVerifier != address(0), "Verifier address cannot be zero");
        emit HandoffVerifierUpdated(handoffVerifier, _handoffVerifier);
        handoffVerifier = _handoffVerifier;
    }

    // ─────────────────────────────────────────────
    // Core Write Functions
    // ─────────────────────────────────────────────

    /**
     * @notice Deposit an ERC-20 stablecoin bounty for a specific lost item.
     * @dev    Requires prior token approve() call.
     * @param tokenId The PoCT token ID associated with the lost item.
     * @param token The ERC-20 stablecoin token to lock.
     * @param amount The reward amount.
     * @param timeoutDuration The customizable timeout in seconds (0 defaults to 180 days).
     */
    function depositBounty(
        uint256 tokenId,
        IERC20 token,
        uint256 amount,
        uint256 timeoutDuration
    ) external {
        // Enforce that caller is the PoCT owner of the tokenId
        if (poctRegistry.ownerOf(tokenId) != msg.sender) revert Escrow__NotTokenOwner();
        if (amount == 0) revert Escrow__ZeroAmount();
        if (_deposits[tokenId].isActive) revert Escrow__DepositAlreadyActive();

        uint256 actualTimeout = timeoutDuration == 0 ? DEFAULT_TIMEOUT : timeoutDuration;
        uint256 releaseTimeout = block.timestamp + actualTimeout;

        _deposits[tokenId] = EscrowDeposit({
            depositor: msg.sender,
            token: token,
            amount: amount,
            releaseTimeout: releaseTimeout,
            isActive: true
        });

        emit BountyDeposited(tokenId, msg.sender, address(token), amount, releaseTimeout);

        // Pull stablecoin from depositor
        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    /**
     * @notice Releases the locked bounty to the verified finder.
     *         Can only be called by the authorized HandoffVerifier contract.
     * @param tokenId The PoCT token ID.
     * @param finder The address of the finder receiving the reward.
     */
    function releaseToFinder(uint256 tokenId, address finder) external onlyHandoffVerifier {
        EscrowDeposit storage deposit = _deposits[tokenId];
        if (!deposit.isActive) revert Escrow__NoActiveDeposit();
        require(finder != address(0), "Finder address cannot be zero");

        deposit.isActive = false;
        uint256 amount = deposit.amount;
        IERC20 token = deposit.token;

        emit BountyReleased(tokenId, finder, address(token), amount);

        // Push reward to finder
        token.safeTransfer(finder, amount);
    }

    /**
     * @notice Allows the original depositor to cancel the bounty and reclaim their locked tokens
     *         after the release timeout has expired.
     * @param tokenId The PoCT token ID.
     */
    function reclaimBounty(uint256 tokenId) external {
        EscrowDeposit storage deposit = _deposits[tokenId];
        if (!deposit.isActive) revert Escrow__NoActiveDeposit();
        if (deposit.depositor != msg.sender) revert Escrow__NotTokenOwner();
        if (block.timestamp < deposit.releaseTimeout) revert Escrow__TimeoutNotExpired();

        deposit.isActive = false;
        uint256 amount = deposit.amount;
        IERC20 token = deposit.token;

        emit BountyReclaimed(tokenId, msg.sender, address(token), amount);

        // Refund tokens to depositor
        token.safeTransfer(msg.sender, amount);
    }

    // ─────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────

    /**
     * @notice Retrieve the bounty deposit details for a PoCT token.
     * @param tokenId The PoCT token ID.
     */
    function getDeposit(uint256 tokenId)
        external
        view
        returns (
            address depositor,
            address token,
            uint256 amount,
            uint256 releaseTimeout,
            bool isActive
        )
    {
        EscrowDeposit storage deposit = _deposits[tokenId];
        return (
            deposit.depositor,
            address(deposit.token),
            deposit.amount,
            deposit.releaseTimeout,
            deposit.isActive
        );
    }
}
