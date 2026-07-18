import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { RewardEscrow, PoCT, MockStablecoin, HandoffVerifier } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("RewardEscrow & Gas Checks", function () {
  let poct: PoCT;
  let escrow: RewardEscrow;
  let token: MockStablecoin;
  let verifier: HandoffVerifier;

  let admin: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let finder: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  const BOUNTY_AMOUNT = ethers.parseEther("100"); // 100 stablecoins
  const INTEGRITY_HASH = ethers.keccak256(ethers.toUtf8Bytes("ipfs-bundle"));
  const TIMEOUT = 180 * 24 * 3600; // 180 days

  beforeEach(async function () {
    [admin, owner, finder, stranger] = await ethers.getSigners();

    // 1. Deploy PoCT
    const PoCTFactory = await ethers.getContractFactory("PoCT");
    poct = (await PoCTFactory.deploy()) as unknown as PoCT;
    await poct.waitForDeployment();

    // 2. Deploy RewardEscrow
    const EscrowFactory = await ethers.getContractFactory("RewardEscrow");
    escrow = (await EscrowFactory.deploy(await poct.getAddress())) as unknown as RewardEscrow;
    await escrow.waitForDeployment();

    // 3. Deploy HandoffVerifier stub
    const VerifierFactory = await ethers.getContractFactory("HandoffVerifier");
    verifier = (await VerifierFactory.deploy(await escrow.getAddress())) as unknown as HandoffVerifier;
    await verifier.waitForDeployment();

    // Set verifier in escrow
    await escrow.connect(admin).setHandoffVerifier(await verifier.getAddress());

    // 4. Deploy MockStablecoin
    const TokenFactory = await ethers.getContractFactory("MockStablecoin");
    token = (await TokenFactory.deploy()) as unknown as MockStablecoin;
    await token.waitForDeployment();

    // Mint stablecoins to owner and approve escrow
    await token.connect(admin).mint(owner.address, BOUNTY_AMOUNT * 2n);
    await token.connect(owner).approve(await escrow.getAddress(), BOUNTY_AMOUNT * 2n);

    // Mint PoCT item to owner
    await poct.connect(owner).mintItem(INTEGRITY_HASH);
  });

  // ================================================================
  // 1. Deposit
  // ================================================================
  describe("Deposit", function () {
    it("should allow PoCT owner to deposit bounty", async function () {
      const tx = await escrow.connect(owner).depositBounty(0n, await token.getAddress(), BOUNTY_AMOUNT, 0n);
      await expect(tx)
        .to.emit(escrow, "BountyDeposited")
        .withArgs(0n, owner.address, await token.getAddress(), BOUNTY_AMOUNT, (ts: bigint) => ts > 0n);

      const [depositor, tokenAddr, amount, timeout, isActive] = await escrow.getDeposit(0n);
      expect(depositor).to.equal(owner.address);
      expect(tokenAddr).to.equal(await token.getAddress());
      expect(amount).to.equal(BOUNTY_AMOUNT);
      expect(isActive).to.be.true;

      // Escrow contract should hold the tokens
      expect(await token.balanceOf(await escrow.getAddress())).to.equal(BOUNTY_AMOUNT);
    });

    it("should revert if depositor is not the PoCT owner", async function () {
      await expect(
        escrow.connect(stranger).depositBounty(0n, await token.getAddress(), BOUNTY_AMOUNT, 0n)
      ).to.be.revertedWithCustomError(escrow, "Escrow__NotTokenOwner");
    });

    it("should revert if deposit is already active for tokenId", async function () {
      await escrow.connect(owner).depositBounty(0n, await token.getAddress(), BOUNTY_AMOUNT, 0n);
      await expect(
        escrow.connect(owner).depositBounty(0n, await token.getAddress(), BOUNTY_AMOUNT, 0n)
      ).to.be.revertedWithCustomError(escrow, "Escrow__DepositAlreadyActive");
    });
  });

  // ================================================================
  // 2. Release
  // ================================================================
  describe("Release", function () {
    beforeEach(async function () {
      await escrow.connect(owner).depositBounty(0n, await token.getAddress(), BOUNTY_AMOUNT, 0n);
    });

    it("should release bounty to finder via handoff verifier", async function () {
      const tx = await verifier.connect(admin).confirmHandoff(0n, finder.address);
      await expect(tx)
        .to.emit(escrow, "BountyReleased")
        .withArgs(0n, finder.address, await token.getAddress(), BOUNTY_AMOUNT);

      const [, , , , isActive] = await escrow.getDeposit(0n);
      expect(isActive).to.be.false;

      // Finder should have received the tokens
      expect(await token.balanceOf(finder.address)).to.equal(BOUNTY_AMOUNT);
    });

    it("should revert if releaseToFinder is called directly by non-verifier", async function () {
      await expect(
        escrow.connect(admin).releaseToFinder(0n, finder.address)
      ).to.be.revertedWithCustomError(escrow, "Escrow__NotAuthorizedVerifier");
    });
  });

  // ================================================================
  // 3. Reclaim
  // ================================================================
  describe("Reclaim", function () {
    beforeEach(async function () {
      await escrow.connect(owner).depositBounty(0n, await token.getAddress(), BOUNTY_AMOUNT, BigInt(TIMEOUT));
    });

    it("should prevent reclaim before timeout expires", async function () {
      await expect(
        escrow.connect(owner).reclaimBounty(0n)
      ).to.be.revertedWithCustomError(escrow, "Escrow__TimeoutNotExpired");
    });

    it("should allow reclaim after timeout expires", async function () {
      // Advance time by TIMEOUT + 1 second
      await time.increase(TIMEOUT + 1);

      const tx = await escrow.connect(owner).reclaimBounty(0n);
      await expect(tx)
        .to.emit(escrow, "BountyReclaimed")
        .withArgs(0n, owner.address, await token.getAddress(), BOUNTY_AMOUNT);

      const [, , , , isActive] = await escrow.getDeposit(0n);
      expect(isActive).to.be.false;

      // Owner balance should be restored
      expect(await token.balanceOf(owner.address)).to.equal(BOUNTY_AMOUNT * 2n);
    });
  });

  // ================================================================
  // 4. Gas Guard Limits (PRD Verification)
  // ================================================================
  describe("Gas Guard Verification", function () {
    it("should enforce mintItem gas limit of 150,000 gas", async function () {
      const tx = await poct.connect(owner).mintItem(ethers.keccak256(ethers.toUtf8Bytes("item-gas-test")));
      const receipt = await tx.wait();
      const gasUsed = receipt?.gasUsed ?? 0n;

      console.log(`\n      [Gas Report] mintItem() used: ${gasUsed.toString()} gas`);
      expect(gasUsed).to.be.lessThan(150000n, "mintItem() gas limit exceeded 150,000 gas!");
    });

    it("should enforce setStatus gas limit of 80,000 gas", async function () {
      // Must mint first
      const txMint = await poct.connect(owner).mintItem(ethers.keccak256(ethers.toUtf8Bytes("status-gas-test")));
      const receiptMint = await txMint.wait();
      // Token ID is 1 (0 was minted in beforeEach)
      const tokenId = 1n;

      const txStatus = await poct.connect(owner).setStatus(tokenId, 1 /* LOST */);
      const receiptStatus = await txStatus.wait();
      const gasUsed = receiptStatus?.gasUsed ?? 0n;

      console.log(`      [Gas Report] setStatus() used: ${gasUsed.toString()} gas`);
      expect(gasUsed).to.be.lessThan(80000n, "setStatus() gas limit exceeded 80,000 gas!");
    });
  });
});
