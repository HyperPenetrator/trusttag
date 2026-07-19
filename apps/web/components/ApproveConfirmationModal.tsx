'use client';

import React from 'react';
import { ShieldCheck, ExternalLink, HelpCircle } from 'lucide-react';
import { addressExplorerLink } from '../lib/networkConfig';

interface ApproveConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  amount: string;
  token: string;
  contractName: string;
  contractAddress: string;
  purpose: string;
}

export function ApproveConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  amount,
  token,
  contractName,
  contractAddress,
  purpose,
}: ApproveConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel rounded-2xl p-6 max-w-md w-full border border-white/10 space-y-6 shadow-2xl animate-[scale_0.2s_ease-out]">
        
        {/* Header */}
        <div className="flex items-center gap-2.5 text-indigo-400 border-b border-white/5 pb-3">
          <ShieldCheck className="w-5 h-5" />
          <h3 className="font-bold text-lg text-white">In-App Approval Request</h3>
        </div>

        {/* Content */}
        <div className="space-y-4 text-sm text-slate-300">
          <p>
            You are about to authorize the following smart contract to interact with your tokens. 
            We request approval for the **exact bounty amount** only.
          </p>

          <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-slate-500">Contract Name</span>
              <span className="font-semibold text-white">{contractName}</span>
            </div>
            
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-slate-500">Contract Address</span>
              <a
                href={addressExplorerLink(contractAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                {contractAddress.slice(0, 8)}…{contractAddress.slice(-6)}
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
            </div>

            <div className="flex justify-between items-baseline">
              <span className="text-xs text-slate-500">Approval Limit</span>
              <span className="font-mono font-bold text-amber-400">
                {amount} {token}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-500 block">Intended Purpose</span>
              <span className="text-slate-400 text-xs leading-relaxed block bg-black/30 p-2 rounded-lg">
                {purpose}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-slate-500 bg-white/[0.01] p-3 rounded-lg border border-dashed border-white/5">
            <HelpCircle className="w-4 h-4 shrink-0 text-slate-600 mt-0.5" />
            <p>
              By proceeding, the wallet&apos;s native token approval dialog will fire. The approved limit matches the lockup amount exactly to prevent security exposure.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-semibold transition"
          >
            Deny / Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            id="confirm-app-approval"
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-lg shadow-indigo-600/10"
          >
            Authorize &amp; Continue
          </button>
        </div>
      </div>
    </div>
  );
}
