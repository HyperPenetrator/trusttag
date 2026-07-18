// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockJurorRandomness {
    function getRandomJurors(uint256, uint256 count, uint256 maxJurors) external pure returns (uint256[] memory) {
        uint256[] memory indices = new uint256[](count);
        for (uint i = 0; i < count; i++) {
            indices[i] = i % maxJurors; // Just returns 0, 1, 2 sequentially for testing
        }
        return indices;
    }
}
