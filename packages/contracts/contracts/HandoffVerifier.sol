// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./RewardEscrow.sol";

/**
 * @title HandoffVerifier
 * @author TrustTag Protocol
 * @notice Stub contract representing the authorized handoff validation system.
 *         Only the owner (protocol admin) can call confirmHandoff, which instructs
 *         the RewardEscrow contract to release the locked reward to the finder.
 */
contract HandoffVerifier is Ownable {
    RewardEscrow public immutable rewardEscrow;

    event HandoffConfirmed(uint256 indexed tokenId, address indexed finder);

    constructor(address _rewardEscrow) Ownable(msg.sender) {
        require(_rewardEscrow != address(0), "Escrow address cannot be zero");
        rewardEscrow = RewardEscrow(_rewardEscrow);
    }

    /**
     * @notice Verifies the item handoff and triggers bounty release.
     * @param tokenId The PoCT token ID.
     * @param finder The verified finder's address.
     */
    function confirmHandoff(uint256 tokenId, address finder) external onlyOwner {
        emit HandoffConfirmed(tokenId, finder);
        rewardEscrow.releaseToFinder(tokenId, finder);
    }
}
