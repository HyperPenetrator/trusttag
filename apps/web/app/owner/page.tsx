'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  PlusCircle,
  Search,
  Wallet,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  HandshakeIcon,
  Coins,
} from 'lucide-react';
import Link from 'next/link';
import { useAccount, useReadContract } from 'wagmi';
import { formatEther } from 'viem';
import { useOwnerItems } from '../../hooks/useOwnerItems';
import { useSetStatus } from '../../hooks/useSetStatus';
import { useEscrow } from '../../hooks/useEscrow';
import { txExplorerLink, NETWORK_NAME, ESCROW_ADDRESS } from '../../lib/networkConfig';
import ESCROW_ABI from '../../lib/Escrow.abi.json';

// ─── Types ────────────────────────────────────────────────────────
type ActiveModal =
  | null
  | { kind: 'reportLost'; tokenId: number }
  | { kind: 'txStatus'; action: 'reportLost' | 'completeHandoff' }
  | { kind: 'confirmHandoff'; tokenId: number; finderAddress: string; bountyEth: string };

// ─── Escrow Read for a single tokenId ────────────────────────────
function useEscrowInfo(tokenId: number | null) {
  const { data, refetch } = useReadContract({
    address: ESCROW_ADDRESS || undefined,
    abi: ESCROW_ABI,
    functionName: 'escrows',
    args: tokenId !== null ? [BigInt(tokenId)] : undefined,
    query: { enabled: tokenId !== null && !!ESCROW_ADDRESS },
  });

  if (!data) return { escrowInfo: null, refetch };

  const [bounty, finder, status] = data as [bigint, `0x${string}`, number, `0x${string}`, string, bigint, bigint];
  return {
    escrowInfo: { bounty, finder, status },
    refetch,
  };
}

