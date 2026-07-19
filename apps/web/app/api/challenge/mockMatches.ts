// Mock DB for match objects and answers (shared between route handler and tests)
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
