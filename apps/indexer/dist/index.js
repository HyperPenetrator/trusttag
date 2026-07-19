"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexer = exports.publicClient = exports.CONFIRMATIONS_REQUIRED = void 0;
exports.listenPoCTStatusChanged = listenPoCTStatusChanged;
exports.listenRewardEscrowReleased = listenRewardEscrowReleased;
const dotenv = __importStar(require("dotenv"));
const viem_1 = require("viem");
const chains_1 = require("viem/chains");
dotenv.config();
// mainnet-L2 value TBD once network chosen.
exports.CONFIRMATIONS_REQUIRED = parseInt(process.env.CONFIRMATIONS_REQUIRED || '5', 10);
const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';
const POCT_ADDRESS = (process.env.NEXT_PUBLIC_POCT_ADDRESS || process.env.POCT_ADDRESS || '0x248Ce52561a22A41f3157c681adD8aC56F06E093');
// Initialize Viem public client
const transport = RPC_URL.startsWith('wss://') || RPC_URL.startsWith('ws://')
    ? (0, viem_1.webSocket)(RPC_URL)
    : (0, viem_1.http)(RPC_URL);
exports.publicClient = (0, viem_1.createPublicClient)({
    chain: chains_1.baseSepolia,
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
];
class Indexer {
    eventBuffer = new Map();
    confirmedEvents = new Map();
    callbacks = [];
    // For testing
    mockCurrentBlock = 0;
    mockBlockHashes = new Map();
    setCurrentBlockAndHashes(block, hashes) {
        this.mockCurrentBlock = block;
        for (const [b, h] of Object.entries(hashes)) {
            this.mockBlockHashes.set(Number(b), h);
        }
    }
    async getBlockHash(blockNumber) {
        if (process.env.NODE_ENV === 'test') {
            return this.mockBlockHashes.get(blockNumber) || '';
        }
        try {
            const block = await exports.publicClient.getBlock({ blockNumber: BigInt(blockNumber) });
            return block.hash ?? '';
        }
        catch (err) {
            console.error(`[indexer] Failed to get block hash for ${blockNumber}:`, err);
            return '';
        }
    }
    async getCurrentBlock() {
        if (process.env.NODE_ENV === 'test') {
            return this.mockCurrentBlock;
        }
        try {
            const blockNumber = await exports.publicClient.getBlockNumber();
            return Number(blockNumber);
        }
        catch (err) {
            console.error('[indexer] Failed to get current block number:', err);
            return 0;
        }
    }
    async handleNewEvent(event) {
        if (event.eventName === 'StatusChanged' || event.eventName === 'Released') {
            this.eventBuffer.set(event.id, event);
        }
    }
    async processBuffer() {
        const currentBlock = await this.getCurrentBlock();
        for (const [id, event] of this.eventBuffer.entries()) {
            if (currentBlock - event.blockNumber >= exports.CONFIRMATIONS_REQUIRED) {
                const currentHashAtEventBlock = await this.getBlockHash(event.blockNumber);
                if (currentHashAtEventBlock === event.blockHash) {
                    // Confirmed
                    this.confirmedEvents.set(id, event);
                    this.eventBuffer.delete(id);
                    this.notify(event);
                }
                else {
                    // Reorg detected
                    this.eventBuffer.delete(id);
                }
            }
        }
    }
    notify(event) {
        for (const cb of this.callbacks) {
            cb(event);
        }
    }
    onConfirmed(callback) {
        this.callbacks.push(callback);
    }
    getConfirmedEvent(id) {
        return this.confirmedEvents.get(id);
    }
    // For testing verification
    getBufferSize() {
        return this.eventBuffer.size;
    }
    getConfirmedSize() {
        return this.confirmedEvents.size;
    }
}
exports.indexer = new Indexer();
// Listen: PoCT StatusChanged
function listenPoCTStatusChanged() {
    console.log(`[indexer] Listening to StatusChanged events on PoCT at ${POCT_ADDRESS}...`);
    const unwatch = exports.publicClient.watchContractEvent({
        address: POCT_ADDRESS,
        abi: POCT_ABI,
        eventName: 'StatusChanged',
        onLogs: async (logs) => {
            for (const log of logs) {
                const { tokenId, oldStatus, newStatus, changedBy } = log.args;
                if (tokenId === undefined)
                    continue;
                const eventId = `${log.transactionHash}-${log.logIndex}`;
                console.log(`[indexer] StatusChanged event detected: Token #${tokenId}, Status: ${newStatus} (old: ${oldStatus})`);
                await exports.indexer.handleNewEvent({
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
    const unwatchBlocks = exports.publicClient.watchBlockNumber({
        onBlockNumber: async (blockNumber) => {
            console.log(`[indexer] New block received: ${blockNumber}`);
            await exports.indexer.processBuffer();
        }
    });
    return () => {
        unwatch();
        unwatchBlocks();
    };
}
// Stub listener for RewardEscrow Released
function listenRewardEscrowReleased() {
    // TODO(prod): contract not yet deployed — interface only, no-op body
    console.log('[indexer] RewardEscrow Released listener initialized (stub/no-op)');
}
// Run loop when executed as standalone worker daemon
async function start() {
    console.log('[indexer] Starting indexer service...');
    // Register confirmation callback to sync LOST events with Cortex
    exports.indexer.onConfirmed(async (event) => {
        if (event.eventName === 'StatusChanged') {
            const { tokenId, newStatus } = event.data;
            if (newStatus === 1) { // 1 = ItemStatus.LOST
                console.log(`[indexer] Confirmed status: LOST for Token #${tokenId}. Syncing to Cortex...`);
                const cortexUrl = process.env.NEXT_PUBLIC_CORTEX_URL || process.env.CORTEX_URL || 'https://cortex-production-87e7.up.railway.app';
                try {
                    // Fetch owner address
                    const ownerAddress = await exports.publicClient.readContract({
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
                    }
                    else {
                        console.error(`[indexer] Failed to sync Token #${tokenId} to Cortex: ${response.statusText}`);
                    }
                }
                catch (err) {
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
