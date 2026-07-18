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
    lostTime: number;
    description?: string;
    bountyEscrowAmount: string;
}
export interface FoundReport {
    itemId?: number;
    finderAddress: string;
    foundTime: number;
    description: string;
    locationProposal: string;
    perceptualHash?: string;
}
export interface MatchCandidate {
    lostReportId: number;
    foundReportId: number;
    confidenceScore: number;
    matchedTime: number;
    status: "Pending" | "Verified" | "Rejected";
}
export * from './storage';
