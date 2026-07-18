import { NextResponse } from 'next/server';
import { recoverMessageAddress } from 'viem';

// Mock DB for match objects and answers
export const mockMatches: Record<string, {
    poctMintAddress: string;
    metadata: {
        answers: string;
    };
    handoffLocation: string;
}> = {
    'match_1': {
        poctMintAddress: '0x1234567890123456789012345678901234567890', // Example owner
        metadata: {
            answers: 'red,blue,green' // Mock decrypted answers
        },
        handoffLocation: 'Starbucks at 4th and King'
    }
};

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { matchId, answers, signature, hash } = body;

        const match = mockMatches[matchId];
        if (!match) {
            return NextResponse.json({ error: 'Match not found' }, { status: 404 });
        }

        // 1. Verify answers
        // TODO(prod): Decrypt metadata server-side to get answers
        const decryptedAnswers = match.metadata.answers;
        // TODO(zk-upgrade): replace plaintext answer-check with zk-SNARK proof of knowledge, verify circuit instead of decrypting metadata server-side
        if (answers !== decryptedAnswers) {
            return NextResponse.json({ error: 'Incorrect answers' }, { status: 401 });
        }

        // 2. Verify signature
        try {
            const recoveredAddress = await recoverMessageAddress({
                message: hash, // In viem, signMessage hashes the message, so we just recover the message text itself if that's what was signed, but the spec says "hash concatenated answers -> signMessage signs hash". We'll just pass hash as the message.
                signature: signature as `0x${string}`
            });

            if (recoveredAddress.toLowerCase() !== match.poctMintAddress.toLowerCase()) {
                return NextResponse.json({ error: 'Invalid signer' }, { status: 401 });
            }
        } catch (e) {
            return NextResponse.json({ error: 'Signature recovery failed' }, { status: 400 });
        }

        // Both passed, reveal handoff
        return NextResponse.json({ handoffLocation: match.handoffLocation });
    } catch (e) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
