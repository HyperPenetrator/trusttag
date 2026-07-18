/**
 * networks.config.ts — TrustTag Protocol Network Registry
 * =========================================================
 * Single source of truth for every network constant used across
 * `packages/contracts` (Hardhat, deploy scripts) and mirrored into
 * `apps/web` via the env template (.env.example / .env.local).
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │  To target a different network:                              │
 * │    1. Add an entry to NETWORKS below.                        │
 * │    2. Set DEFAULT_NETWORK to its key.                        │
 * │    3. Update hardhat.config.ts to import the new entry.      │
 * │    No other file needs to be edited.                         │
 * └──────────────────────────────────────────────────────────────┘
 *
 * Chosen L2 testnet: **Base Sepolia**
 * Rationale:
 *   - EVM-compatible OP-Stack rollup (same tooling as mainnet Ethereum).
 *   - Free, reliable public RPC via Alchemy/Infura and the Coinbase public endpoint.
 *   - Fast finality (~2 s) — ideal for prototyping the handoff/escrow flow.
 *   - Coinbase-operated bridge makes test ETH acquisition straightforward.
 */

export interface NetworkConfig {
  /** Human-readable label used in logs and UI copy. */
  name: string;

  /** EIP-155 chain ID (decimal). */
  chainId: number;

  /**
   * Public RPC URL.
   * Override with a private key-bearing endpoint (Alchemy / Infura) via .env
   * for deployments that require sending transactions.
   */
  rpcUrl: string;

  /**
   * Block-explorer base URL — no trailing slash.
   * Append `"/address/<addr>"` or `"/tx/<hash>"` as needed.
   */
  explorerUrl: string;

  /**
   * Official faucet URL for obtaining test ETH on this network.
   * Linked from the README and the web app's site-verification page.
   */
  faucetUrl: string;

  /**
   * Confirmations to wait after a deployment transaction before
   * considering the contract live. Higher on public testnets to
   * avoid RPC lag.
   */
  confirmations: number;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  // ── Local Hardhat node (default for unit tests) ──────────────────
  localhost: {
    name: "Hardhat Localhost",
    chainId: 31337,
    rpcUrl: "http://127.0.0.1:8545",
    explorerUrl: "http://localhost:3000", // Hardhat no built-in explorer
    faucetUrl: "N/A — use `npx hardhat node` and built-in funded signers",
    confirmations: 1,
  },

  // ── Base Sepolia (primary L2 testnet for TrustTag) ────────────────
  // Docs: https://docs.base.org/docs/network-information
  baseSepolia: {
    name: "Base Sepolia",
    chainId: 84532,
    rpcUrl: "https://sepolia.base.org",
    explorerUrl: "https://sepolia.basescan.org",
    faucetUrl: "https://portal.cdp.coinbase.com/products/faucet",
    confirmations: 3,
  },
} as const;

/**
 * The network that `npm run deploy:basesepolia` (and `hardhat.config.ts`)
 * target by default. Change this ONE line to retarget the whole project.
 */
export const DEFAULT_NETWORK_KEY = "baseSepolia" as const;

/** Convenience re-export of the default network's full config object. */
export const TARGET_NETWORK: NetworkConfig = NETWORKS[DEFAULT_NETWORK_KEY];
