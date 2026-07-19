'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import { FoundReport } from 'shared';

interface LostItem {
  id: number;
  name: string;
  bounty: string;
  status: 'Active' | 'Lost' | 'FoundPending' | 'Recovered';
  secretHash: string;
  description: string;
}

export default function FinderDashboard() {
  const [targetTokenId, setTargetTokenId] = useState('');
  const [proposedLocation, setProposedLocation] = useState('');
  const [secretAnswer, setSecretAnswer] = useState('');

  // Hashing engine states
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const [generatedHash, setGeneratedHash] = useState<string | null>(null);
  // base64 of the uploaded photo — sent to Cortex for server-side pHash
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);

  // Cortex match results
  const [matchResults, setMatchResults] = useState<Array<{
    lostItemId: number;
    tokenId: string;
    phashSimilarity: number;
    attributeOverlap: number;
    confidenceScore: number;
  }> | null>(null);
  const [cortexSubmitting, setCortexSubmitting] = useState(false);
  const [cortexError, setCortexError] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({
    successfulRecoveries: 1,
    points: 10,
  });

  // Off-chain found reports list (simulated database)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [offChainFoundReports, setOffChainFoundReports] = useState<any[]>([
    {
      id: 1,
      category: 'Electronics',
      brand: 'Apple',
      color: 'Space Grey',
      marks: 'Design stickers on back, small dent near charger port',
      location: 'Central Station waiting bench',
      timestamp: Date.now() - 3600000 * 4,
      photosCount: 2,
    },
  ]);

  // Open Flow Form States
  const [foundCategory, setFoundCategory] = useState('');
  const [foundBrand, setFoundBrand] = useState('');
  const [foundColor, setFoundColor] = useState('');
  const [foundMarks, setFoundMarks] = useState('');
  const [foundLocation, setFoundLocation] = useState('');
  const [foundPhotos, setFoundPhotos] = useState<string[]>([]);

  const [activeLostItems] = useState<LostItem[]>([
    {
      id: 0,
      name: 'Apple MacBook Pro 16"',
      bounty: '150.00 USDC',
      status: 'Lost',
      secretHash: '0x28af...39b',
      description: 'Space grey color with customized developer stickers.',
    },
    {
      id: 1,
      name: 'Louis Vuitton Travel Bag',
      bounty: '200.00 USDC',
      status: 'Lost',
      secretHash: '0xface...77a',
      description: 'Brown leather bag with gold monogram pattern.',
    },
  ]);

  // Handlers
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploadedImage(file);
    setIsHashing(true);
    setGeneratedHash(null);
    setPhotoBase64(null);

    // Read file as base64 for Cortex — pHash computed server-side
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = (ev.target?.result as string) ?? '';
      setPhotoBase64(b64);
      // Show a placeholder indicator — real hash returned by Cortex after submit
      setGeneratedHash('pending — computed by Cortex on submit');
      setIsHashing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleReportFound = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTokenId || !proposedLocation || !secretAnswer) return;

    alert(
      'Claim Lead submitted successfully! Hashed verification challenge matches on-chain metadata. Status set to FoundPending.'
    );

    setTargetTokenId('');
    setProposedLocation('');
    setSecretAnswer('');
    setUploadedImage(null);
    setGeneratedHash(null);
  };

  // Open Flow Form submit — calls Cortex POST /match
  const handleOpenReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundCategory || !foundLocation) return;

    setCortexSubmitting(true);
    setCortexError(null);
    setMatchResults(null);

    const CORTEX_URL = process.env.NEXT_PUBLIC_CORTEX_URL ?? 'http://localhost:3001';

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

      // Add to local off-chain list for display
      const newReport = {
        id: offChainFoundReports.length + 1,
        category: foundCategory,
        brand: foundBrand || 'Unknown',
        color: foundColor || 'Unknown',
        marks: foundMarks || 'None specified',
        location: foundLocation,
        timestamp: Date.now(),
        photosCount: foundPhotos.length || 1,
        foundReportId: data.foundReportId,
        matchCount: data.matchCount,
      };
      setOffChainFoundReports([newReport, ...offChainFoundReports]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setCortexError(msg);
    } finally {
      setCortexSubmitting(false);
    }

    // Reset form fields
    setFoundCategory('');
    setFoundBrand('');
    setFoundColor('');
    setFoundMarks('');
    setFoundLocation('');
    setFoundPhotos([]);
  };

  const handleAddMockPhoto = () => {
    setFoundPhotos([...foundPhotos, 'data:image/svg+xml;utf8,<svg ...></svg>']);
  };

  return (
    <div className="flex-1 py-12 px-6 max-w-6xl mx-auto w-full space-y-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800/80 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
            Finder Portal &amp; Recovery Board
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Submit leads on lost items or report found items anonymously.
          </p>
        </div>

        {/* Reputation Score */}
        <div className="glass-panel px-6 py-3 rounded-2xl flex items-center gap-4 shrink-0 w-fit">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider">Reputation Status</div>
            <div className="text-sm font-bold font-mono text-indigo-300">
              {stats.points} pts (+10 pts per recovery)
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Left/Middle Column: Forms */}
        <div className="md:col-span-2 space-y-8">
          {/* FLOW 1: Open Report Found Form (Anonymous / No wallet required) */}
          <div className="glass-panel p-6 rounded-2xl space-y-6">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold border-b border-slate-800 pb-3">
              <Camera className="w-5 h-5" />
              <span>Report Found Item (Anonymous / No Wallet)</span>
            </div>

            <form onSubmit={handleOpenReportSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Category *
                  </label>
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
                    placeholder="e.g. Apple, Samsung, Nike"
                    value={foundBrand}
                    onChange={(e) => setFoundBrand(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 font-sans">
                    Color
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Silver, Black"
                    value={foundColor}
                    onChange={(e) => setFoundColor(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Found Location *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Central Station Waiting Bench"
                    value={foundLocation}
                    onChange={(e) => setFoundLocation(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Distinguishing Marks
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. customized sticker on back, scratches near logo..."
                  value={foundMarks}
                  onChange={(e) => setFoundMarks(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50 resize-none"
                />
              </div>

              {/* Photos Simulation */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-400">Photos</label>
                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={handleAddMockPhoto}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Attach found item photo
                  </button>
                  {foundPhotos.length > 0 && (
                    <span className="text-xs text-emerald-400">
                      ✓ {foundPhotos.length} photo attached
                    </span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-sm transition"
              >
                Submit Anonymous Found Report
              </button>
            </form>
          </div>

          {/* Claim/Lead Match form */}
          <div className="glass-panel p-6 rounded-2xl space-y-6">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold border-b border-slate-800 pb-3">
              <QrCode className="w-5 h-5" />
              <span>Claim Active Escrow Reward (Wallet required)</span>
            </div>

            <form onSubmit={handleReportFound} className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Target Token ID
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 0, 1"
                    value={targetTokenId}
                    onChange={(e) => setTargetTokenId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Proposed Handoff Location
                  </label>
                  <textarea
                    placeholder="e.g. Locker 14A inside Central Station lobby"
                    value={proposedLocation}
                    onChange={(e) => setProposedLocation(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition resize-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Secret Verification Answer
                  </label>
                  <input
                    type="text"
                    placeholder="Describe markings only owner would know"
                    value={secretAnswer}
                    onChange={(e) => setSecretAnswer(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition"
                    required
                  />
                </div>
              </div>

              {/* Hashing Simulator Box */}
              <div className="flex flex-col justify-between space-y-4 border border-slate-800 p-4 rounded-xl bg-slate-950/30 h-full">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-2">
                    Fingerprint Engine (Perceptual Image Hash)
                  </label>
                  <div className="relative border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl p-6 transition flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-900/20">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <Upload className="w-8 h-8 text-slate-500" />
                    <span className="text-xs text-slate-400 font-medium">
                      Upload Found Item Photo
                    </span>
                  </div>
                </div>

                {isHashing && (
                  <div className="flex items-center gap-2 text-xs text-indigo-400 justify-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping"></span>
                    Generating perceptual image hash...
                  </div>
                )}

                {generatedHash && (
                  <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Fingerprint Key:</span>
                      <span className="font-mono text-indigo-400 font-semibold">
                        {generatedHash}
                      </span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={cortexSubmitting}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2"
                >
                  {cortexSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Searching via Cortex…
                    </>
                  ) : (
                    'Submit & Find Matches'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ── Cortex Match Results Panel ─────────────────────────────────── */}
        {cortexError && (
          <div className="glass-panel border border-rose-500/30 bg-rose-950/20 rounded-2xl p-5 space-y-2">
            <p className="text-sm font-semibold text-rose-400">Cortex matching failed</p>
            <p className="text-xs text-slate-400">{cortexError}</p>
            <p className="text-[11px] text-slate-500">
              Make sure the Cortex service is running:{' '}
              <code className="text-indigo-400">npm run cortex:dev</code>
            </p>
          </div>
        )}

        {matchResults !== null && (
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 font-semibold text-indigo-300">
                <Search className="w-5 h-5" />
                <span>Cortex Match Results</span>
              </div>
              <span className="text-xs text-slate-500">
                {matchResults.length === 0
                  ? 'No matches found'
                  : `${matchResults.length} candidate${matchResults.length !== 1 ? 's' : ''} ranked by confidence`}
              </span>
            </div>

            {matchResults.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                No active lost items matched your report. It has been saved — owners
                will be notified if a match is found later.
              </p>
            ) : (
              <div className="space-y-3">
                {matchResults.map((m, i) => (
                  <div
                    key={m.lostItemId}
                    className="flex items-center gap-4 bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-xs"
                  >
                    {/* Rank badge */}
                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold shrink-0">
                      {i + 1}
                    </div>

                    {/* Scores */}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300 font-medium">
                          Token #{m.tokenId}
                        </span>
                        <span
                          className={`font-mono font-bold ${
                            m.confidenceScore >= 0.8
                              ? 'text-emerald-400'
                              : m.confidenceScore >= 0.5
                              ? 'text-amber-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {(m.confidenceScore * 100).toFixed(1)}% confidence
                        </span>
                      </div>

                      {/* Score bar */}
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            m.confidenceScore >= 0.8
                              ? 'bg-emerald-500'
                              : m.confidenceScore >= 0.5
                              ? 'bg-amber-500'
                              : 'bg-slate-600'
                          }`}
                          style={{ width: `${m.confidenceScore * 100}%` }}
                        />
                      </div>

                      <div className="flex gap-4 text-[10px] text-slate-500 pt-0.5">
                        <span>
                          Visual: {(m.phashSimilarity * 100).toFixed(1)}%
                        </span>
                        <span>
                          Attributes: {(m.attributeOverlap * 100).toFixed(0)}%
                        </span>
                        <span className="font-mono truncate text-slate-600">
                          {m.ownerAddress.slice(0, 10)}…
                        </span>
                      </div>
                    </div>

                    <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Right Column: Unverified reports & Active Board */}
        <div className="space-y-6">
          {/* Unverified Off-chain FoundReports */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold border-b border-slate-800 pb-3">
              <ClipboardList className="w-5 h-5 text-violet-400" />
              <span>Unverified Found Reports (Off-chain)</span>
            </div>
            <div className="grid gap-3">
              {offChainFoundReports.map((report) => (
                <div key={report.id} className="glass-panel p-4 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded font-medium">
                      {report.category}
                    </span>
                    <span className="text-slate-500">
                      {new Date(report.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Brand/Color:</span>{' '}
                    <span className="text-slate-300">
                      {report.brand} ({report.color})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Marks:</span>{' '}
                    <span className="text-slate-300">{report.marks}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 border-t border-white/5 pt-1.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-600" />
                    <span className="truncate">{report.location}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Current Lost Board */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold border-b border-slate-800 pb-3">
              <Search className="w-5 h-5" />
              <span>Current Lost Board</span>
            </div>
            <div className="grid gap-3">
              {activeLostItems.map((item) => (
                <div key={item.id} className="glass-panel p-4 rounded-xl space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono px-2 py-0.5 rounded">
                      SBT #{item.id}
                    </span>
                    <span className="font-bold text-amber-400">{item.bounty}</span>
                  </div>
                  <h4 className="font-bold text-slate-200 text-sm">{item.name}</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
