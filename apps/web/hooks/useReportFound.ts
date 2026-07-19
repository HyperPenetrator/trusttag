'use client';

/**
 * useReportFound.ts — wagmi hook for LostAndFoundEscrow.reportFound()
 * --------------------------------------------------------------------
 * Called by a finder who has located an item and wants to claim the escrow reward.
 *
 * Contract signature:
 *   reportFound(uint256 tokenId, string locationProposal, bytes32 challengeAnswerHash)
 *
 * The secret answer is hashed client-side before being sent on-chain.
 * If the owner's challengeHash matches keccak256(secret), the claim is valid.
 */

import { useState, useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain } from 'wagmi';
import { keccak256, toBytes } from 'viem';
import ESCROW_ABI from '../lib/Escrow.abi.json';
import { ESCROW_ADDRESS, CHAIN_ID } from '../lib/networkConfig';

export type ReportFoundStep = 'idle' | 'signing' | 'pending' | 'confirmed' | 'error';

export interface ReportFoundState {
  step: ReportFoundStep;
  txHash: `0x${string}` | undefined;
  error: Error | null;
  /**
   * Finder calls this to register their found lead on-chain.
   * @param tokenId          The PoCT token ID they found.
   * @param locationProposal Plaintext description of where to hand off the item.
   * @param secretAnswer     The secret answer the owner set — hashed before sending.
   */
  reportFound: (tokenId: number, locationProposal: string, secretAnswer: string) => Promise<void>;
  reset: () => void;
}

export function useReportFound(): ReportFoundState {
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const [step, setStep] = useState<ReportFoundStep>('idle');

  const {
    writeContractAsync,
    data: txHash,
    reset: resetWrite,
  } = useWriteContract();

  const { isSuccess: isConfirmed, isError: isReceiptError, error: receiptError } =
    useWaitForTransactionReceipt({ hash: txHash, confirmations: 1 });

  if (isConfirmed && step === 'pending') {
    Promise.resolve().then(() => setStep('confirmed'));
  }
  if (isReceiptError && step === 'pending') {
    Promise.resolve().then(() => setStep('error'));
  }

  const reportFound = useCallback(
    async (tokenId: number, locationProposal: string, secretAnswer: string) => {
      if (!ESCROW_ADDRESS) {
        throw new Error('Escrow contract address not configured');
      }
      if (chainId !== CHAIN_ID) {
        await switchChainAsync({ chainId: CHAIN_ID });
      }
      setStep('signing');
      try {
        // Hash the finder's answer client-side — the contract stores the owner's hash
        // and checks keccak256(answer) == challengeHash during verifyChallengeAndConfirm
        const challengeAnswerHash = keccak256(toBytes(secretAnswer));
        await writeContractAsync({
          address: ESCROW_ADDRESS,
          abi: ESCROW_ABI,
          functionName: 'reportFound',
          args: [BigInt(tokenId), locationProposal, challengeAnswerHash],
        });
        setStep('pending');
      } catch (err) {
        setStep('error');
        throw err;
      }
    },
    [chainId, switchChainAsync, writeContractAsync]
  );

  const reset = useCallback(() => {
    resetWrite();
    setStep('idle');
  }, [resetWrite]);

  return {
    step,
    txHash,
    error: (receiptError ?? null) as Error | null,
    reportFound,
    reset,
  };
}
