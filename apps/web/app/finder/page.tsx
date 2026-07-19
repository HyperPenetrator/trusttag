'use client';

import { useState, useEffect } from 'react';
import {
  Upload,
  Search,
  CheckCircle2,
  Award,
  QrCode,
  Camera,
  Layers,
  MapPin,
  ClipboardList,
  Loader2,
  ExternalLink,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { useReportFound } from '../../hooks/useReportFound';
import { CORTEX_URL, txExplorerLink } from '../../lib/networkConfig';

// ─── Types ────────────────────────────────────────────────────────
interface CortexLostItem {
  id: number;
  tokenId: number;
  ownerAddress: string;
  category: string;
  brand?: string;
  colour?: string;
  distinguishing?: string;
  phash?: string;
  createdAt?: string;
}

interface MatchResult {
  lostItemId: number;
  tokenId: string;
  ownerAddress: string;
  phashSimilarity: number;
  attributeOverlap: number;
  confidenceScore: number;
}

// ─── Live Lost Board ───────────────────────────────────────────────
function useLiveLostBoard() {
  const [items, setItems] = useState<CortexLostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${CORTEX_URL}/lost-items`);
      if (!res.ok) throw new Error(`Cortex responded ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch_(); }, []);

  return { items, loading, error, refresh: fetch_ };
}

