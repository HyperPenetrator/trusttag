import { expect } from "chai";
import { ethers } from "hardhat";

describe("LedgerCourt", function () {
  let court: any;
  let token: any;
  let randomness: any;
  let owner: any, juror1: any, juror2: any, juror3: any, creator: any, against: any;

  beforeEach(async function () {
    [owner, juror1, juror2, juror3, creator, against] = await ethers.getSigners();
    
    const Token = await ethers.getContractFactory("MockStablecoin");
    token = await Token.deploy();
    
    // Deploy a mock randomness source
    const MockRandom = await ethers.getContractFactory("MockJurorRandomness");
    randomness = await MockRandom.deploy();

    const Court = await ethers.getContractFactory("LedgerCourt");
    court = await Court.deploy(await token.getAddress(), await randomness.getAddress());

    // Mint tokens
    const stake = ethers.parseEther("1000");
    await token.mint(juror1.address, stake);
    await token.mint(juror2.address, stake);
    await token.mint(juror3.address, stake);
    
    await token.connect(juror1).approve(await court.getAddress(), stake);
    await token.connect(juror2).approve(await court.getAddress(), stake);
    await token.connect(juror3).approve(await court.getAddress(), stake);
  });

  it("should enforce bootstrap mode restriction", async function () {
    await expect(court.connect(juror1).stakeAsJuror()).to.be.revertedWith("Not eligible in bootstrap mode");
    
    await court.whitelistJuror(juror1.address, true);
    await expect(court.connect(juror1).stakeAsJuror()).to.not.be.reverted;
  });

  it("should allow raising a dispute and voting", async function () {
    await court.whitelistJuror(juror1.address, true);
    await court.whitelistJuror(juror2.address, true);
    await court.whitelistJuror(juror3.address, true);

    await court.connect(juror1).stakeAsJuror();
    await court.connect(juror2).stakeAsJuror();
    await court.connect(juror3).stakeAsJuror();

    await court.connect(creator).raiseDispute(1, "hash123", against.address);
    const disputeId = 0;

    // Jurors vote
    await court.connect(juror1).vote(disputeId, true); // for creator
    await court.connect(juror2).vote(disputeId, true); // for creator
    await court.connect(juror3).vote(disputeId, false); // against creator

    // Fast forward time
    await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);

    await court.resolveDispute(disputeId);
    
    const dispute = await court.disputes(disputeId);
    expect(dispute.resolved).to.be.true;
    expect(dispute.creatorWon).to.be.true; // 2 vs 1
  });
});
