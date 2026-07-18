'use client';

/**
 * useMintItem.ts — wagmi hook for PoCT.mintItem()
 * -------------------------------------------------
 * Wraps useWriteContract + useWaitForTransactionReceipt to produce
 * three explicit UI states required by the spec:
 *
 *   'idle'     → nothing in flight
 *   'signing'  → wallet approval prompt is open ("Waiting for wallet approval")
 *   'pending'  → tx submitted, waiting for on-chain confirmation
 *   'confirmed'→ receipt received with at least 1 confirmation
 *   'error'    → user rejected or tx reverted
 *
 * The hook NEVER reports success until the receipt returns.
 */

import { useCallback } from 'react';
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useSwitchChain,
} from 'wagmi';
import POCT_ABI from '../lib/PoCT.abi.json';
import { POCT_ADDRESS, CHAIN_ID } from '../lib/networkConfig';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type MintStatus =
  | 'idle'
  | 'signing'
  | 'pending'
  | 'confirmed'
  | 'error';

export interface MintState {
  status: MintStatus;
  txHash: `0x${string}` | undefined;
  error: Error | null;
  /** Call this to start the mint flow */
  mint: (integrityHash: `0x${string}`) => Promise<void>;
  /** Reset state back to idle */
  reset: () => void;
}

// ─────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────

export function useMintItem(): MintState {
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  const {
    writeContractAsync,
    data: txHash,
    isPending: isSigning,
    isError: isWriteError,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError: isReceiptError,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  });

  // Derive a single, deterministic status
  let status: MintStatus = 'idle';
  if (isWriteError || isReceiptError) status = 'error';
  else if (isConfirmed) status = 'confirmed';
  else if (isConfirming) status = 'pending';
  else if (isSigning) status = 'signing';

  const mint = useCallback(
    async (integrityHash: `0x${string}`) => {
      // Auto-switch to the configured network if the user is on a different one
      if (chainId !== CHAIN_ID) {
        await switchChainAsync({ chainId: CHAIN_ID });
      }

      await writeContractAsync({
        address: POCT_ADDRESS || '0x0000000000000000000000000000000000000000',
        abi: POCT_ABI,
        functionName: 'mintItem',
        args: [integrityHash],
      });
    },
    [chainId, switchChainAsync, writeContractAsync]
  );

  const reset = useCallback(() => {
    resetWrite();
  }, [resetWrite]);

  return {
    status,
    txHash,
    error: (writeError ?? receiptError) as Error | null,
    mint,
    reset,
  };
}
