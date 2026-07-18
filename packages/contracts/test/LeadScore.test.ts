import { expect } from "chai";
import { ethers } from "hardhat";

describe("LeadScore", function () {
  let leadScore: any;
  let owner: any, user: any, rewardEscrow: any;

  beforeEach(async function () {
    [owner, user, rewardEscrow] = await ethers.getSigners();
    
    const LeadScore = await ethers.getContractFactory("LeadScore");
    leadScore = await LeadScore.deploy();
  });

  it("should allow adding score by authorized caller", async function () {
    await leadScore.setCallerAuthorization(rewardEscrow.address, true);
    await leadScore.connect(rewardEscrow).addScore(user.address, 10);
    
    expect(await leadScore.getLeadScore(user.address)).to.equal(10);
  });

  it("should not allow unauthorized caller", async function () {
    await expect(leadScore.connect(user).addScore(user.address, 10)).to.be.revertedWith("Not authorized");
  });
  
  it("should revert on getTopReporters", async function () {
    await expect(leadScore.getTopReporters(10)).to.be.revertedWith("Off-chain indexer responsibility");
  });
});
