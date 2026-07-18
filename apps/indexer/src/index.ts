import * as dotenv from 'dotenv';

dotenv.config();

// mainnet-L2 value TBD once network chosen.
export const CONFIRMATIONS_REQUIRED = parseInt(process.env.CONFIRMATIONS_REQUIRED || '5', 10);

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
        // TODO(prod): Implement real RPC call to get block hash
        return this.mockBlockHashes.get(blockNumber) || '';
    }

    private async getCurrentBlock(): Promise<number> {
        // TODO(prod): Implement real RPC call to get current block
        return this.mockCurrentBlock;
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
    // TODO(prod): Implement actual blockchain listener for StatusChanged
}

// Stub listener for RewardEscrow Released
export function listenRewardEscrowReleased() {
    // TODO(prod): contract not yet deployed — interface only, no-op body
}
