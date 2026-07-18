"use client";

import { useState } from "react";
import { Scale, Users, ShieldAlert, Award, FileText, Gavel } from "lucide-react";

interface Dispute {
  id: number;
  itemName: string;
  tokenId: number;
  owner: string;
  finder: string;
  bounty: string;
  evidenceURI: string;
  locationProposal: string;
  votesOwner: number;
  votesFinder: number;
  status: "Active" | "ResolvedOwner" | "ResolvedFinder";
}

export default function ArbiterDashboard() {
  const [disputes, setDisputes] = useState<Dispute[]>([
    {
      id: 0,
      itemName: "Louis Vuitton Travel Bag",
      tokenId: 1,
      owner: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      finder: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      bounty: "0.2 ETH",
      evidenceURI: "ipfs://Qm Vuitton Bag Evidence Hash",
      locationProposal: "Airport Lounge Lost & Found desk locker 12B",
      votesOwner: 1,
      votesFinder: 1,
      status: "Active",
    }
  ]);

  const [hasVoted, setHasVoted] = useState<Record<number, boolean>>({});

  const handleVote = (disputeId: number, voteForOwner: boolean) => {
    if (hasVoted[disputeId]) return;

    setDisputes(disputes.map(dispute => {
      if (dispute.id !== disputeId) return dispute;

      const newVotesOwner = voteForOwner ? dispute.votesOwner + 1 : dispute.votesOwner;
      const newVotesFinder = !voteForOwner ? dispute.votesFinder + 1 : dispute.votesFinder;
      const totalVotes = newVotesOwner + newVotesFinder;
      
      let newStatus = dispute.status;
      if (totalVotes >= 3) {
        newStatus = newVotesOwner >= newVotesFinder ? "ResolvedOwner" : "ResolvedFinder";
        alert(`Dispute resolved! Decision: ${newStatus === "ResolvedOwner" ? "Refund to Owner" : "Release to Finder"}. Funds transferred.`);
      } else {
        alert("Vote registered successfully. Awaiting final consensus from other staked jurors.");
      }

      return {
        ...dispute,
        votesOwner: newVotesOwner,
        votesFinder: newVotesFinder,
        status: newStatus
      };
    }));

    setHasVoted({ ...hasVoted, [disputeId]: true });
  };

  return (
    <div className="flex-1 py-12 px-6 max-w-6xl mx-auto w-full space-y-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
            Decentralized Arbitration Courts
          </h1>
          <p className="text-sm text-slate-400 mt-1">Review evidence logs, cast staked votes, and resolve physical ownership disputes.</p>
        </div>

        {/* Juror Staking Panel */}
        <div className="glass-panel px-6 py-3 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Your Juror Stake</div>
            <div className="text-lg font-bold font-mono text-indigo-300">
              500.0 AETHER
            </div>
          </div>
        </div>
      </div>

      {/* Main disputes panel */}
      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Left: Active Cases */}
        <div className="md:col-span-2 space-y-6">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold border-b border-slate-800 pb-3">
            <Gavel className="w-5 h-5" /> Active Court Cases
          </div>

          <div className="grid gap-6">
            {disputes.map(dispute => (
              <div key={dispute.id} className="glass-panel p-6 rounded-2xl border-l-4 border-l-purple-500 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-purple-500/10 border border-purple-500/20 text-purple-400 font-mono px-2.5 py-0.5 rounded-md">
                      Case #{dispute.id}
                    </span>
                    <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-md">
                      Token ID: {dispute.tokenId}
                    </span>
                  </div>
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                    dispute.status === 'Active' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {dispute.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-slate-100">{dispute.itemName}</h3>
                  <div className="text-xs text-slate-400">Escrow Value: <span className="font-mono text-indigo-400 font-semibold">{dispute.bounty}</span></div>
                </div>

                {/* Evidence Trail */}
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 space-y-3 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400 font-semibold border-b border-slate-800/50 pb-2">
                    <FileText className="w-4 h-4 text-indigo-400" /> Evidence Audit Logs
                  </div>
                  <div className="space-y-1.5 text-slate-300">
                    <div><span className="text-slate-500">Owner Wallet:</span> <span className="font-mono">{dispute.owner}</span></div>
                    <div><span className="text-slate-500">Finder Wallet:</span> <span className="font-mono">{dispute.finder}</span></div>
                    <div><span className="text-slate-500">Metadata Vault:</span> <span className="font-mono hover:text-indigo-400 cursor-pointer">{dispute.evidenceURI}</span></div>
                    <div><span className="text-slate-500">Finder Report Details:</span> <span>{dispute.locationProposal}</span></div>
                  </div>
                </div>

                {/* Voting status & actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-800/60 pt-4">
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <div>Votes Owner: <span className="font-mono text-slate-200 font-bold">{dispute.votesOwner}</span></div>
                    <div>•</div>
                    <div>Votes Finder: <span className="font-mono text-slate-200 font-bold">{dispute.votesFinder}</span></div>
                  </div>

                  {dispute.status === "Active" && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleVote(dispute.id, true)}
                        disabled={hasVoted[dispute.id]}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold py-2 px-4 rounded-xl transition-colors"
                      >
                        Refund Owner
                      </button>
                      <button 
                        onClick={() => handleVote(dispute.id, false)}
                        disabled={hasVoted[dispute.id]}
                        className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold py-2 px-4 rounded-xl transition-colors"
                      >
                        Reward Finder
                      </button>
                    </div>
                  )}

                  {dispute.status !== "Active" && (
                    <div className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                      <Award className="w-4 h-4" /> Consensus Reached
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel: Juror Information */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold border-b border-slate-800 pb-3">
            <Users className="w-5 h-5" /> Court Statistics
          </div>

          <div className="glass-panel p-5 rounded-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Active Jurors Staked:</span>
              <span className="font-mono text-slate-200 font-bold">142</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Total Disputes Resolved:</span>
              <span className="font-mono text-slate-200 font-bold">489</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Consensus Rate:</span>
              <span className="font-mono text-emerald-400 font-bold">96.8%</span>
            </div>
            <div className="border-t border-slate-800/80 pt-3">
              <span className="text-slate-500 leading-relaxed block">
                Staked Jurors earn 1% of the resolved bounty pool values. Malicious votes that deviate from final consensus will result in token stake slashing.
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
