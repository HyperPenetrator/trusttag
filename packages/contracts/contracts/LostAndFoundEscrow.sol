// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./LostAndFoundSBT.sol";

contract LostAndFoundEscrow {
    LostAndFoundSBT public immutable sbtContract;

    enum ItemStatus { Active, Lost, FoundPending, Recovered, Disputed }

    struct EscrowInfo {
        uint256 bounty;
        address finder;
        ItemStatus status;
        bytes32 challengeHash;      // Hashed answer to verification challenge
        string locationProposal;    // Anonymized proposed handoff details
        address[] jurors;
        mapping(address => bool) jurorVotes;
        uint256 votesForOwner;
        uint256 votesForFinder;
    }

    struct FinderStats {
        uint256 successfulRecoveries;
        uint256 points;
    }

    // Maps tokenId to Escrow metadata
    mapping(uint256 => EscrowInfo) public escrows;
    // Maps address to finder stats
    mapping(address => FinderStats) public finderStats;

    event ItemReportedLost(uint256 indexed tokenId, uint256 bounty);
    event LeadReported(uint256 indexed tokenId, address indexed finder, bytes32 challengeAnswerHash);
    event ChallengeVerified(uint256 indexed tokenId);
    event BountyReleased(uint256 indexed tokenId, address indexed finder, uint256 amount);
    event DisputeOpened(uint256 indexed tokenId);
    event DisputeResolved(uint256 indexed tokenId, address indexed winner);

    error NotItemOwner();
    error NotFinder();
    error InvalidStatus();
    error WrongChallengeAnswer();
    error DisputeAlreadyActive();
    error JurorAlreadyVoted();

    constructor(address _sbtAddress) {
        sbtContract = LostAndFoundSBT(_sbtAddress);
    }

    modifier onlyItemOwner(uint256 tokenId) {
        if (sbtContract.ownerOf(tokenId) != msg.sender) revert NotItemOwner();
        _;
    }

    // 1. Report item lost and post bounty
    function reportLost(uint256 tokenId, bytes32 challengeHash) external payable onlyItemOwner(tokenId) {
        EscrowInfo storage escrow = escrows[tokenId];
        
        escrow.bounty = msg.value;
        escrow.status = ItemStatus.Lost;
        escrow.challengeHash = challengeHash;
        escrow.finder = address(0);
        escrow.votesForOwner = 0;
        escrow.votesForFinder = 0;

        emit ItemReportedLost(tokenId, msg.value);
    }

    // 2. Finder reports found item with proposed handoff info and answer to challenge
    function reportFound(uint256 tokenId, string calldata locationProposal, bytes32 challengeAnswerHash) external {
        EscrowInfo storage escrow = escrows[tokenId];
        if (escrow.status != ItemStatus.Lost) revert InvalidStatus();

        escrow.status = ItemStatus.FoundPending;
        escrow.finder = msg.sender;
        escrow.locationProposal = locationProposal;

        emit LeadReported(tokenId, msg.sender, challengeAnswerHash);
    }

    // 3. Owner verifies challenge (providing the preimage answer string) and confirms handoff details
    function verifyChallengeAndConfirm(uint256 tokenId, string calldata secretPreimage) external onlyItemOwner(tokenId) {
        EscrowInfo storage escrow = escrows[tokenId];
        if (escrow.status != ItemStatus.FoundPending) revert InvalidStatus();

        if (keccak256(abi.encodePacked(secretPreimage)) != escrow.challengeHash) {
            revert WrongChallengeAnswer();
        }

        emit ChallengeVerified(tokenId);
    }

    // 4. Release bounty and record points when handoff completes (triggered by owner)
    function completeHandoffAndRelease(uint256 tokenId) external onlyItemOwner(tokenId) {
        EscrowInfo storage escrow = escrows[tokenId];
        if (escrow.status != ItemStatus.FoundPending) revert InvalidStatus();

        address finder = escrow.finder;
        uint256 rewardAmount = escrow.bounty;

        escrow.status = ItemStatus.Recovered;
        escrow.bounty = 0;

        // Reward Finder points: +10 points for verified lead-to-recovery
        finderStats[finder].successfulRecoveries += 1;
        finderStats[finder].points += 10;

        if (rewardAmount > 0) {
            payable(finder).transfer(rewardAmount);
        }

        emit BountyReleased(tokenId, finder, rewardAmount);
    }

    // 5. Open dispute if handoff fails or claims are contested
    function openDispute(uint256 tokenId) external {
        EscrowInfo storage escrow = escrows[tokenId];
        if (msg.sender != sbtContract.ownerOf(tokenId) && msg.sender != escrow.finder) revert NotItemOwner();
        if (escrow.status != ItemStatus.FoundPending) revert InvalidStatus();

        escrow.status = ItemStatus.Disputed;
        emit DisputeOpened(tokenId);
    }

    // 6. Juror voting mechanism for dispute resolution (simplified)
    function voteOnDispute(uint256 tokenId, bool voteForOwner) external {
        EscrowInfo storage escrow = escrows[tokenId];
        if (escrow.status != ItemStatus.Disputed) revert InvalidStatus();
        if (escrow.jurorVotes[msg.sender]) revert JurorAlreadyVoted();

        escrow.jurorVotes[msg.sender] = true;
        escrow.jurors.push(msg.sender);

        if (voteForOwner) {
            escrow.votesForOwner += 1;
        } else {
            escrow.votesForFinder += 1;
        }

        // Auto-resolve when 3 votes are collected
        if (escrow.jurors.length >= 3) {
            _resolveDispute(tokenId);
        }
    }

    function _resolveDispute(uint256 tokenId) internal {
        EscrowInfo storage escrow = escrows[tokenId];
        address owner = sbtContract.ownerOf(tokenId);
        address finder = escrow.finder;
        uint256 rewardAmount = escrow.bounty;

        escrow.bounty = 0;
        address winner;

        if (escrow.votesForOwner >= escrow.votesForFinder) {
            escrow.status = ItemStatus.Lost; // Returned bounty to owner
            payable(owner).transfer(rewardAmount);
            winner = owner;
        } else {
            escrow.status = ItemStatus.Recovered; // Transferred bounty to finder
            finderStats[finder].successfulRecoveries += 1;
            finderStats[finder].points += 10;
            payable(finder).transfer(rewardAmount);
            winner = finder;
        }

        emit DisputeResolved(tokenId, winner);
    }
}
