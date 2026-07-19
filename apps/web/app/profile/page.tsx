'use client';

import { useAccount, useReadContract } from 'wagmi';
import React, { useState } from 'react';

// Using a generic ABI for the LeadScore contract
const leadScoreAbi = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "getLeadScore",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Placeholder for deployed address
const LEAD_SCORE_ADDRESS = '0x0000000000000000000000000000000000000000'; // TODO(prod): Replace with actual deployed LeadScore address

export default function ProfilePage() {
    const { address, isConnected } = useAccount();

    const { data: leadScore, isLoading } = useReadContract({
        address: LEAD_SCORE_ADDRESS,
        abi: leadScoreAbi,
        functionName: 'getLeadScore',
        args: address ? [address] : undefined,
        query: {
            enabled: !!address,
        }
    });

    if (!isConnected) {
        return <div className="p-8">Please connect your wallet to view your profile.</div>;
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Profile</h1>
            
            <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-gray-200">
                <h2 className="text-xl font-semibold mb-4">Lead Score</h2>
                <div className="text-3xl text-blue-600 font-bold">
                    {isLoading ? 'Loading...' : (leadScore !== undefined && leadScore !== null ? leadScore.toString() : '0')}
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                <h2 className="text-xl font-semibold mb-4">Recovery History</h2>
                <div className="text-gray-600 italic">
                    {/* TODO(prod): Fetch recovery history from off-chain indexer combining PoCT events and LeadScore updates */}
                    No recovery history found.
                </div>
            </div>
        </div>
    );
}
