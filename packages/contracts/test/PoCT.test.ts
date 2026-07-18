import { expect } from "chai";
import { ethers } from "hardhat";
import { PoCT } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/** Returns a deterministic bytes32 integrity hash from a string seed. */
function makeIntegrityHash(seed: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(seed));
}

const SAMPLE_HASH = makeIntegrityHash("encrypted-ipfs-metadata-bundle-v1");

// ------------------------------------------------------------------
// Test Suite
// ------------------------------------------------------------------

describe("PoCT — Proof-of-Custody Token", function () {
  let poct: PoCT;
  let admin: HardhatEthersSigner;   // deployer / contract owner
  let alice: HardhatEthersSigner;   // item registrant
  let bob: HardhatEthersSigner;     // third party (no ownership rights)
  let carol: HardhatEthersSigner;   // replacement wallet for recovery test

  beforeEach(async function () {
    [admin, alice, bob, carol] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("PoCT");
    poct = (await Factory.deploy()) as unknown as PoCT;
    await poct.waitForDeployment();
  });

  // ================================================================
  // 1. Deployment sanity
  // ================================================================

  describe("Deployment", function () {
    it("should deploy with correct name and symbol", async function () {
      expect(await poct.name()).to.equal("ProofOfCustodyToken");
      expect(await poct.symbol()).to.equal("PoCT");
    });

    it("should set deployer as contract owner (admin)", async function () {
      expect(await poct.owner()).to.equal(admin.address);
    });
  });

  // ================================================================
  // 2. Minting
  // ================================================================

  describe("mintItem", function () {
    it("should mint a token to the caller and store the integrity hash", async function () {
      const tx = await poct.connect(alice).mintItem(SAMPLE_HASH);
      const receipt = await tx.wait();

      // Token 0 should belong to Alice
      expect(await poct.ownerOf(0n)).to.equal(alice.address);

      // Stored record must match
      const [hash, timestamp, status] = await poct.getItem(0n);
      expect(hash).to.equal(SAMPLE_HASH);
      expect(timestamp).to.be.gt(0n);
      expect(status).to.equal(0n); // ItemStatus.SAFE
    });

    it("should emit ItemRegistered with correct arguments", async function () {
      await expect(poct.connect(alice).mintItem(SAMPLE_HASH))
        .to.emit(poct, "ItemRegistered")
        .withArgs(
          alice.address,
          0n,
          SAMPLE_HASH,
          // timestamp is block.timestamp — we accept any positive value
          (ts: bigint) => ts > 0n
        );
    });

    it("should auto-increment tokenIds for successive mints", async function () {
      await poct.connect(alice).mintItem(makeIntegrityHash("bundle-1"));
      await poct.connect(alice).mintItem(makeIntegrityHash("bundle-2"));
      await poct.connect(bob).mintItem(makeIntegrityHash("bundle-3"));

      expect(await poct.ownerOf(0n)).to.equal(alice.address);
      expect(await poct.ownerOf(1n)).to.equal(alice.address);
      expect(await poct.ownerOf(2n)).to.equal(bob.address);
    });

    it("should allow different callers to mint their own tokens", async function () {
      await poct.connect(alice).mintItem(SAMPLE_HASH);
      await poct.connect(bob).mintItem(SAMPLE_HASH);

      expect(await poct.ownerOf(0n)).to.equal(alice.address);
      expect(await poct.ownerOf(1n)).to.equal(bob.address);
    });
  });

  // ================================================================
  // 3. Transfer reverts (Soulbound enforcement)
  // ================================================================

  describe("Soulbound — transfer reverts", function () {
    beforeEach(async function () {
      await poct.connect(alice).mintItem(SAMPLE_HASH);
    });

    it("should revert transferFrom with PoCT__Soulbound", async function () {
      await expect(
        poct.connect(alice).transferFrom(alice.address, bob.address, 0n)
      ).to.be.revertedWithCustomError(poct, "PoCT__Soulbound");
    });

    it("should revert safeTransferFrom (4-arg) with PoCT__Soulbound", async function () {
      await expect(
        // ethers v6 routes the 4-arg variant automatically
        (poct.connect(alice) as PoCT)["safeTransferFrom(address,address,uint256,bytes)"](
          alice.address, bob.address, 0n, "0x"
        )
      ).to.be.revertedWithCustomError(poct, "PoCT__Soulbound");
    });

    it("should revert transferFrom even when called by a third party (not just owner)", async function () {
      await expect(
        poct.connect(bob).transferFrom(alice.address, bob.address, 0n)
      ).to.be.revertedWithCustomError(poct, "PoCT__Soulbound");
    });

    it("should revert transferFrom even when called by the contract admin", async function () {
      await expect(
        poct.connect(admin).transferFrom(alice.address, bob.address, 0n)
      ).to.be.revertedWithCustomError(poct, "PoCT__Soulbound");
    });
  });

  // ================================================================
  // 4. Status transitions
  // ================================================================

  describe("setStatus — valid transitions", function () {
    beforeEach(async function () {
      await poct.connect(alice).mintItem(SAMPLE_HASH);
    });

    it("should allow owner to transition SAFE → LOST", async function () {
      await expect(poct.connect(alice).setStatus(0n, 1 /* LOST */))
        .to.emit(poct, "StatusChanged")
        .withArgs(0n, 0n /* SAFE */, 1n /* LOST */, alice.address);

      const [, , status] = await poct.getItem(0n);
      expect(status).to.equal(1n); // LOST
    });

    it("should allow owner to transition LOST → RECOVERED", async function () {
      await poct.connect(alice).setStatus(0n, 1 /* LOST */);

      await expect(poct.connect(alice).setStatus(0n, 2 /* RECOVERED */))
        .to.emit(poct, "StatusChanged")
        .withArgs(0n, 1n /* LOST */, 2n /* RECOVERED */, alice.address);

      const [, , status] = await poct.getItem(0n);
      expect(status).to.equal(2n); // RECOVERED
    });

    it("should allow owner to transition LOST → SAFE (found by themselves)", async function () {
      await poct.connect(alice).setStatus(0n, 1 /* LOST */);
      await poct.connect(alice).setStatus(0n, 0 /* SAFE */);

      const [, , status] = await poct.getItem(0n);
      expect(status).to.equal(0n); // SAFE
    });
  });

  describe("setStatus — invalid / disallowed transitions", function () {
    beforeEach(async function () {
      await poct.connect(alice).mintItem(SAMPLE_HASH);
    });

    it("should revert SAFE → RECOVERED (skipping LOST)", async function () {
      await expect(
        poct.connect(alice).setStatus(0n, 2 /* RECOVERED */)
      ).to.be.revertedWithCustomError(poct, "PoCT__InvalidStatusTransition");
    });

    it("should revert SAFE → SAFE (no-op / idempotent not permitted)", async function () {
      await expect(
        poct.connect(alice).setStatus(0n, 0 /* SAFE */)
      ).to.be.revertedWithCustomError(poct, "PoCT__InvalidStatusTransition");
    });

    it("should revert RECOVERED → SAFE (terminal state)", async function () {
      await poct.connect(alice).setStatus(0n, 1 /* LOST */);
      await poct.connect(alice).setStatus(0n, 2 /* RECOVERED */);

      await expect(
        poct.connect(alice).setStatus(0n, 0 /* SAFE */)
      ).to.be.revertedWithCustomError(poct, "PoCT__InvalidStatusTransition");
    });

    it("should revert RECOVERED → LOST (terminal state)", async function () {
      await poct.connect(alice).setStatus(0n, 1 /* LOST */);
      await poct.connect(alice).setStatus(0n, 2 /* RECOVERED */);

      await expect(
        poct.connect(alice).setStatus(0n, 1 /* LOST */)
      ).to.be.revertedWithCustomError(poct, "PoCT__InvalidStatusTransition");
    });
  });

  // ================================================================
  // 5. Unauthorized status changes
  // ================================================================

  describe("setStatus — authorization enforcement", function () {
    beforeEach(async function () {
      await poct.connect(alice).mintItem(SAMPLE_HASH);
    });

    it("should revert when a non-owner (bob) tries to set status", async function () {
      await expect(
        poct.connect(bob).setStatus(0n, 1 /* LOST */)
      ).to.be.revertedWithCustomError(poct, "PoCT__CallerIsNotTokenOwner");
    });

    it("should revert when the contract admin tries to set status (not token owner)", async function () {
      await expect(
        poct.connect(admin).setStatus(0n, 1 /* LOST */)
      ).to.be.revertedWithCustomError(poct, "PoCT__CallerIsNotTokenOwner");
    });

    it("should revert setStatus on a non-existent token", async function () {
      await expect(
        poct.connect(alice).setStatus(999n, 1 /* LOST */)
      ).to.be.revertedWithCustomError(poct, "PoCT__TokenDoesNotExist");
    });
  });

  // ================================================================
  // 6. getItem — view function
  // ================================================================

  describe("getItem", function () {
    it("should return correct record immediately after mint", async function () {
      const specificHash = makeIntegrityHash("unique-encrypted-bundle-xyz");
      await poct.connect(alice).mintItem(specificHash);

      const [hash, timestamp, status] = await poct.getItem(0n);
      expect(hash).to.equal(specificHash);
      expect(timestamp).to.be.gt(0n);
      expect(status).to.equal(0n); // SAFE
    });

    it("should revert getItem on a non-existent token", async function () {
      await expect(poct.getItem(42n))
        .to.be.revertedWithCustomError(poct, "PoCT__TokenDoesNotExist");
    });

    it("should reflect status change after setStatus call", async function () {
      await poct.connect(alice).mintItem(SAMPLE_HASH);
      await poct.connect(alice).setStatus(0n, 1 /* LOST */);

      const [, , status] = await poct.getItem(0n);
      expect(status).to.equal(1n); // LOST
    });
  });

  // ================================================================
  // 7. Admin wallet recovery
  // ================================================================

  describe("recoverToNewWallet", function () {
    beforeEach(async function () {
      await poct.connect(alice).mintItem(SAMPLE_HASH);
    });

    it("should allow admin to transfer token to a new wallet", async function () {
      await expect(poct.connect(admin).recoverToNewWallet(0n, carol.address))
        .to.emit(poct, "WalletRecovered")
        .withArgs(0n, alice.address, carol.address);

      expect(await poct.ownerOf(0n)).to.equal(carol.address);
    });

    it("should revert recoverToNewWallet when called by non-admin", async function () {
      await expect(
        poct.connect(alice).recoverToNewWallet(0n, carol.address)
      ).to.be.revertedWithCustomError(poct, "OwnableUnauthorizedAccount");
    });

    it("should revert recoverToNewWallet when called by a random account", async function () {
      await expect(
        poct.connect(bob).recoverToNewWallet(0n, carol.address)
      ).to.be.revertedWithCustomError(poct, "OwnableUnauthorizedAccount");
    });

    it("should revert recoverToNewWallet with zero address as newWallet", async function () {
      await expect(
        poct.connect(admin).recoverToNewWallet(0n, ethers.ZeroAddress)
      ).to.be.reverted;
    });

    it("should revert recoverToNewWallet on non-existent token", async function () {
      await expect(
        poct.connect(admin).recoverToNewWallet(999n, carol.address)
      ).to.be.revertedWithCustomError(poct, "PoCT__TokenDoesNotExist");
    });

    it("carol (new owner) should be able to set status after recovery", async function () {
      await poct.connect(admin).recoverToNewWallet(0n, carol.address);

      // Carol now owns the token and should be able to mark it lost
      await expect(poct.connect(carol).setStatus(0n, 1 /* LOST */))
        .to.emit(poct, "StatusChanged");

      const [, , status] = await poct.getItem(0n);
      expect(status).to.equal(1n); // LOST
    });

    it("alice should NOT be able to set status after wallet recovery", async function () {
      await poct.connect(admin).recoverToNewWallet(0n, carol.address);

      await expect(
        poct.connect(alice).setStatus(0n, 1 /* LOST */)
      ).to.be.revertedWithCustomError(poct, "PoCT__CallerIsNotTokenOwner");
    });
  });
});
