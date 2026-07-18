'use client';

/**
 * useOwnerItems.ts — Hook to fetch owner's items from the contract
 * -----------------------------------------------------------------
 * Uses useReadContracts to batch-query token ownership and item details
 * for the first 15 token IDs. Filters the results to return only the
 * items owned by the currently connected wallet address.
 */

import { useAccount, useReadContracts } from 'wagmi';
import POCT_ABI from '../lib/PoCT.abi.json';
import { POCT_ADDRESS } from '../lib/networkConfig';

export interface OnChainItem {
  id: number;
  owner: string;
  metadataIntegrityHash: `0x${string}`;
  registrationTimestamp: bigint;
  status: number; // 0 = SAFE, 1 = LOST, 2 = RECOVERED
}

export function useOwnerItems() {
  const { address } = useAccount();

  // Create contract read calls for token IDs 0 to 14
  const contracts = [];
  for (let i = 0; i < 15; i++) {
    contracts.push(
      {
        address: POCT_ADDRESS,
        abi: POCT_ABI as any,
        functionName: 'ownerOf',
        args: [BigInt(i)],
      },
      {
        address: POCT_ADDRESS,
        abi: POCT_ABI as any,
        functionName: 'getItem',
        args: [BigInt(i)],
      }
    );
  }

  const { data, isError, isLoading, refetch } = useReadContracts({
    contracts,
    query: {
      enabled: !!address && !!POCT_ADDRESS,
      refetchInterval: 5000, // Poll every 5s for updates
    },
  });

  const items: OnChainItem[] = [];

  if (data && address) {
    for (let i = 0; i < 15; i++) {
      const ownerOfResult = data[i * 2];
      const getItemResult = data[i * 2 + 1];

      // If token exists and belongs to the connected address
      if (
        ownerOfResult?.status === 'success' &&
        getItemResult?.status === 'success' &&
        (ownerOfResult.result as string).toLowerCase() === address.toLowerCase()
      ) {
        const [metadataIntegrityHash, registrationTimestamp, status] =
          getItemResult.result as [any, any, any];

        items.push({
          id: i,
          owner: ownerOfResult.result as string,
          metadataIntegrityHash: metadataIntegrityHash as `0x${string}`,
          registrationTimestamp: registrationTimestamp as bigint,
          status: Number(status),
        });
      }
    }
  }

  return {
    items,
    isLoading: isLoading && !!address,
    isError,
    refetch,
  };
}
