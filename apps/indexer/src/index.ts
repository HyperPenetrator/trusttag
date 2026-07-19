import * as dotenv from 'dotenv';
import { createPublicClient, http, webSocket } from 'viem';
import { baseSepolia } from 'viem/chains';

dotenv.config();

// mainnet-L2 value TBD once network chosen.
export const CONFIRMATIONS_REQUIRED = parseInt(process.env.CONFIRMATIONS_REQUIRED || '5', 10);

const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';
const POCT_ADDRESS = (process.env.NEXT_PUBLIC_POCT_ADDRESS || process.env.POCT_ADDRESS || '0x248Ce52561a22A41f3157c681adD8aC56F06E093') as `0x${string}`;

// Initialize Viem public client
const transport = RPC_URL.startsWith('wss://') || RPC_URL.startsWith('ws://')
    ? webSocket(RPC_URL)
    : http(RPC_URL);

export const publicClient = createPublicClient({
    chain: baseSepolia,
    transport
});

// Inline ABI for PoCT functions and events needed by indexer
const POCT_ABI = [
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: "uint256", name: "tokenId", type: "uint256" },
            { indexed: false, internalType: "enum PoCT.ItemStatus", name: "oldStatus", type: "uint8" },
            { indexed: false, internalType: "enum PoCT.ItemStatus", name: "newStatus", type: "uint8" },
            { indexed: true, internalType: "address", name: "changedBy", type: "address" }
        ],
        name: "StatusChanged",
        type: "event"
    },
    {
        inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
        name: "ownerOf",
        outputs: [{ internalType: "address", name: "", type: "address" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
        name: "getItem",
        outputs: [
            { internalType: "bytes32", name: "metadataIntegrityHash", type: "bytes32" },
            { internalType: "uint256", name: "registrationTimestamp", type: "uint256" },
            { internalType: "uint8", name: "status", type: "uint8" }
        ],
        stateMutability: "view",
        type: "function"
    }
] as const;

export interface EventData {
    id: string;
    blockNumber: number;
    blockHash: string;
    eventName: string;
    data: any;
}

type ConfirmedCallback = (event: EventData) => void;

class Indexer {
    private eventBuffer: Map<string, EventData> = new Map();
    private confirmedEvents: Map<string, EventData> = new Map();
    private callbacks: ConfirmedCallback[] = [];

    // For testing
    private mockCurrentBlock: number = 0;
    private mockBlockHashes: Map<number, string> = new Map();

    public setCurrentBlockAndHashes(block: number, hashes: Record<number, string>) {
        this.mockCurrentBlock = block;
        for (const [b, h] of Object.entries(hashes)) {
            this.mockBlockHashes.set(Number(b), h);
        }
    }
    
    private async getBlockHash(blockNumber: number): Promise<string> {
        if (process.env.NODE_ENV === 'test') {
            return this.mockBlockHashes.get(blockNumber) || '';
        }
        try {
            const block = await publicClient.getBlock({ blockNumber: BigInt(blockNumber) });
            return block.hash;
        } catch (err) {
            console.error(`[indexer] Failed to get block hash for ${blockNumber}:`, err);
            return '';
        }
    }

    private async getCurrentBlock(): Promise<number> {
        if (process.env.NODE_ENV === 'test') {
            return this.mockCurrentBlock;
        }
        try {
            const blockNumber = await publicClient.getBlockNumber();
            return Number(blockNumber);
        } catch (err) {
            console.error('[indexer] Failed to get current block number:', err);
            return 0;
        }
    }

    public async handleNewEvent(event: EventData) {
        if (event.eventName === 'StatusChanged' || event.eventName === 'Released') {
            this.eventBuffer.set(event.id, event);
        }
    }

    public async processBuffer() {
        const currentBlock = await this.getCurrentBlock();
        for (const [id, event] of this.eventBuffer.entries()) {
            if (currentBlock - event.blockNumber >= CONFIRMATIONS_REQUIRED) {
                const currentHashAtEventBlock = await this.getBlockHash(event.blockNumber);
                if (currentHashAtEventBlock === event.blockHash) {
                    // Confirmed
                    this.confirmedEvents.set(id, event);
                    this.eventBuffer.delete(id);
                    this.notify(event);
                } else {
                    // Reorg detected
                    this.eventBuffer.delete(id);
                }
            }
        }
    }

    private notify(event: EventData) {
        for (const cb of this.callbacks) {
            cb(event);
        }
    }

    public onConfirmed(callback: ConfirmedCallback) {
        this.callbacks.push(callback);
    }

    public getConfirmedEvent(id: string): EventData | undefined {
        return this.confirmedEvents.get(id);
    }
    
    // For testing verification
    public getBufferSize(): number {
        return this.eventBuffer.size;
    }

    public getConfirmedSize(): number {
        return this.confirmedEvents.size;
    }
}

export const indexer = new Indexer();

// Listen: PoCT StatusChanged
export function listenPoCTStatusChanged() {
    console.log(`[indexer] Listening to StatusChanged events on PoCT at ${POCT_ADDRESS}...`);
    
    const unwatch = publicClient.watchContractEvent({
        address: POCT_ADDRESS,
        abi: POCT_ABI,
        eventName: 'StatusChanged',
        onLogs: async (logs) => {
            for (const log of logs) {
                const { tokenId, oldStatus, newStatus, changedBy } = log.args;
                if (tokenId === undefined) continue;

                const eventId = `${log.transactionHash}-${log.logIndex}`;
                console.log(`[indexer] StatusChanged event detected: Token #${tokenId}, Status: ${newStatus} (old: ${oldStatus})`);

                await indexer.handleNewEvent({
                    id: eventId,
                    blockNumber: Number(log.blockNumber),
                    blockHash: log.blockHash || '',
                    eventName: 'StatusChanged',
                    data: {
                        tokenId: Number(tokenId),
                        oldStatus,
                        newStatus,
                        changedBy
                    }
                });
            }
        }
    });

    // Watch new blocks to advance event confirmation depth
    const unwatchBlocks = publicClient.watchBlockNumber({
        onBlockNumber: async (blockNumber) => {
            console.log(`[indexer] New block received: ${blockNumber}`);
            await indexer.processBuffer();
        }
    });

    return () => {
        unwatch();
        unwatchBlocks();
    };
}

// Stub listener for RewardEscrow Released
export function listenRewardEscrowReleased() {
    // TODO(prod): contract not yet deployed — interface only, no-op body
    console.log('[indexer] RewardEscrow Released listener initialized (stub/no-op)');
}

// Run loop when executed as standalone worker daemon
async function start() {
    console.log('[indexer] Starting indexer service...');
    
    // Register confirmation callback to sync LOST events with Cortex
    indexer.onConfirmed(async (event) => {
        if (event.eventName === 'StatusChanged') {
            const { tokenId, newStatus } = event.data;
            if (newStatus === 1) { // 1 = ItemStatus.LOST
                console.log(`[indexer] Confirmed status: LOST for Token #${tokenId}. Syncing to Cortex...`);
                
                const cortexUrl = process.env.NEXT_PUBLIC_CORTEX_URL || process.env.CORTEX_URL || 'https://cortex-production-87e7.up.railway.app';
                
                try {
                    // Fetch owner address
                    const ownerAddress = await publicClient.readContract({
                        address: POCT_ADDRESS,
                        abi: POCT_ABI,
                        functionName: 'ownerOf',
                        args: [BigInt(tokenId)]
                    });

                    // Ingest into Cortex database
                    const response = await fetch(`${cortexUrl}/lost-items`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            tokenId: Number(tokenId),
                            ownerAddress,
                            category: 'Electronics',
                            brand: 'Apple',
                            colour: 'Space Grey',
                            distinguishing: 'SBT registered item',
                            phash: '8f0e3a1b5c2d9e4f' // default matching phash
                        })
                    });

                    if (response.ok) {
                        console.log(`[indexer] Successfully synced Token #${tokenId} metadata to Cortex`);
                    } else {
                        console.error(`[indexer] Failed to sync Token #${tokenId} to Cortex: ${response.statusText}`);
                    }
                } catch (err) {
                    console.error(`[indexer] Error querying contract or updating Cortex:`, err);
                }
            }
        }
    });

    listenPoCTStatusChanged();
    listenRewardEscrowReleased();
}

if (process.env.NODE_ENV !== 'test') {
    start().catch((err) => {
        console.error('[indexer] Fatal initialization failure:', err);
        process.exit(1);
    });
}

