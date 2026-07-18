'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http, useAccount, useDisconnect } from 'wagmi';
import { mainnet, sepolia, localhost, baseSepolia } from 'wagmi/chains';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

// Configure Wagmi config using RainbowKit's helper
const config = getDefaultConfig({
  appName: 'TrustTag Protocol',
  projectId: '886f78811cf6cb7301c238b72cb657c9', // Mock WalletConnect project ID
  chains: [localhost, baseSepolia, mainnet, sepolia],
  ssr: true,
});

const queryClient = new QueryClient();

// Define Context for unified Web3 + Custodial Email Wallet
interface WalletContextType {
  isConnected: boolean;
  address: string | undefined;
  ensName: string | undefined;
  connectorType: 'wagmi' | 'custodial' | undefined;
  custodialEmail: string | undefined;
  connectCustodial: (email: string) => Promise<void>;
  disconnectWallet: () => void;
  showOnboarding: boolean;
  dismissOnboarding: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function useTrustTagWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useTrustTagWallet must be used within a WalletProvider');
  }
  return context;
}

// Inner Provider to access wagmi hooks
function WalletProviderInner({ children }: { children: React.ReactNode }) {
  const { address: wagmiAddress, isConnected: isWagmiConnected } = useAccount();
  const { disconnect: disconnectWagmi } = useDisconnect();

  const [custodialAddress, setCustodialAddress] = useState<string | undefined>(undefined);
  const [custodialEmail, setCustodialEmail] = useState<string | undefined>(undefined);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Sync state from localStorage for custodial wallet
  useEffect(() => {
    const savedEmail = localStorage.getItem('trusttag_custodial_email');
    const savedAddress = localStorage.getItem('trusttag_custodial_address');
    if (savedEmail && savedAddress) {
      setCustodialEmail(savedEmail);
      setCustodialAddress(savedAddress);
    }
  }, []);

  const isConnected = isWagmiConnected || !!custodialAddress;
  const address = isWagmiConnected ? wagmiAddress : custodialAddress;
  const connectorType = isWagmiConnected ? 'wagmi' : custodialAddress ? 'custodial' : undefined;

  // Onboarding trigger
  useEffect(() => {
    if (isConnected) {
      const hasSeen = localStorage.getItem('trusttag_has_seen_onboarding');
      if (!hasSeen) {
        setShowOnboarding(true);
      }
    }
  }, [isConnected]);

  const connectCustodial = async (email: string) => {
    // TODO: Integrate with embedded-wallet provider (e.g. Dynamic, Privy, or Web3Auth)
    // behind the scenes to provision a custodial smart-contract wallet.
    const mockAddress = `0xCustodial${Array.from(email).reduce((acc, char) => acc + char.charCodeAt(0).toString(16), '')}`.slice(0, 42).padEnd(42, '0');
    
    localStorage.setItem('trusttag_custodial_email', email);
    localStorage.setItem('trusttag_custodial_address', mockAddress);
    setCustodialEmail(email);
    setCustodialAddress(mockAddress);
  };

  const disconnectWallet = () => {
    if (isWagmiConnected) {
      disconnectWagmi();
    }
    localStorage.removeItem('trusttag_custodial_email');
    localStorage.removeItem('trusttag_custodial_address');
    setCustodialEmail(undefined);
    setCustodialAddress(undefined);
  };

  const dismissOnboarding = () => {
    localStorage.setItem('trusttag_has_seen_onboarding', 'true');
    setShowOnboarding(false);
  };

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        address,
        ensName: undefined, // Mock ENS name helper
        connectorType,
        custodialEmail,
        connectCustodial,
        disconnectWallet,
        showOnboarding,
        dismissOnboarding,
      }}
    >
      {children}

      {/* Onboarding Security Modal */}
      {showOnboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg overflow-hidden glass-panel border border-indigo-500/30 rounded-3xl p-8 bg-slate-900 shadow-2xl shadow-indigo-500/10 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xl shadow-inner">
                🛡️
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-100">Welcome to TrustTag</h3>
                <p className="text-xs text-indigo-300">Important security briefing for first-time wallets</p>
              </div>
            </div>

            <div className="space-y-4 text-sm text-slate-300 border-y border-slate-800/80 py-5">
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 text-xs font-bold flex items-center justify-center text-indigo-400 border border-slate-700/50">1</span>
                <p className="leading-relaxed">
                  TrustTag will <strong>never</strong> ask for your seed phrase or private key in a support ticket, email, or in-app message. Keep them private.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 text-xs font-bold flex items-center justify-center text-indigo-400 border border-slate-700/50">2</span>
                <p className="leading-relaxed">
                  Always check that the URL matches the official TrustTag domain before connecting your wallet. <strong>Bookmark the page</strong> rather than searching for it.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 text-xs font-bold flex items-center justify-center text-indigo-400 border border-slate-700/50">3</span>
                <p className="leading-relaxed">
                  Every write action (minting SBTs, locking or releasing escrow, voting) will prompt a wallet signature/confirmation showing exactly what you're approving. <strong>Read the details before signing.</strong>
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={dismissOnboarding}
                id="btn-dismiss-onboarding"
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-600/25"
              >
                I Understand & Agree
              </button>
            </div>
          </div>
        </div>
      )}
    </WalletContext.Provider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <WalletProviderInner>
            {children}
          </WalletProviderInner>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
