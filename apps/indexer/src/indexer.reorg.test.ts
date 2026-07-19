process.env.NODE_ENV = 'test';
import { indexer, CONFIRMATIONS_REQUIRED } from './index';
import * as assert from 'assert';

async function runTest() {
    console.log('Starting indexer reorg test...');

    let notified = false;
    indexer.onConfirmed((event) => {
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
    await indexer.handleNewEvent(event);
    assert.strictEqual(indexer.getBufferSize(), 1, 'Buffer should have 1 event');

    // 2. Set current block to 104 (not enough confirmations yet, assuming 5)
    indexer.setCurrentBlockAndHashes(100 + CONFIRMATIONS_REQUIRED - 1, { 100: 'hash_100_A' });
    await indexer.processBuffer();
    assert.strictEqual(indexer.getBufferSize(), 1, 'Event should still be in buffer');
    assert.strictEqual(indexer.getConfirmedSize(), 0, 'No events should be confirmed yet');
    assert.strictEqual(notified, false, 'Should not have fired notification');

    // 3. Reorg happens! Block 100 hash changes to hash_100_B. Block advances past confirmation depth.
    indexer.setCurrentBlockAndHashes(100 + CONFIRMATIONS_REQUIRED, { 100: 'hash_100_B' });
    
    // 4. Process buffer again
    await indexer.processBuffer();
    
    // 5. Assertions
    assert.strictEqual(indexer.getBufferSize(), 0, 'Event should be dropped from buffer due to reorg');
    assert.strictEqual(indexer.getConfirmedSize(), 0, 'Event should NOT be in DB');
    assert.strictEqual(notified, false, 'Should NOT have fired downstream notification');

    console.log('Indexer reorg test passed!');
}

runTest().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
