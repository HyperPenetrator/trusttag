export interface Item {
  id: number;
  name: string;
  serial: string;
  status: "Active" | "Lost" | "FoundPending" | "Recovered";
  bounty: string;
  metadataURI: string;
  secretChallenge: string;
  locationProposal?: string;
  finder?: string;
}

export interface OwnerProfile {
  walletAddress: string;
  name?: string;
  itemsRegisteredCount: number;
  reputationScore: number;
}

export interface LostReport {
  itemId: number;
  reporterAddress: string;
  lostTime: number; // timestamp
  description?: string;
  bountyEscrowAmount: string; // bounty locked in escrow
}

export interface FoundReport {
  itemId?: number; // can be undefined if unmatched initially
  finderAddress: string;
  foundTime: number; // timestamp
  description: string;
  locationProposal: string;
  perceptualHash?: string;
}

export interface MatchCandidate {
  lostReportId: number;
  foundReportId: number;
  confidenceScore: number; // match rating/score
  matchedTime: number;
  status: "Pending" | "Verified" | "Rejected";
}

// Storage module: AES-GCM encryption + IPFS pinning
export * from './storage';
