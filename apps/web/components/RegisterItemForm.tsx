'use client';

/**
 * RegisterItemForm.tsx
 * ─────────────────────────────────────────────────────────────────
 * Three-phase registration flow:
 *   Phase A — Form capture (photos + item details)
 *   Phase B — Encrypt → pin → mint (with explicit tx UI states)
 *   Phase C — Confirmed success card
 *
 * TX UI states (per spec — never show success before receipt):
 *   'signing'  → "Waiting for wallet approval"
 *   'pending'  → "Pending — tx hash + explorer link"
 *   'confirmed'→ "Confirmed"
 *   'error'    → error message + retry
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  X,
  Image as ImageIcon,
  Shield,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Clock,
  Package,
} from 'lucide-react';
import { useAccount, useSignMessage } from 'wagmi';
import {
  prepareItemMetadata,
  getKeyDerivationMessage,
  type ItemRegistrationInput,
  type PreparedMetadata,
} from 'shared';
import { useMintItem } from '../hooks/useMintItem';
import { txExplorerLink, NETWORK_NAME } from '../lib/networkConfig';

// ─────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────

function PhotoUploadZone({
  photos,
  onAdd,
  onRemove,
}: {
  photos: string[];
  onAdd: (base64: string) => void;
  onRemove: (idx: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === 'string') onAdd(e.target.result);
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-300">
        Item Photos{' '}
        <span className="text-xs text-slate-500 font-normal">
          (encrypted before upload — your images never leave your browser unencrypted)
        </span>
      </label>

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        className="relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] p-8 text-center cursor-pointer transition-all hover:border-violet-500/40 hover:bg-violet-500/[0.03]"
      >
        <Upload className="w-7 h-7 text-slate-500" />
        <p className="text-sm text-slate-400">
          Drag &amp; drop photos, or{' '}
          <span className="text-violet-400 font-medium">click to browse</span>
        </p>
        <p className="text-xs text-slate-600">JPG, PNG, WebP — encrypted with AES-256-GCM</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Thumbnails */}
      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {photos.map((src, i) => (
            <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`photo ${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TX Status overlay
// ─────────────────────────────────────────────────────────────────

function TxStatusPanel({
  status,
  txHash,
  error,
  onRetry,
  onDone,
  prepared,
}: {
  status: string;
  txHash?: `0x${string}`;
  error: Error | null;
  onRetry: () => void;
  onDone: () => void;
  prepared: PreparedMetadata | null;
}) {
  if (status === 'idle') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="glass-panel rounded-2xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl border border-white/10">

        {/* ── SIGNING ─── */}
        {status === 'signing' && (
          <>
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 mx-auto">
              <Clock className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">
              Waiting for wallet approval
            </h3>
            <p className="text-sm text-slate-400">
              Check your wallet — review the transaction details carefully before signing.
              TrustTag will never ask you to approve unexpected transfers.
            </p>
            <div className="flex items-center gap-2 justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              <span className="text-xs text-amber-400">Awaiting signature…</span>
            </div>
          </>
        )}

        {/* ── PENDING ─── */}
        {status === 'pending' && txHash && (
          <>
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-violet-500/10 border border-violet-500/30 mx-auto">
              <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">
              Pending — waiting for confirmation
            </h3>
            <p className="text-sm text-slate-400">
              Your transaction is being included in a block on{' '}
              <span className="text-violet-300 font-medium">{NETWORK_NAME}</span>.
              This usually takes a few seconds.
            </p>

            {/* TX hash + explorer link */}
            <a
              href={txExplorerLink(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300 font-mono hover:bg-violet-500/20 transition-colors"
            >
              {txHash.slice(0, 10)}…{txHash.slice(-8)}
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
            <p className="text-xs text-slate-600">
              Never close this tab — we need the receipt to confirm success.
            </p>
          </>
        )}

        {/* ── CONFIRMED ─── */}
        {status === 'confirmed' && (
          <>
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 mx-auto animate-[scale_0.3s_ease-out]">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">
              Confirmed!
            </h3>
            <p className="text-sm text-slate-400">
              Your Proof-of-Custody Token has been minted and is permanently
              recorded on {NETWORK_NAME}.
            </p>

            {prepared && (
              <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 space-y-2 text-left">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Registration details</p>
                <div className="space-y-1">
                  <DetailRow label="IPFS CID" value={prepared.ipfsCid} mono />
                  <DetailRow
                    label="Integrity hash"
                    value={`${prepared.integrityHash.slice(0, 12)}…`}
                    mono
                  />
                </div>
              </div>
            )}

            {txHash && (
              <a
                href={txExplorerLink(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                View on {NETWORK_NAME} explorer
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            <button
              onClick={onDone}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
            >
              Done — register another item
            </button>
          </>
        )}

        {/* ── ERROR ─── */}
        {status === 'error' && (
          <>
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 mx-auto">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">
              Transaction failed
            </h3>
            {error && (
              <p className="text-sm text-red-300 bg-red-500/10 rounded-lg px-3 py-2 text-left font-mono break-all">
                {error.message.slice(0, 200)}
              </p>
            )}
            <button
              onClick={onRetry}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2 justify-between items-baseline">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className={`text-xs text-slate-300 truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main form component
// ─────────────────────────────────────────────────────────────────

export function RegisterItemForm({ onSuccess }: { onSuccess?: () => void }) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { status, txHash, error, mint, reset } = useMintItem();

  // Form fields
  const [photos, setPhotos] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [serial, setSerial] = useState('');
  const [purchaseProof, setPurchaseProof] = useState('');
  const [uniqueMarkings, setUniqueMarkings] = useState('');

  // Intermediate state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [prepared, setPrepared] = useState<PreparedMetadata | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const handleAddPhoto = useCallback((b64: string) => {
    setPhotos((prev) => [...prev, b64]);
  }, []);

  const handleRemovePhoto = useCallback((idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!isConnected || !address) {
      setFormError('Please connect your wallet first.');
      return;
    }
    if (!name.trim()) {
      setFormError('Item name is required.');
      return;
    }

    try {
      setIsProcessing(true);

      // ── Step A: Request wallet signature for key derivation ────
      setProcessingStep('Requesting signature for encryption key…');
      const signature = await signMessageAsync({
        message: getKeyDerivationMessage(),
      });

      // ── Step B: Encrypt and pin ────────────────────────────────
      setProcessingStep('Encrypting metadata and pinning to IPFS…');
      const input: ItemRegistrationInput = {
        name: name.trim(),
        brand: brand.trim(),
        serial: serial.trim(),
        purchaseProof: purchaseProof.trim() || undefined,
        photosBase64: photos,
        uniqueMarkings: uniqueMarkings.trim() || undefined,
      };

      const meta = await prepareItemMetadata(input, signature);
      setPrepared(meta);

      // ── Step C: Call mintItem (triggers wallet approval prompt) ──
      setProcessingStep('');
      setIsProcessing(false);
      await mint(meta.integrityHash);
    } catch (err) {
      setIsProcessing(false);
      setProcessingStep('');
      // If user cancelled signature, don't enter the tx error state
      if ((err as Error)?.message?.includes('User rejected')) {
        setFormError('Signature rejected. Encryption key derivation requires your signature.');
      } else {
        setFormError((err as Error)?.message ?? 'Unexpected error');
      }
    }
  };

  const handleDone = () => {
    reset();
    setPrepared(null);
    setPhotos([]);
    setName('');
    setBrand('');
    setSerial('');
    setPurchaseProof('');
    setUniqueMarkings('');
    onSuccess?.();
  };

  const isFormLocked = isProcessing || status === 'signing' || status === 'pending';

  return (
    <>
      {/* TX status overlay (signing / pending / confirmed / error) */}
      <TxStatusPanel
        status={status}
        txHash={txHash}
        error={error}
        onRetry={reset}
        onDone={handleDone}
        prepared={prepared}
      />

      {/* ── Form ── */}
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <Package className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-base">Register an Item</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Your photos and details are encrypted in your browser before being pinned
              to IPFS. Only the Keccak-256 hash is stored on-chain.
            </p>
          </div>
        </div>

        {/* Privacy badge */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
          <Shield className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <p className="text-xs text-emerald-300">
            AES-256-GCM encryption · key derived from your wallet signature · zero personal data on-chain
          </p>
        </div>

        {/* Photos */}
        <PhotoUploadZone
          photos={photos}
          onAdd={handleAddPhoto}
          onRemove={handleRemovePhoto}
        />

        {/* Item details */}
        <div className="grid grid-cols-1 gap-4">

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Item name <span className="text-violet-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. MacBook Pro 16&quot;"
              disabled={isFormLocked}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 disabled:opacity-50 transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Brand</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Apple"
                disabled={isFormLocked}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 disabled:opacity-50 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Serial number
              </label>
              <input
                type="text"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                placeholder="e.g. C02DF122Q05D"
                disabled={isFormLocked}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 disabled:opacity-50 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Purchase proof
              <span className="text-xs text-slate-500 font-normal ml-1.5">(order ID, receipt number, etc.)</span>
            </label>
            <input
              type="text"
              value={purchaseProof}
              onChange={(e) => setPurchaseProof(e.target.value)}
              placeholder="e.g. AMZN-2024-9918273"
              disabled={isFormLocked}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 disabled:opacity-50 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Unique markings
              <span className="text-xs text-slate-500 font-normal ml-1.5">(scratches, stickers, engravings)</span>
            </label>
            <textarea
              value={uniqueMarkings}
              onChange={(e) => setUniqueMarkings(e.target.value)}
              placeholder="e.g. Red dot sticker on bottom-left corner, small scratch on lid"
              disabled={isFormLocked}
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 disabled:opacity-50 transition resize-none"
            />
          </div>
        </div>

        {/* Processing step indicator */}
        {isProcessing && processingStep && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400 flex-shrink-0" />
            <span className="text-xs text-violet-300">{processingStep}</span>
          </div>
        )}

        {/* Form-level error */}
        {formError && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
            <span className="text-xs text-red-300">{formError}</span>
          </div>
        )}

        {/* Photo count summary */}
        {photos.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <ImageIcon className="w-3.5 h-3.5" />
            {photos.length} photo{photos.length !== 1 ? 's' : ''} ready for encryption
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isFormLocked || !isConnected}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-all
            bg-gradient-to-r from-violet-600 to-indigo-600
            hover:from-violet-500 hover:to-indigo-500
            disabled:opacity-40 disabled:cursor-not-allowed
            text-white shadow-lg shadow-violet-500/20
            active:scale-[0.98]"
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {processingStep || 'Processing…'}
            </span>
          ) : !isConnected ? (
            'Connect wallet to register'
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Shield className="w-4 h-4" />
              Encrypt &amp; Mint Proof-of-Custody Token
            </span>
          )}
        </button>

        <p className="text-xs text-slate-600 text-center">
          Two wallet confirmations required: one for the encryption key, one for the
          on-chain mint. Read both carefully before signing.
        </p>
      </form>
    </>
  );
}
