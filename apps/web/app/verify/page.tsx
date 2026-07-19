import React from 'react';
import { ShieldAlert, ExternalLink, Globe, Cpu } from 'lucide-react';

export default function VerifyPage() {
  return (
    <div className="flex-1 py-16 px-6 max-w-4xl mx-auto w-full space-y-10">
      <div className="space-y-3">
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
          Official Domain & Smart Contract Verification
        </h1>
        <p className="text-sm text-slate-400">
          Phishing and site spoofing are common threats in Web3. Use this reference registry to audit the host domain and active contract deployments before executing any approvals.
        </p>
      </div>

      <div className="bg-red-950/20 border border-red-900/50 p-6 rounded-2xl flex items-start gap-4 text-sm text-red-200">
        <ShieldAlert className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold">Security Notice</h4>
          <p className="leading-relaxed text-red-300">
            TrustTag Protocol smart contracts are non-upgradable. The official deployments listed below will never change. Any app requesting signature access to other contract targets is a fake.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Domains */}
        <div className="glass-panel p-8 rounded-3xl border border-slate-800/80 space-y-4">
          <div className="flex items-center gap-2.5 text-indigo-400 font-semibold border-b border-slate-800 pb-3">
            <Globe className="w-5 h-5" /> Official Domains
          </div>
          <ul className="space-y-3 text-sm text-slate-300 font-mono">
            <li className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
              <span>trusttag-protocol.io</span>
              <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full font-sans font-semibold">Primary</span>
            </li>
            <li className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
              <span>trusttag.example.com</span>
              <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-sans font-semibold">Mirror</span>
            </li>
          </ul>
        </div>

        {/* Smart Contracts */}
        <div className="glass-panel p-8 rounded-3xl border border-slate-800/80 space-y-4">
          <div className="flex items-center gap-2.5 text-indigo-400 font-semibold border-b border-slate-800 pb-3">
            <Cpu className="w-5 h-5" /> Verified Smart Contracts
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                <span>Soulbound Token Passport (SBT)</span>
                <span className="font-mono text-emerald-400">Arbitrum Sepolia</span>
              </div>
              <div className="flex items-center justify-between gap-4 font-mono text-xs text-indigo-300">
                <span className="truncate">0x5FbDB2315678afecb367f032d93F642f64180aa3</span>
                <a
                  href="https://sepolia.arbiscan.io/address/0x5FbDB2315678afecb367f032d93F642f64180aa3"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  <ExternalLink className="w-4 h-4 flex-shrink-0" />
                </a>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                <span>Bounty Escrow Ledger</span>
                <span className="font-mono text-emerald-400">Arbitrum Sepolia</span>
              </div>
              <div className="flex items-center justify-between gap-4 font-mono text-xs text-indigo-300">
                <span className="truncate">0xxe7f1725E7734CE288F8367e1Bb143E90bb3F0512</span>
                <a
                  href="https://sepolia.arbiscan.io/address/0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  <ExternalLink className="w-4 h-4 flex-shrink-0" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
