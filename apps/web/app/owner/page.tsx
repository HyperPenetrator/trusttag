'use client';

import { useState, useEffect } from 'react';
import {
  PlusCircle,
  Search,
  Wallet,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Loader2,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useOwnerItems } from '../../hooks/useOwnerItems';
import { useSetStatus } from '../../hooks/useSetStatus';
import { txExplorerLink, NETWORK_NAME } from '../../lib/networkConfig';
import { ApproveConfirmationModal } from '../../components/ApproveConfirmationModal';

export default function OwnerDashboard() {
  const { isConnected, address } = useAccount();
  const { items: onChainItems, isLoading: isItemsLoading, refetch } = useOwnerItems();
  const {
    step: txStep,
    txHash,
    error: txError,
    gasEstimate,
    setStatus: writeSetStatus,
    estimateSetStatusGas,
    reset: resetTx,
  } = useSetStatus();

  // Selected item to report lost
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [bountyAmount, setBountyAmount] = useState('');
  const [bountyToken, setBountyToken] = useState('USDC');

  // Approval flow states
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [hasApprovedBounty, setHasApprovedBounty] = useState(false);

  // Local/mock items to display along with on-chain items for demo purposes
  const [mockItems, setMockItems] = useState<any[]>([
    {
      id: 99,
      name: "Mock MacBook Pro 16\"",
      serial: "MOCK-MBP-9982",
      status: 0, // SAFE
      bounty: "0",
      bountyToken: "USDC",
    }
  ]);

  const handleMarkLostClick = (id: number) => {
    setSelectedItemId(id);
    setHasApprovedBounty(false);
    estimateSetStatusGas(id, 1); // 1 = LOST
  };

  const executeLostReport = async () => {
    if (selectedItemId === null) return;
    try {
      if (selectedItemId === 99) {
        setMockItems(
          mockItems.map((item) =>
            item.id === 99
              ? { ...item, status: 1, bounty: bountyAmount || '0', bountyToken }
              : item
          )
        );
        alert(`[Mock Flow] ERC-20 approve() executed for exactly ${bountyAmount} ${bountyToken}. Item marked lost and bounty locked in RewardEscrow.`);
        setSelectedItemId(null);
        setHasApprovedBounty(false);
        return;
      }

      // Real on-chain write
      await writeSetStatus(selectedItemId, 1); // 1 = LOST
    } catch (err) {
      console.error('Failed to report lost:', err);
    }
  };

  const submitLostReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItemId === null) return;

    // Check if bounty is set and has not been approved in-app yet
    if (bountyAmount && parseFloat(bountyAmount) > 0 && !hasApprovedBounty) {
      setShowApprovalModal(true);
      return;
    }

    await executeLostReport();
  };

  const handleConfirmApproval = async () => {
    setShowApprovalModal(false);
    setHasApprovedBounty(true);
    // Directly trigger the contract execution now that the user authorized the limit
    setTimeout(() => {
      executeLostReport();
    }, 100);
  };


  const handleCloseTxModal = () => {
    resetTx();
    setSelectedItemId(null);
    setBountyAmount('');
    refetch();
  };

  // Status mapper helper
  const getStatusLabel = (status: number) => {
    switch (status) {
      case 0:
        return { text: 'SAFE', style: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
      case 1:
        return { text: 'LOST', style: 'bg-rose-500/10 text-rose-400 border border-rose-500/20' };
      case 2:
        return { text: 'RECOVERED', style: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' };
      default:
        return { text: 'UNKNOWN', style: 'bg-slate-800 text-slate-300' };
    }
  };

  return (
    <div className="flex-1 py-12 px-6 max-w-6xl mx-auto w-full space-y-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800/80 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
            Owner Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your registered physical items, set loss statuses, and lock bounty rewards.
          </p>
        </div>

        <Link
          href="/register"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-violet-500/20 active:scale-[0.98]"
        >
          <PlusCircle className="w-4 h-4" />
          Register New Item
        </Link>
      </div>

      {!isConnected ? (
        <div className="glass-panel p-8 rounded-2xl text-center space-y-4 max-w-md mx-auto">
          <Wallet className="w-12 h-12 text-slate-500 mx-auto" />
          <h3 className="text-lg font-semibold text-white">Wallet Not Connected</h3>
          <p className="text-sm text-slate-400">
            Please connect your wallet in the header to load and manage your registered Proof-of-Custody Tokens.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-8">
          {/* Quick Stats */}
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-2xl space-y-4">
              <div className="flex items-center gap-2 font-semibold text-slate-300 border-b border-white/5 pb-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                Wallet Credentials
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Connected Wallet</span>
                  <span className="font-mono text-slate-300 text-[11px] truncate max-w-[180px]">
                    {address}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Target network</span>
                  <span className="text-violet-400 font-medium">{NETWORK_NAME}</span>
                </div>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl text-slate-400 text-xs leading-relaxed space-y-2">
              <span className="font-semibold text-slate-300 block">💡 Free Reads</span>
              Your registered item list is loaded directly via free RPC reads (`getItem`). Flipped state changes, however, require gas and wallet signatures.
            </div>
          </div>

          {/* Registered Items List */}
          <div className="md:col-span-2 space-y-6">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold border-b border-slate-800 pb-3">
              <Search className="w-5 h-5" /> Registered Belongings
            </div>

            {isItemsLoading ? (
              <div className="flex flex-col items-center justify-center p-12 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                <span className="text-sm text-slate-500">Scanning registry...</span>
              </div>
            ) : onChainItems.length === 0 && mockItems.length === 0 ? (
              <div className="glass-panel p-12 text-center text-slate-500 rounded-2xl">
                No items registered to this wallet address yet.
              </div>
            ) : (
              <div className="grid gap-4">
                {/* On-chain items */}
                {onChainItems.map((item) => {
                  const statusInfo = getStatusLabel(item.status);
                  return (
                    <div
                      key={`onchain-${item.id}`}
                      className="glass-panel p-5 rounded-xl border border-white/5 hover:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-violet-500/10 border border-violet-500/20 text-violet-400 px-2 py-0.5 rounded font-mono">
                            PoCT #{item.id}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${statusInfo.style}`}>
                            {statusInfo.text}
                          </span>
                        </div>
                        <h4 className="font-bold text-white text-base">On-chain Registered Item</h4>
                        <p className="text-xs text-slate-500 font-mono truncate max-w-xs md:max-w-md">
                          Integrity Hash: {item.metadataIntegrityHash}
                        </p>
                      </div>

                      {item.status === 0 && (
                        <button
                          onClick={() => handleMarkLostClick(item.id)}
                          className="bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs py-2 px-4 rounded-xl transition-colors shrink-0"
                        >
                          Report Lost & Bounty
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Mock Items */}
                {mockItems.map((item) => {
                  const statusInfo = getStatusLabel(item.status);
                  return (
                    <div
                      key={`mock-${item.id}`}
                      className="glass-panel p-5 rounded-xl border border-indigo-500/10 bg-indigo-500/[0.01] hover:border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded font-mono">
                            PoCT #{item.id} (Demo)
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${statusInfo.style}`}>
                            {statusInfo.text}
                          </span>
                        </div>
                        <h4 className="font-bold text-white text-base">{item.name}</h4>
                        <div className="flex gap-4 text-xs text-slate-500">
                          <span>Serial: <span className="font-mono">{item.serial}</span></span>
                          {item.status === 1 && (
                            <span>Bounty: <span className="font-semibold text-rose-400">{item.bounty} {item.bountyToken}</span></span>
                          )}
                        </div>
                      </div>

                      {item.status === 0 && (
                        <button
                          onClick={() => handleMarkLostClick(item.id)}
                          className="bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs py-2 px-4 rounded-xl transition-colors shrink-0"
                        >
                          Report Lost & Bounty
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Report Lost Confirmation Form */}
      {selectedItemId !== null && txStep === 'idle' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={submitLostReport}
            className="glass-panel rounded-2xl p-6 max-w-md w-full border border-white/10 space-y-5"
          >
            <div className="flex items-center gap-2.5 text-rose-400 border-b border-white/5 pb-3">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-lg text-white">Report Item Lost</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Bounty Reward Amount
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 50.00"
                    value={bountyAmount}
                    onChange={(e) => setBountyAmount(e.target.value)}
                    className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                  />
                  <select
                    value={bountyToken}
                    onChange={(e) => setBountyToken(e.target.value)}
                    className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none"
                  >
                    <option value="USDC">USDC</option>
                    <option value="USDT">USDT</option>
                    <option value="DAI">DAI</option>
                    <option value="ETH">ETH</option>
                  </select>
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5">
                  Optional. Locking a reward in escrow acts as a strong financial incentive.
                </p>
              </div>

              {/* Escrow contract stub note */}
              {bountyAmount && parseFloat(bountyAmount) > 0 && (
                <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10 text-[11px] text-indigo-300">
                  <span className="font-bold block mb-0.5">Escrow Integration Stub:</span>
                  Locks {bountyAmount} {bountyToken} in `LostAndFoundEscrow.sol` (stubbed for next phase).
                </div>
              )}

              {/* Gas Estimate */}
              <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-slate-500">Estimated Gas Cost</span>
                <span className="font-mono text-slate-300 font-semibold">{gasEstimate}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedItemId(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition shadow-lg shadow-rose-600/10"
              >
                Confirm Lost Status
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Transaction Lifecycle Status Overlays */}
      {txStep !== 'idle' && selectedItemId !== null && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel rounded-2xl p-8 max-w-md w-full text-center space-y-5 border border-white/10">
            {txStep === 'signing' && (
              <>
                <Loader2 className="w-12 h-12 animate-spin text-amber-400 mx-auto" />
                <h3 className="text-lg font-bold text-white">Waiting for wallet approval</h3>
                <p className="text-sm text-slate-400">
                  Sign the transaction in your wallet to mark item as LOST on-chain.
                </p>
              </>
            )}

            {txStep === 'pending' && txHash && (
              <>
                <Loader2 className="w-12 h-12 animate-spin text-indigo-400 mx-auto" />
                <h3 className="text-lg font-bold text-white">Pending — waiting for confirmation</h3>
                <p className="text-sm text-slate-400">
                  Flipping item status to LOST on-chain.
                </p>
                <a
                  href={txExplorerLink(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs font-mono text-indigo-300 hover:bg-indigo-500/20"
                >
                  {txHash.slice(0, 12)}…{txHash.slice(-8)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </>
            )}

            {txStep === 'confirmed' && (
              <>
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h3 className="text-lg font-bold text-white">Confirmed</h3>
                <p className="text-sm text-slate-400">
                  Item status successfully updated to LOST on-chain.
                </p>
                {bountyAmount && parseFloat(bountyAmount) > 0 && (
                  <p className="text-xs text-indigo-300">
                    Bounty of {bountyAmount} {bountyToken} locked in escrow.
                  </p>
                )}
                <button
                  onClick={handleCloseTxModal}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition"
                >
                  Done
                </button>
              </>
            )}

            {txStep === 'error' && (
              <>
                <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto" />
                <h3 className="text-lg font-bold text-white">Transaction failed</h3>
                <button
                  onClick={handleCloseTxModal}
                  className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-semibold transition"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {/* In-app approval modal */}
      <ApproveConfirmationModal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        onConfirm={handleConfirmApproval}
        amount={bountyAmount}
        token={bountyToken}
        contractName="RewardEscrow"
        contractAddress="0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
        purpose={`Authorize RewardEscrow to lock up your ${bountyAmount} ${bountyToken} bounty reward until a finder returns your item.`}
      />
    </div>
  );
}
