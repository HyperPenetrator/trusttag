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
const index_1 = require("./index");
const assert = __importStar(require("assert"));
async function runTest() {
    console.log('Starting indexer reorg test...');
    let notified = false;
    index_1.indexer.onConfirmed((event) => {
        notified = true;
    });
    const event = {
        id: 'evt_1',
        blockNumber: 100,
        blockHash: 'hash_100_A',
        eventName: 'StatusChanged',
        data: {}
    };
    // 1. Emit event at block 100
    await index_1.indexer.handleNewEvent(event);
    assert.strictEqual(index_1.indexer.getBufferSize(), 1, 'Buffer should have 1 event');
    // 2. Set current block to 104 (not enough confirmations yet, assuming 5)
    index_1.indexer.setCurrentBlockAndHashes(100 + index_1.CONFIRMATIONS_REQUIRED - 1, { 100: 'hash_100_A' });
    await index_1.indexer.processBuffer();
    assert.strictEqual(index_1.indexer.getBufferSize(), 1, 'Event should still be in buffer');
    assert.strictEqual(index_1.indexer.getConfirmedSize(), 0, 'No events should be confirmed yet');
    assert.strictEqual(notified, false, 'Should not have fired notification');
    // 3. Reorg happens! Block 100 hash changes to hash_100_B. Block advances past confirmation depth.
    index_1.indexer.setCurrentBlockAndHashes(100 + index_1.CONFIRMATIONS_REQUIRED, { 100: 'hash_100_B' });
    // 4. Process buffer again
    await index_1.indexer.processBuffer();
    // 5. Assertions
    assert.strictEqual(index_1.indexer.getBufferSize(), 0, 'Event should be dropped from buffer due to reorg');
    assert.strictEqual(index_1.indexer.getConfirmedSize(), 0, 'Event should NOT be in DB');
    assert.strictEqual(notified, false, 'Should NOT have fired downstream notification');
    console.log('Indexer reorg test passed!');
}
runTest().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
