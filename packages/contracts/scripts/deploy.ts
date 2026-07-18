/**
 * deploy.ts — TrustTag Protocol full deployment script
 * =====================================================
 * Deploys LostAndFoundSBT, LostAndFoundEscrow, and PoCT to whichever
 * network Hardhat is pointed at (set via --network flag or hardhat.config.ts).
 *
 * Network constants (chain ID, explorer URL, confirmations) are imported
 * from networks.config.ts — never hardcoded here.
 *
 * Usage:
 *   Local:         npx hardhat run scripts/deploy.ts
 *   Base Sepolia:  npx hardhat run scripts/deploy.ts --network baseSepolia
 */
// @ts-ignore
const hre = require("hardhat");
const { ethers, network } = hre;
import { NETWORKS, NetworkConfig } from "../networks.config";

async function main() {
  // ── Resolve network config ────────────────────────────────────────
  const netCfg: NetworkConfig =
    NETWORKS[network.name as keyof typeof NETWORKS] ?? NETWORKS.localhost;

  const [deployer] = await ethers.getSigners();

  console.log("─".repeat(60));
  console.log(`  TrustTag Protocol — Deployment`);
  console.log("─".repeat(60));
  console.log(`  Network  : ${netCfg.name} (chainId ${netCfg.chainId})`);
  console.log(`  Explorer : ${netCfg.explorerUrl}`);
  console.log(`  Faucet   : ${netCfg.faucetUrl}`);
  console.log(`  Deployer : ${deployer.address}`);
  console.log("─".repeat(60));

  // ── 1. LostAndFoundSBT ───────────────────────────────────────────
  console.log("\n[1/3] Deploying LostAndFoundSBT...");
  const SBTFactory = await ethers.getContractFactory("LostAndFoundSBT");
  const sbt = await SBTFactory.deploy();
  await sbt.waitForDeployment();
  const sbtAddress = await sbt.getAddress();
  console.log(`      ✓ LostAndFoundSBT  → ${sbtAddress}`);
  console.log(`        ${netCfg.explorerUrl}/address/${sbtAddress}`);

  // ── 2. LostAndFoundEscrow ────────────────────────────────────────
  console.log("\n[2/3] Deploying LostAndFoundEscrow...");
  const EscrowFactory = await ethers.getContractFactory("LostAndFoundEscrow");
  const escrow = await EscrowFactory.deploy(sbtAddress);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log(`      ✓ LostAndFoundEscrow → ${escrowAddress}`);
  console.log(`        ${netCfg.explorerUrl}/address/${escrowAddress}`);

  // ── 3. PoCT (Proof-of-Custody Token) ─────────────────────────────
  console.log("\n[3/3] Deploying PoCT (Proof-of-Custody Token)...");
  const PoCTFactory = await ethers.getContractFactory("PoCT");
  const poct = await PoCTFactory.deploy();
  await poct.waitForDeployment();
  const poctAddress = await poct.getAddress();
  console.log(`      ✓ PoCT              → ${poctAddress}`);
  console.log(`        ${netCfg.explorerUrl}/address/${poctAddress}`);

  // ── Summary ──────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(60));
  console.log("  Deployment complete — add these to your .env:");
  console.log("─".repeat(60));
  console.log(`  NEXT_PUBLIC_NETWORK_NAME="${netCfg.name}"`);
  console.log(`  NEXT_PUBLIC_CHAIN_ID=${netCfg.chainId}`);
  console.log(`  NEXT_PUBLIC_RPC_URL="${netCfg.rpcUrl}"`);
  console.log(`  NEXT_PUBLIC_EXPLORER_URL="${netCfg.explorerUrl}"`);
  console.log(`  NEXT_PUBLIC_LOST_FOUND_SBT_ADDRESS="${sbtAddress}"`);
  console.log(`  NEXT_PUBLIC_LOST_FOUND_ESCROW_ADDRESS="${escrowAddress}"`);
  console.log(`  NEXT_PUBLIC_POCT_ADDRESS="${poctAddress}"`);
  console.log("─".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
