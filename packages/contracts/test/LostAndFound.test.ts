import { expect } from "chai";
import { ethers } from "hardhat";
import { LostAndFoundSBT, LostAndFoundEscrow } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Lost & Found System", function () {
  let sbt: LostAndFoundSBT;
  let escrow: LostAndFoundEscrow;
  let owner: HardhatEthersSigner;
  let finder: HardhatEthersSigner;
  let juror1: HardhatEthersSigner;
  let juror2: HardhatEthersSigner;
  let juror3: HardhatEthersSigner;

  const metadataURI = "ipfs://QmYwAPJzv5CZ1A3m91355615715";
  const secretAnswer = "mySecretMacbookMarkings";
  let challengeHash: string;
  let tokenId: bigint;

  beforeEach(async function () {
    [owner, finder, juror1, juror2, juror3] = await ethers.getSigners();

    // 1. Deploy SBT
    const SBTFactory = await ethers.getContractFactory("LostAndFoundSBT");
    sbt = (await SBTFactory.deploy()) as unknown as LostAndFoundSBT;
    await sbt.waitForDeployment();

    // 2. Deploy Escrow
    const EscrowFactory = await ethers.getContractFactory("LostAndFoundEscrow");
    escrow = (await EscrowFactory.deploy(await sbt.getAddress())) as unknown as LostAndFoundEscrow;
    await escrow.waitForDeployment();

    // 3. Mint SBT to owner
    const tx = await sbt.connect(owner).mint(metadataURI);
    const receipt = await tx.wait();
    
    // Find tokenId from events
    tokenId = 0n; // first minted tokenId is 0
    challengeHash = ethers.solidityPackedKeccak256(["string"], [secretAnswer]);
  });

  describe("Soulbound Token Registry", function () {
    it("Should mint SBT with correct metadata and timestamp", async function () {
      const [uri, date] = await sbt.getItem(tokenId);
      expect(uri).to.equal(metadataURI);
      expect(date).to.be.gt(0n);
    });

    it("Should prevent transfer of SBTs", async function () {
      await expect(
        sbt.connect(owner).transferFrom(owner.address, finder.address, tokenId)
      ).to.be.revertedWithCustomError(sbt, "SoulboundTokenNonTransferable");
    });
  });

  describe("Bounty Escrow and Recovery Workflow", function () {
    it("Should allow owner to report lost and lock bounty", async function () {
      const bounty = ethers.parseEther("1.0");
      await escrow.connect(owner).reportLost(tokenId, challengeHash, { value: bounty });
      
      const escrowDetails = await escrow.escrows(tokenId);
      expect(escrowDetails.bounty).to.equal(bounty);
      expect(escrowDetails.status).to.equal(1); // ItemStatus.Lost
    });

    it("Should process finding, verification challenge, and release rewards", async function () {
      const bounty = ethers.parseEther("1.0");
      await escrow.connect(owner).reportLost(tokenId, challengeHash, { value: bounty });

      // Finder reports found
      const answerHash = ethers.solidityPackedKeccak256(["string"], [secretAnswer]);
      await escrow.connect(finder).reportFound(tokenId, "Terminal 2 Locker 45", answerHash);

      let escrowDetails = await escrow.escrows(tokenId);
      expect(escrowDetails.status).to.equal(2); // FoundPending
      expect(escrowDetails.finder).to.equal(finder.address);

      // Owner verifies challenge
      await escrow.connect(owner).verifyChallengeAndConfirm(tokenId, secretAnswer);

      // Complete handoff and verify payout
      const initialFinderBalance = await ethers.provider.getBalance(finder.address);
      
      const completeTx = await escrow.connect(owner).completeHandoffAndRelease(tokenId);
      await completeTx.wait();

      const finalFinderBalance = await ethers.provider.getBalance(finder.address);
      expect(finalFinderBalance).to.be.gt(initialFinderBalance);

      // Verify points (+10 points)
      const stats = await escrow.finderStats(finder.address);
      expect(stats.points).to.equal(10n);
      expect(stats.successfulRecoveries).to.equal(1n);
    });

    it("Should support dispute resolution via jurors", async function () {
      const bounty = ethers.parseEther("1.0");
      await escrow.connect(owner).reportLost(tokenId, challengeHash, { value: bounty });

      const answerHash = ethers.solidityPackedKeccak256(["string"], [secretAnswer]);
      await escrow.connect(finder).reportFound(tokenId, "Public Handoff Venue", answerHash);

      // Open Dispute
      await escrow.connect(owner).openDispute(tokenId);

      // Jurors vote
      await escrow.connect(juror1).voteOnDispute(tokenId, false); // Vote finder
      await escrow.connect(juror2).voteOnDispute(tokenId, false); // Vote finder
      
      // Third vote triggers resolution
      const initialFinderBalance = await ethers.provider.getBalance(finder.address);
      await escrow.connect(juror3).voteOnDispute(tokenId, false); // Vote finder

      const finalFinderBalance = await ethers.provider.getBalance(finder.address);
      expect(finalFinderBalance).to.be.gt(initialFinderBalance);

      const escrowDetails = await escrow.escrows(tokenId);
      expect(escrowDetails.status).to.equal(3); // Recovered (since finder won)
    });
  });
});