// ─── Status helpers ───────────────────────────────────────────────
function getPoCTStatusLabel(status: number) {
  switch (status) {
    case 0: return { text: 'SAFE', style: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
    case 1: return { text: 'LOST', style: 'bg-rose-500/10 text-rose-400 border border-rose-500/20' };
    case 2: return { text: 'RECOVERED', style: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' };
    default: return { text: 'UNKNOWN', style: 'bg-slate-800 text-slate-300' };
  }
}

// Escrow status enum: 0=Active, 1=Lost, 2=FoundPending, 3=Recovered, 4=Disputed
function getEscrowStatusLabel(status: number) {
  switch (status) {
    case 1: return { text: 'Bounty Locked', style: 'text-amber-400' };
    case 2: return { text: 'Finder Claimed ⚡', style: 'text-violet-400' };
    case 3: return { text: 'Recovered ✓', style: 'text-emerald-400' };
    case 4: return { text: 'Disputed', style: 'text-rose-400' };
    default: return null;
  }
}

// ─── Item Row Component ───────────────────────────────────────────
function ItemRow({
  item,
  onMarkLost,
  onConfirmHandoff,
}: {
  item: { id: number; status: number; metadataIntegrityHash: string };
  onMarkLost: (id: number) => void;
  onConfirmHandoff: (id: number) => void;
}) {
  const { escrowInfo } = useEscrowInfo(item.id);
  const statusInfo = getPoCTStatusLabel(item.status);
  const escrowLabel = escrowInfo ? getEscrowStatusLabel(escrowInfo.status) : null;
  const isFoundPending = escrowInfo?.status === 2;
  const bountyEth = escrowInfo?.bounty ? formatEther(escrowInfo.bounty) : '0';
  const finderAddr = escrowInfo?.finder ?? '';

  return (
    <div className="glass-panel p-5 rounded-xl border border-white/5 hover:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
      <div className="space-y-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] bg-violet-500/10 border border-violet-500/20 text-violet-400 px-2 py-0.5 rounded font-mono">
            PoCT #{item.id}
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${statusInfo.style}`}>
            {statusInfo.text}
          </span>
          {escrowLabel && (
            <span className={`text-[10px] font-semibold ${escrowLabel.style}`}>
              {escrowLabel.text}
            </span>
          )}
        </div>
        <h4 className="font-bold text-white text-base">On-chain Registered Item</h4>
        <p className="text-xs text-slate-500 font-mono truncate max-w-xs md:max-w-md">
          Integrity Hash: {item.metadataIntegrityHash}
        </p>
        {isFoundPending && escrowInfo && (
          <div className="text-xs text-violet-300 mt-1 space-y-0.5">
            <div>
              Finder: <span className="font-mono">{finderAddr.slice(0, 10)}…{finderAddr.slice(-6)}</span>
            </div>
            <div>
              Bounty locked: <span className="font-semibold text-amber-400">{bountyEth} ETH</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 shrink-0">
        {item.status === 0 && (
          <button
            onClick={() => onMarkLost(item.id)}
            className="bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs py-2 px-4 rounded-xl transition-colors"
          >
            Report Lost
          </button>
        )}
        {isFoundPending && (
          <button
            onClick={() => onConfirmHandoff(item.id)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs py-2 px-4 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <HandshakeIcon className="w-3.5 h-3.5" />
            Confirm Handoff
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function OwnerDashboard() {
  const { isConnected, address } = useAccount();
  const { items: onChainItems, isLoading: isItemsLoading, refetch } = useOwnerItems();
  const { step: statusStep, setStatus: writeSetStatus, reset: resetStatus } = useSetStatus();

  const escrow = useEscrow();

  // Modal state
  const [modal, setModal] = useState<ActiveModal>(null);

  // Report Lost form fields
  const [bountyEth, setBountyEth] = useState('');
  const [secretPhrase, setSecretPhrase] = useState('');

  // Track which tokenId is being acted on
  const [activeTokenId, setActiveTokenId] = useState<number | null>(null);

  // ── Handlers ────────────────────────────────────────────────────

  const handleMarkLostClick = useCallback((id: number) => {
    setActiveTokenId(id);
    setBountyEth('');
    setSecretPhrase('');
    setModal({ kind: 'reportLost', tokenId: id });
  }, []);

  const handleConfirmHandoffClick = useCallback((id: number) => {
    setActiveTokenId(id);
    setModal({ kind: 'txStatus', action: 'completeHandoff' });
    escrow.completeHandoff(id).catch(() => {});
  }, [escrow]);

  const handleSubmitLostReport = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTokenId === null) return;

    try {
      // Step 1: flip PoCT status to LOST
      setModal({ kind: 'txStatus', action: 'reportLost' });
      await writeSetStatus(activeTokenId, 1);
    } catch {
      // error state is handled by hook
    }
  }, [activeTokenId, writeSetStatus]);

  // After PoCT setStatus tx is confirmed, call escrow.reportLost
  useEffect(() => {
    if (statusStep === 'confirmed' && activeTokenId !== null && bountyEth && secretPhrase) {
      escrow.reportLost(activeTokenId, secretPhrase, bountyEth).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusStep]);

  const handleCloseTxModal = useCallback(() => {
    resetStatus();
    escrow.reset();
    setModal(null);
    setActiveTokenId(null);
    setBountyEth('');
    setSecretPhrase('');
    refetch();
  }, [resetStatus, escrow, refetch]);

  // ── Derived state ────────────────────────────────────────────────
  // Overall action step — combine both hooks for the tx overlay
  const combinedStep = escrow.step !== 'idle' ? escrow.step : statusStep;
  const combinedHash = escrow.txHash;

  return (
    <div className="flex-1 py-12 px-6 max-w-6xl mx-auto w-full space-y-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800/80 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
            Owner Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your registered items, report losses, and confirm handoffs to release bounties.
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
            Connect your wallet to load and manage your registered Proof-of-Custody Tokens.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-8">
          {/* Sidebar */}
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-2xl space-y-4">
              <div className="flex items-center gap-2 font-semibold text-slate-300 border-b border-white/5 pb-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                Wallet Credentials
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Connected Wallet</span>
                  <span className="font-mono text-slate-300 text-[11px] truncate max-w-[180px]">{address}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Network</span>
                  <span className="text-violet-400 font-medium">{NETWORK_NAME}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Escrow Contract</span>
                  {ESCROW_ADDRESS ? (
                    <a
                      href={`https://sepolia.basescan.org/address/${ESCROW_ADDRESS}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      {ESCROW_ADDRESS.slice(0, 8)}…{ESCROW_ADDRESS.slice(-6)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-slate-600 text-[11px]">Not configured</span>
                  )}
                </div>
              </div>
            </div>

            <div className="glass-panel p-5 rounded-2xl text-xs text-slate-400 leading-relaxed space-y-2">
              <span className="font-semibold text-slate-300 block">💡 Escrow Flow</span>
              <ol className="space-y-1 list-decimal list-inside text-slate-500">
                <li>Report item lost + set ETH bounty</li>
                <li>Finder locates item, claims on-chain</li>
                <li>You verify & confirm → ETH auto-paid to finder</li>
              </ol>
            </div>
          </div>

          {/* Item List */}
          <div className="md:col-span-2 space-y-6">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold border-b border-slate-800 pb-3">
              <Search className="w-5 h-5" /> Registered Belongings
            </div>

            {isItemsLoading ? (
              <div className="flex flex-col items-center justify-center p-12 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                <span className="text-sm text-slate-500">Scanning registry…</span>
              </div>
            ) : onChainItems.length === 0 ? (
              <div className="glass-panel p-12 text-center text-slate-500 rounded-2xl">
                No items registered to this wallet yet.
              </div>
            ) : (
              <div className="grid gap-4">
                {onChainItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onMarkLost={handleMarkLostClick}
                    onConfirmHandoff={handleConfirmHandoffClick}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Report Lost Form ───────────────────────────────── */}
      {modal?.kind === 'reportLost' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitLostReport}
            className="glass-panel rounded-2xl p-6 max-w-md w-full border border-white/10 space-y-5"
          >
            <div className="flex items-center gap-2.5 text-rose-400 border-b border-white/5 pb-3">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-lg text-white">Report Item Lost</h3>
            </div>

            <div className="space-y-4">
              {/* ETH Bounty */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  ETH Bounty Reward
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="e.g. 0.05"
                    value={bountyEth}
                    onChange={(e) => setBountyEth(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50 pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5" /> ETH
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5">
                  Optional. ETH is locked in the escrow contract and released to the finder on confirmed handoff.
                </p>
              </div>

              {/* Secret Challenge */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Secret Verification Phrase
                </label>
                <input
                  type="text"
                  placeholder="Only you and the real finder would know this"
                  required
                  value={secretPhrase}
                  onChange={(e) => setSecretPhrase(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                />
                <p className="text-[10px] text-slate-500 mt-1.5">
                  This phrase is hashed and stored on-chain. A finder must provide it to claim the bounty.
                </p>
              </div>

              {/* Info box */}
              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 text-[11px] text-amber-300 space-y-1">
                <span className="font-bold block">Two transactions required:</span>
                <span className="text-amber-400/70">1. PoCT.setStatus(LOST) — marks item on-chain</span>
                <br />
                <span className="text-amber-400/70">
                  2. Escrow.reportLost({bountyEth || '0'} ETH) — locks bounty in contract
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition shadow-lg shadow-rose-600/10"
              >
                Confirm Lost
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Tx Lifecycle Overlay ──────────────────────────────────── */}
      {modal?.kind === 'txStatus' && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel rounded-2xl p-8 max-w-md w-full text-center space-y-5 border border-white/10">

            {(combinedStep === 'signing' || combinedStep === 'pending') && (
              <>
                <Loader2 className={`w-12 h-12 animate-spin mx-auto ${combinedStep === 'signing' ? 'text-amber-400' : 'text-indigo-400'}`} />
                <h3 className="text-lg font-bold text-white">
                  {combinedStep === 'signing'
                    ? 'Waiting for wallet approval'
                    : modal.action === 'reportLost'
                    ? statusStep === 'confirmed' ? 'Locking ETH in escrow…' : 'Setting item status to LOST…'
                    : 'Releasing bounty to finder…'}
                </h3>
                <p className="text-sm text-slate-400">
                  {combinedStep === 'signing'
                    ? 'Sign the transaction in your wallet.'
                    : 'Waiting for on-chain confirmation.'}
                </p>
                {combinedHash && (
                  <a
                    href={txExplorerLink(combinedHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs font-mono text-indigo-300 hover:bg-indigo-500/20"
                  >
                    {combinedHash.slice(0, 12)}…{combinedHash.slice(-8)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </>
            )}

            {combinedStep === 'confirmed' && (
              <>
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h3 className="text-lg font-bold text-white">
                  {modal.action === 'completeHandoff' ? 'Bounty Released!' : 'Done!'}
                </h3>
                <p className="text-sm text-slate-400">
                  {modal.action === 'completeHandoff'
                    ? 'The ETH bounty has been transferred to the finder.'
                    : 'Item marked LOST and bounty locked in escrow.'}
                </p>
                <button
                  onClick={handleCloseTxModal}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition"
                >
                  Done
                </button>
              </>
            )}

            {(combinedStep === 'error' || (statusStep === 'error' && modal.action === 'reportLost')) && (
              <>
                <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto" />
                <h3 className="text-lg font-bold text-white">Transaction Failed</h3>
                <p className="text-xs text-slate-500">
                  {escrow.error?.message ?? 'The transaction was rejected or reverted.'}
                </p>
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
    </div>
  );
}
