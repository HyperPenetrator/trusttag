/**
 * networkConfig.ts — Web-app mirror of packages/contracts/networks.config.ts
 * ---------------------------------------------------------------------------
 * Values are populated from Next.js environment variables which in turn
 * are populated from .env.example / .env.local.
 *
 * Do NOT hardcode chain IDs or URLs here — always read from NEXT_PUBLIC_*
 * so the same build artifact can point at different networks via env.
 */

export const NETWORK_NAME =
  process.env.NEXT_PUBLIC_NETWORK_NAME ?? 'Base Sepolia';

export const CHAIN_ID = parseInt(
  process.env.NEXT_PUBLIC_CHAIN_ID ?? '84532',
  10
);

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? 'https://sepolia.base.org';

export const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL ?? 'https://sepolia.basescan.org';

export const POCT_ADDRESS = (
  process.env.NEXT_PUBLIC_POCT_ADDRESS ?? ''
) as `0x${string}`;

/** Returns a full block-explorer link for a transaction hash. */
export function txExplorerLink(txHash: string): string {
  return `${EXPLORER_URL}/tx/${txHash}`;
}

/** Returns a full block-explorer link for a contract/account address. */
export function addressExplorerLink(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}
