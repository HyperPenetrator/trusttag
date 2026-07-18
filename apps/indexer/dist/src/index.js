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
exports.indexer = exports.CONFIRMATIONS_REQUIRED = void 0;
exports.listenPoCTStatusChanged = listenPoCTStatusChanged;
exports.listenRewardEscrowReleased = listenRewardEscrowReleased;
const dotenv = __importStar(require("dotenv"));
dotenv.config();
// mainnet-L2 value TBD once network chosen.
exports.CONFIRMATIONS_REQUIRED = parseInt(process.env.CONFIRMATIONS_REQUIRED || '5', 10);
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
        // TODO(prod): Implement real RPC call to get block hash
        return this.mockBlockHashes.get(blockNumber) || '';
    }
    async getCurrentBlock() {
        // TODO(prod): Implement real RPC call to get current block
        return this.mockCurrentBlock;
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
    // TODO(prod): Implement actual blockchain listener for StatusChanged
}
// Stub listener for RewardEscrow Released
function listenRewardEscrowReleased() {
    // TODO(prod): contract not yet deployed — interface only, no-op body
}
