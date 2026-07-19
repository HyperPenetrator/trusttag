import Link from "next/link";
import { ShieldCheck, Search, ShieldAlert, Award, FileText, Lock } from "lucide-react";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col justify-center items-center py-20 px-6 max-w-6xl mx-auto w-full">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mb-16 space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-400">
          <Award className="w-3.5 h-3.5" /> Web3-Powered Physical Item Recovery
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-100 to-purple-200 bg-clip-text text-transparent leading-tight">
          Cryptographic Trust for Real-World Belongings
        </h1>
        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
          AetherFind turns physical ownership proof into non-transferable Digital Certificates. Match lost items, lock bounties in escrow, and resolve disputes without centralized intermediaries.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            href="/owner"
            className="px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2"
          >
            <ShieldCheck className="w-5 h-5" /> Owner Information
          </Link>
          <Link
            href="/finder"
            className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-100 font-medium rounded-xl transition-all flex items-center gap-2"
          >
            <Search className="w-5 h-5" /> Finder Registry
          </Link>
        </div>
      </div>

      {/* Stats Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-5xl mb-20">
        {[
          { label: "Items Registered", value: "24,582" },
          { label: "Total Recovered", value: "8,924" },
          { label: "Bounties Escrowed", value: "142.5 ETH" },
          { label: "Average Handoff Time", value: "< 24 Hours" },
        ].map((stat, idx) => (
          <div key={idx} className="glass-panel p-5 rounded-2xl text-center">
            <div className="text-2xl font-bold bg-gradient-to-r from-indigo-200 to-purple-200 bg-clip-text text-transparent font-mono">{stat.value}</div>
            <div className="text-xs text-slate-400 mt-1 uppercase tracking-wider">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Protocol Layers */}
      <div className="w-full">
        <h2 className="text-3xl font-bold text-center mb-12 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
          Built on Trustless Cryptographic Infrastructure
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="glass-panel glass-panel-hover p-8 rounded-2xl transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold text-slate-100">Digital Certificate Passport</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Items are created as non-transferable Digital Certificates representing ownership that Cannot Be Changed, storing hashed item identifiers securely on-chain.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass-panel glass-panel-hover p-8 rounded-2xl transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold text-slate-100">Secure Escrow Rewards</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Bounties are locked securely in Digital Agreement Escrow at the moment of loss and automatically released to finders upon validated receipt.
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass-panel glass-panel-hover p-8 rounded-2xl transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold text-slate-100">Decentralized Arbitration</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Disputes are adjudicated by a decentralized panel of staked community jurors who review encrypted proof chains and execute fair resolutions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
