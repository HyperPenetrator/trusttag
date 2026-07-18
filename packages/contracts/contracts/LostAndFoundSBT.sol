// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LostAndFoundSBT is ERC721, Ownable {
    uint256 private _nextTokenId;

    struct ItemInfo {
        string metadataURI;       // Encrypted IPFS metadata content hash
        uint256 registrationDate; // Epoch timestamp of registration
        bool exists;
    }

    mapping(uint256 => ItemInfo) private _items;
    
    // Custom error for Soulbound transfer block
    error SoulboundTokenNonTransferable();
    error TokenDoesNotExist();

    event ItemRegistered(address indexed owner, uint256 indexed tokenId, string metadataURI);

    constructor() ERC721("ItemPassportSBT", "IPASS") Ownable(msg.sender) {}

    function mint(string calldata metadataURI) external returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);

        _items[tokenId] = ItemInfo({
            metadataURI: metadataURI,
            registrationDate: block.timestamp,
            exists: true
        });

        emit ItemRegistered(msg.sender, tokenId, metadataURI);
        return tokenId;
    }

    function getItem(uint256 tokenId) external view returns (string memory metadataURI, uint256 registrationDate) {
        if (!_items[tokenId].exists) revert TokenDoesNotExist();
        ItemInfo memory info = _items[tokenId];
        return (info.metadataURI, info.registrationDate);
    }

    // Override transfers to enforce Soulbound rules
    function transferFrom(address from, address to, uint256 tokenId) public override {
        revert SoulboundTokenNonTransferable();
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public override {
        revert SoulboundTokenNonTransferable();
    }
}
