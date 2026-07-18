import { POST, mockMatches } from '../app/api/challenge/route';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { hashMessage } from 'viem';
import * as assert from 'assert';

async function runTest() {
    console.log('Starting challenge route tests...');

    const ownerAccount = privateKeyToAccount('0x0123456789012345678901234567890123456789012345678901234567890123');
    const randomAccount = privateKeyToAccount('0x9876543210987654321098765432109876543210987654321098765432109876');

    // Update mock to use our owner address
    mockMatches['match_1'].poctMintAddress = ownerAccount.address;

    const createReq = (body: any) => new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
    });

    const correctAnswers = 'red,blue,green';
    const wrongAnswers = 'yellow,blue,green';

    // 1. Valid signer + correct answers -> pass
    let sig1 = await ownerAccount.signMessage({ message: correctAnswers });
    let res1 = await POST(createReq({
        matchId: 'match_1',
        answers: correctAnswers,
        hash: correctAnswers, // using the raw string as 'hash' since signMessage hashes it
        signature: sig1
    }));
    let json1 = await res1.json();
    assert.strictEqual(res1.status, 200, 'Should pass');
    assert.strictEqual(json1.handoffLocation, 'Starbucks at 4th and King');

    // 2. Invalid signer + correct answers -> fail
    let sig2 = await randomAccount.signMessage({ message: correctAnswers });
    let res2 = await POST(createReq({
        matchId: 'match_1',
        answers: correctAnswers,
        hash: correctAnswers,
        signature: sig2
    }));
    assert.strictEqual(res2.status, 401, 'Should fail with 401');
    let json2 = await res2.json();
    assert.strictEqual(json2.error, 'Invalid signer');

    // 3. Valid signer + wrong answers -> fail
    let sig3 = await ownerAccount.signMessage({ message: wrongAnswers });
    let res3 = await POST(createReq({
        matchId: 'match_1',
        answers: wrongAnswers,
        hash: wrongAnswers,
        signature: sig3
    }));
    assert.strictEqual(res3.status, 401, 'Should fail with 401');
    let json3 = await res3.json();
    assert.strictEqual(json3.error, 'Incorrect answers');

    console.log('Challenge route tests passed!');
}

runTest().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
