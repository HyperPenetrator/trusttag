// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract LeadScore is Ownable {
    mapping(address => uint256) private balances;
    mapping(address => bool) public authorizedCallers;

    event ScoreAdded(address indexed user, uint256 amount, uint256 newScore);

    constructor() Ownable(msg.sender) {}

    function setCallerAuthorization(address caller, bool status) external onlyOwner {
        authorizedCallers[caller] = status;
    }

    // Triggered from RewardEscrow's releaseToFinder (+10) or FoundReport submission (+2)
    function addScore(address user, uint256 amount) external {
        require(authorizedCallers[msg.sender] || msg.sender == owner(), "Not authorized");
        balances[user] += amount;
        emit ScoreAdded(user, amount, balances[user]);
    }

    function getLeadScore(address user) external view returns (uint256) {
        return balances[user];
    }
    
    // getTopReporters(limit) - do NOT sort on-chain; backed by off-chain indexer aggregation (Section 1) reading emitted events.
    function getTopReporters(uint256 limit) external pure returns (address[] memory) {
        revert("Off-chain indexer responsibility");
    }
}