// ─── Main Page ────────────────────────────────────────────────────
export default function FinderDashboard() {
  const { isConnected } = useAccount();
  const { items: liveItems, loading: boardLoading, error: boardError, refresh: refreshBoard } = useLiveLostBoard();
  const reportFound = useReportFound();

  // Open flow form
  const [foundCategory, setFoundCategory] = useState('');
  const [foundBrand, setFoundBrand] = useState('');
  const [foundColor, setFoundColor] = useState('');
  const [foundMarks, setFoundMarks] = useState('');
  const [foundLocation, setFoundLocation] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const [generatedHash, setGeneratedHash] = useState<string | null>(null);

  // Cortex match results
  const [matchResults, setMatchResults] = useState<MatchResult[] | null>(null);
  const [cortexSubmitting, setCortexSubmitting] = useState(false);
  const [cortexError, setCortexError] = useState<string | null>(null);

  // Claim escrow form
  const [claimTokenId, setClaimTokenId] = useState('');
  const [claimLocation, setClaimLocation] = useState('');
  const [claimSecret, setClaimSecret] = useState('');

  // Stats (will be augmented from on-chain finderStats in future)
  const [stats] = useState({ points: 0, successfulRecoveries: 0 });

  // ── Handlers ────────────────────────────────────────────────────

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsHashing(true);
    setGeneratedHash(null);
    setPhotoBase64(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = (ev.target?.result as string) ?? '';
      setPhotoBase64(b64);
      setGeneratedHash('pending — computed by Cortex on submit');
      setIsHashing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleOpenReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundCategory || !foundLocation) return;
    setCortexSubmitting(true);
    setCortexError(null);
    setMatchResults(null);

    try {
      const body: Record<string, unknown> = {
        category: foundCategory,
        brand: foundBrand,
        colour: foundColor,
        distinguishing: foundMarks,
        locationHint: foundLocation,
      };
      if (photoBase64) body.photos = [photoBase64];

      const res = await fetch(`${CORTEX_URL}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? 'Cortex error');
      }

      const data = await res.json();
      setMatchResults(data.matches ?? []);
      if (data.matches?.length > 0) refreshBoard();
    } catch (err) {
      setCortexError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCortexSubmitting(false);
      setFoundCategory('');
      setFoundBrand('');
      setFoundColor('');
      setFoundMarks('');
      setFoundLocation('');
      setPhotoBase64(null);
      setGeneratedHash(null);
    }
  };

  const handleClaimEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimTokenId || !claimLocation || !claimSecret) return;
    try {
      await reportFound.reportFound(Number(claimTokenId), claimLocation, claimSecret);
    } catch {
      // error handled by hook state
    }
  };

  const handleCloseClaimModal = () => {
    reportFound.reset();
    setClaimTokenId('');
    setClaimLocation('');
    setClaimSecret('');
  };

  return (
    <div className="flex-1 py-12 px-6 max-w-6xl mx-auto w-full space-y-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800/80 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
            Finder Home
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Found something? Submit a report to match it — or claim an escrow reward on-chain.
          </p>
        </div>

        {/* Rep Score */}
        <div className="glass-panel px-6 py-3 rounded-2xl flex items-center gap-4 shrink-0 w-fit">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider">Reputation</div>
            <div className="text-sm font-bold font-mono text-indigo-300">
              {stats.points} pts • {stats.successfulRecoveries} recoveries
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* ── Left 2/3: Forms ──────────────────────────────────── */}
        <div className="md:col-span-2 space-y-8">

          {/* FLOW 1: Open anonymous found report → Cortex match */}
          <div className="glass-panel p-6 rounded-2xl space-y-6">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold border-b border-slate-800 pb-3">
              <Camera className="w-5 h-5" />
              <span>Report Found Item (Anonymous / No Wallet)</span>
            </div>

            <form onSubmit={handleOpenReportSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Category *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Phone, Keys, Bag"
                    value={foundCategory}
                    onChange={(e) => setFoundCategory(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Brand</label>
                  <input
                    type="text"
                    placeholder="e.g. Apple, Samsung"
                    value={foundBrand}
                    onChange={(e) => setFoundBrand(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Color</label>
                  <input
                    type="text"
                    placeholder="e.g. Silver, Black"
                    value={foundColor}
                    onChange={(e) => setFoundColor(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Found Location *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Central Station bench"
                    value={foundLocation}
                    onChange={(e) => setFoundLocation(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Distinguishing Marks</label>
                <textarea
                  rows={2}
                  placeholder="e.g. stickers on back, scratch near logo…"
                  value={foundMarks}
                  onChange={(e) => setFoundMarks(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50 resize-none"
                />
              </div>

              {/* Photo upload */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-400">Photo (optional)</label>
                <div className="relative border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer bg-slate-900/20 transition">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <Upload className="w-7 h-7 text-slate-500" />
                  <span className="text-xs text-slate-400 font-medium">Upload found item photo</span>
                </div>
                {isHashing && (
                  <div className="flex items-center gap-2 text-xs text-indigo-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
                    Computing perceptual hash…
                  </div>
                )}
                {generatedHash && !isHashing && (
                  <p className="text-[10px] text-slate-500 font-mono">{generatedHash}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={cortexSubmitting}
                className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2"
              >
                {cortexSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Searching via Cortex…</>
                ) : (
                  'Submit & Find Matches'
                )}
              </button>
            </form>

            {/* Cortex error */}
            {cortexError && (
              <div className="rounded-xl bg-rose-950/20 border border-rose-500/30 p-4 text-xs text-rose-400">
                Cortex error: {cortexError}
              </div>
            )}

            {/* Match results */}
            {matchResults !== null && (
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-indigo-300 text-sm">
                    <Search className="w-4 h-4" /> Cortex Match Results
                  </div>
                  <span className="text-xs text-slate-500">
                    {matchResults.length === 0
                      ? 'No matches'
                      : `${matchResults.length} candidate${matchResults.length > 1 ? 's' : ''}`}
                  </span>
                </div>
                {matchResults.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-3">
                    No active lost items matched. Report saved — owners will be notified if a future item matches.
                  </p>
                ) : (
                  matchResults.map((m, i) => (
                    <div key={m.lostItemId} className="flex items-center gap-4 bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-xs">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300 font-medium">Token #{m.tokenId}</span>
                          <span className={`font-mono font-bold ${m.confidenceScore >= 0.8 ? 'text-emerald-400' : m.confidenceScore >= 0.5 ? 'text-amber-400' : 'text-slate-400'}`}>
                            {(m.confidenceScore * 100).toFixed(1)}% confidence
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${m.confidenceScore >= 0.8 ? 'bg-emerald-500' : m.confidenceScore >= 0.5 ? 'bg-amber-500' : 'bg-slate-600'}`}
                            style={{ width: `${m.confidenceScore * 100}%` }}
                          />
                        </div>
                        <div className="flex gap-4 text-[10px] text-slate-500">
                          <span>Visual: {(m.phashSimilarity * 100).toFixed(1)}%</span>
                          <span>Attributes: {(m.attributeOverlap * 100).toFixed(0)}%</span>
                          <span className="font-mono text-slate-600">
                            {m.ownerAddress ? `${m.ownerAddress.slice(0, 10)}…` : 'Unknown'}
                          </span>
                        </div>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* FLOW 2: Claim escrow reward on-chain (wallet required) */}
          <div className="glass-panel p-6 rounded-2xl space-y-6">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold border-b border-slate-800 pb-3">
              <QrCode className="w-5 h-5" />
              <span>Claim Escrow Reward (Wallet Required)</span>
            </div>

            {!isConnected ? (
              <p className="text-sm text-slate-400 text-center py-4">
                Connect your wallet to submit an on-chain claim and receive the bounty ETH.
              </p>
            ) : (
              <form onSubmit={handleClaimEscrow} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1.5">Token ID *</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 0"
                      value={claimTokenId}
                      onChange={(e) => setClaimTokenId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1.5">Secret Verification Answer *</label>
                    <input
                      type="text"
                      required
                      placeholder="Only the real finder would know"
                      value={claimSecret}
                      onChange={(e) => setClaimSecret(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1.5">Proposed Handoff Location *</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="e.g. Locker 14A inside Central Station lobby"
                    value={claimLocation}
                    onChange={(e) => setClaimLocation(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10 text-[11px] text-indigo-300">
                  <span className="font-bold block mb-0.5">On-chain transaction:</span>
                  Calls <code>LostAndFoundEscrow.reportFound()</code> — your wallet address is recorded as the potential bounty recipient.
                </div>

                <button
                  type="submit"
                  disabled={reportFound.step !== 'idle'}
                  className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2"
                >
                  {reportFound.step === 'signing' || reportFound.step === 'pending' ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />
                      {reportFound.step === 'signing' ? 'Sign in wallet…' : 'Confirming…'}
                    </>
                  ) : (
                    'Submit Claim On-Chain'
                  )}
                </button>
              </form>
            )}

            {/* Claim tx confirmed */}
            {reportFound.step === 'confirmed' && reportFound.txHash && (
              <div className="rounded-xl bg-emerald-950/30 border border-emerald-500/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4" /> Claim Submitted On-Chain!
                </div>
                <p className="text-xs text-slate-400">
                  The owner has been notified. Once they verify your claim and confirm the handoff, the ETH bounty will be transferred to your wallet.
                </p>
                <a
                  href={txExplorerLink(reportFound.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300"
                >
                  View on explorer <ExternalLink className="w-3 h-3" />
                </a>
                <button onClick={handleCloseClaimModal} className="block w-full mt-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition">
                  Submit Another Claim
                </button>
              </div>
            )}

            {reportFound.step === 'error' && (
              <div className="rounded-xl bg-rose-950/20 border border-rose-500/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                  <ShieldAlert className="w-4 h-4" /> Transaction Failed
                </div>
                <p className="text-xs text-slate-400">{reportFound.error?.message ?? 'Rejected or reverted.'}</p>
                <button onClick={handleCloseClaimModal} className="text-xs text-slate-500 hover:text-slate-300 underline">
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Right column: Live board ──────────────────────────── */}
        <div className="space-y-6">

          {/* Live Lost Board from Cortex */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-indigo-400 font-semibold">
                <Layers className="w-5 h-5 text-rose-400" />
                <span>Live Lost Board</span>
              </div>
              <button onClick={refreshBoard} className="text-slate-600 hover:text-slate-400 transition" title="Refresh">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {boardLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-4 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : boardError ? (
              <div className="text-xs text-rose-400 py-3 text-center">{boardError}</div>
            ) : liveItems.length === 0 ? (
              <div className="glass-panel p-6 text-center text-slate-500 rounded-2xl text-sm">
                No active lost items indexed yet.
              </div>
            ) : (
              <div className="grid gap-3">
                {liveItems.map((item) => (
                  <div key={item.id} className="glass-panel p-4 rounded-xl space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono px-2 py-0.5 rounded">
                        SBT #{item.tokenId}
                      </span>
                      {item.brand && (
                        <span className="text-slate-400 font-medium">{item.brand}</span>
                      )}
                    </div>
                    <h4 className="font-bold text-slate-200">
                      {item.category}{item.colour ? ` · ${item.colour}` : ''}
                    </h4>
                    {item.distinguishing && (
                      <p className="text-[11px] text-slate-400 leading-relaxed">{item.distinguishing}</p>
                    )}
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 border-t border-white/5 pt-1.5 font-mono">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        {item.ownerAddress ? `${item.ownerAddress.slice(0, 12)}…` : 'Unknown'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Off-chain submission log */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold border-b border-slate-800 pb-3">
              <ClipboardList className="w-5 h-5 text-violet-400" />
              <span>How It Works</span>
            </div>
            <div className="glass-panel p-4 rounded-xl text-xs text-slate-400 space-y-3 leading-relaxed">
              <div className="flex gap-2">
                <span className="text-indigo-400 font-bold shrink-0">1.</span>
                <span>Found an item? Submit the anonymous report form above. Cortex matches it against all registered lost items using AI similarity scoring.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-indigo-400 font-bold shrink-0">2.</span>
                <span>If you know the token ID, use the <strong className="text-slate-300">Claim Escrow Reward</strong> form to submit an on-chain claim. Requires the secret verification answer.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-indigo-400 font-bold shrink-0">3.</span>
                <span>Once the owner confirms the handoff on their dashboard, the ETH bounty is automatically transferred to your wallet.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
