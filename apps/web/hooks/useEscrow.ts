'use client';

/**
 * useEscrow.ts — wagmi hook for LostAndFoundEscrow interactions
 * ---------------------------------------------------------------
 * Wraps two contract calls:
 *   • reportLost(tokenId, challengeHash) payable — owner locks ETH bounty
 *   • completeHandoffAndRelease(tokenId)          — owner confirms handoff, pays finder
 *
 * Both flows share the same 5-step lifecycle:
 *   idle → signing → pending → confirmed | error
 */

import { useState, useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain } from 'wagmi';
import { parseEther, keccak256, toBytes } from 'viem';
import ESCROW_ABI from '../lib/Escrow.abi.json';
import { ESCROW_ADDRESS, CHAIN_ID } from '../lib/networkConfig';

export type EscrowStep = 'idle' | 'signing' | 'pending' | 'confirmed' | 'error';

export interface EscrowState {
  step: EscrowStep;
  txHash: `0x${string}` | undefined;
  error: Error | null;
  /**
   * Owner calls this after PoCT.setStatus(LOST).
   * @param tokenId    The PoCT token ID.
   * @param secret     Plaintext secret phrase — hashed client-side before sending.
   * @param ethAmount  ETH bounty as a decimal string e.g. "0.05".
   */
  reportLost: (tokenId: number, secret: string, ethAmount: string) => Promise<void>;
  /**
   * Owner calls this after confirming the finder returned the item.
   * Transfers the locked ETH to the finder.
   */
  completeHandoff: (tokenId: number) => Promise<void>;
  reset: () => void;
}

export function useEscrow(): EscrowState {
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const [step, setStep] = useState<EscrowStep>('idle');

  const {
    writeContractAsync,
    data: txHash,
    reset: resetWrite,
  } = useWriteContract();

  const { isSuccess: isConfirmed, isError: isReceiptError, error: receiptError } =
    useWaitForTransactionReceipt({ hash: txHash, confirmations: 1 });

  // Mirror receipt state to step
  if (isConfirmed && step === 'pending') {
    // Use a micro-task to avoid setting state during render
    Promise.resolve().then(() => setStep('confirmed'));
  }
  if (isReceiptError && step === 'pending') {
    Promise.resolve().then(() => setStep('error'));
  }

  const ensureCorrectChain = useCallback(async () => {
    if (chainId !== CHAIN_ID) {
      await switchChainAsync({ chainId: CHAIN_ID });
    }
  }, [chainId, switchChainAsync]);

  const reportLost = useCallback(
    async (tokenId: number, secret: string, ethAmount: string) => {
      if (!ESCROW_ADDRESS) {
        throw new Error('Escrow contract address not configured');
      }
      await ensureCorrectChain();
      setStep('signing');
      try {
        // Hash the secret client-side — only the hash goes on-chain
        const challengeHash = keccak256(toBytes(secret));
        await writeContractAsync({
          address: ESCROW_ADDRESS,
          abi: ESCROW_ABI,
          functionName: 'reportLost',
          args: [BigInt(tokenId), challengeHash],
          value: ethAmount ? parseEther(ethAmount) : BigInt(0),
        });
        setStep('pending');
      } catch (err) {
        setStep('error');
        throw err;
      }
    },
    [ensureCorrectChain, writeContractAsync]
  );

  const completeHandoff = useCallback(
    async (tokenId: number) => {
      if (!ESCROW_ADDRESS) {
        throw new Error('Escrow contract address not configured');
      }
      await ensureCorrectChain();
      setStep('signing');
      try {
        await writeContractAsync({
          address: ESCROW_ADDRESS,
          abi: ESCROW_ABI,
          functionName: 'completeHandoffAndRelease',
          args: [BigInt(tokenId)],
        });
        setStep('pending');
      } catch (err) {
        setStep('error');
        throw err;
      }
    },
    [ensureCorrectChain, writeContractAsync]
  );

  const reset = useCallback(() => {
    resetWrite();
    setStep('idle');
  }, [resetWrite]);

  return {
    step,
    txHash,
    error: (receiptError ?? null) as Error | null,
    reportLost,
    completeHandoff,
    reset,
  };
}
