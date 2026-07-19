/**
 * hardhat.config.ts
 * -----------------
 * All network constants are imported from networks.config.ts.
 * Do NOT hardcode chain IDs, RPC URLs, or explorer URLs here.
 */
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

import { NETWORKS } from "./networks.config";

// Load .env from the monorepo root (one level up from packages/contracts)
dotenv.config({ path: "../../.env" });

const DEPLOYER_PRIVATE_KEY: string[] = process.env.PRIVATE_KEY
  ? [process.env.PRIVATE_KEY]
  : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },

  networks: {
    // ── Local ─────────────────────────────────────────────────────
    localhost: {
      url: NETWORKS.localhost.rpcUrl,
      chainId: NETWORKS.localhost.chainId,
    },

    // ── Base Sepolia (primary L2 testnet) ─────────────────────────
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || NETWORKS.baseSepolia.rpcUrl,
      chainId: NETWORKS.baseSepolia.chainId,
      accounts: DEPLOYER_PRIVATE_KEY,
    },
  },

  // Etherscan-compatible block-explorer API config for `hardhat verify`
  etherscan: {
    apiKey: process.env.BASESCAN_API_KEY as string,
    customChains: [
      {
        network: "baseSepolia",
        chainId: NETWORKS.baseSepolia.chainId,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: NETWORKS.baseSepolia.explorerUrl,
        },
      },
    ],
  },

  // Gas Reporter Configuration
  gasReporter: {
    enabled: true,
    currency: "USD",
    token: "ETH",
    gasPriceApi: "https://api.etherscan.io/api?module=proxy&action=eth_gasPrice",
    showTimeSpent: true,
  },
};

export default config;
