'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useTrustTagWallet } from '../providers';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { Wallet, Mail, LogOut, ShieldAlert, CheckCircle2, Loader2 } from 'lucide-react';

export default function Header() {
  const { isConnected, address, ensName, connectorType, custodialEmail, connectCustodial, disconnectWallet } = useTrustTagWallet();
  const { openConnectModal } = useConnectModal();

  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [isProvisioning, setIsProvisioning] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;

    setIsProvisioning(true);
    // Simulate API delay for embedded wallet provisioning
    setTimeout(async () => {
      await connectCustodial(email);
      setIsProvisioning(false);
      setIsOpen(false);
      setEmail('');
    }, 1500);
  };

  const handleWeb3Connect = () => {
    if (openConnectModal) {
      openConnectModal();
      setIsOpen(false);
    }
  };

  // Helper to truncate address
  const truncateAddress = (addr: string | undefined) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <>
      <header className="sticky top-0 z-40 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-500/20">
            Æ
          </div>
          <Link href="/" className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-200 to-purple-200 bg-clip-text text-transparent hover:opacity-90">
            TrustTag
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/owner" className="text-sm font-medium text-slate-400 hover:text-indigo-400 transition-colors">
            Owner Passport
          </Link>
          <Link href="/finder" className="text-sm font-medium text-slate-400 hover:text-indigo-400 transition-colors">
            Finder Dashboard
          </Link>
          <Link href="/arbiter" className="text-sm font-medium text-slate-400 hover:text-indigo-400 transition-colors">
            Arbiter Courts
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {isConnected ? (
            <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-800 rounded-2xl pl-3 pr-1.5 py-1.5 shadow-inner">
              <div className="flex flex-col text-right">
                <span className="text-xs font-mono font-bold text-indigo-300">
                  {ensName || truncateAddress(address)}
                </span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  {connectorType === 'wagmi' ? 'Web3 Wallet' : `Custodial (${custodialEmail?.split('@')[0]})`}
                </span>
              </div>
              <button
                onClick={disconnectWallet}
                id="btn-disconnect"
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-red-950/30 hover:border-red-900/50 hover:text-red-400 border border-slate-700/50 flex items-center justify-center transition-all cursor-pointer"
                title="Disconnect Wallet"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsOpen(true)}
              id="btn-connect-wallet"
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm rounded-xl cursor-pointer shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
            >
              <Wallet className="w-4 h-4" /> Connect
            </button>
          )}
        </div>
      </header>

      {/* Combined Web3 & Custodial Login Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden glass-panel border border-slate-800 rounded-3xl p-8 bg-slate-900 shadow-2xl">
            {/* Close button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-800"
            >
              &times;
            </button>

            <div className="text-center space-y-2 mb-6">
              <h3 className="text-xl font-bold text-slate-100">Connect to TrustTag</h3>
              <p className="text-xs text-slate-400">Choose your preferred login method below</p>
            </div>

            <div className="space-y-6">
              {/* Web3 Button */}
              <button
                onClick={handleWeb3Connect}
                id="btn-web3-connect"
                className="w-full py-3.5 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-300 font-semibold rounded-2xl flex items-center justify-center gap-3 transition-all cursor-pointer"
              >
                <Wallet className="w-5 h-5 text-indigo-400" />
                Connect Web3 Wallet (MetaMask)
              </button>

              {/* Separator */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-4 text-slate-500 text-xs font-semibold uppercase tracking-wider">Or</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              {/* Email Connection */}
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email-input" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Continue with Email</label>
                  <input
                    type="email"
                    id="email-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    required
                    disabled={isProvisioning}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-2xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
                  />
                </div>

                <button
                  type="submit"
                  id="btn-email-submit"
                  disabled={isProvisioning || !email}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-indigo-800/50 disabled:to-purple-800/50 text-white font-semibold rounded-2xl flex items-center justify-center gap-3 transition-all cursor-pointer"
                >
                  {isProvisioning ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                      Provisioning Wallet...
                    </>
                  ) : (
                    <>
                      <Mail className="w-5 h-5 text-indigo-200" />
                      Continue with Email
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
