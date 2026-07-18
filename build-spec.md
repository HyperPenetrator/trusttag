# Build Spec

Conventions: TS strict mode. No placeholder/mock code left unmarked — tag with `// TODO(prod):`. Run tests after each section; report failures, don't silently patch around them.

---

## 1. Reorg-Safe Indexer

**Path:** `apps/indexer` (new)

Listen: PoCT `StatusChanged`. Stub listener for RewardEscrow `Released` (contract not yet deployed — interface only, no-op body).

Rules:
- Config: `CONFIRMATIONS_REQUIRED` (default 5, env-overridable). Add code comment: mainnet-L2 value TBD once network chosen.
- Buffer events in memory/temp table until `currentBlock - eventBlock >= CONFIRMATIONS_REQUIRED`.
- Only after confirmation depth met: write to indexer DB, fire downstream notification.
- Detect reorg via block hash mismatch on re-check; drop unconfirmed events silently from buffer (no persistence, no notification).

Test: `indexer.reorg.test.ts` — local node, emit event, reorg it out before confirmation depth, assert DB has zero rows and no notification fired.

Expose: typed query API / interface other services import (`getConfirmedEvent`, `onConfirmed(callback)`) — this is the interface Sections 4 and 5 read from.

---

## 2. Challenge-Response (non-ZK, upgradeable)

**Path:** `apps/web/app/api/challenge/route.ts` (or equivalent app router path)

Flow:
1. Cortex candidate match found → generate 2-3 questions from encrypted metadata (decrypt server-side, in-memory only, never send plaintext to client).
2. Client: owner answers → hash concatenated answers → `useSignMessage`/viem `signMessage` signs hash (off-chain, gas-less) → POST `{answers, signature}`.
3. Server verifies BOTH:
   - answers match decrypted metadata
   - `recoverMessageAddress(hash, signature) === PoCT_mint_address`
4. Reveal handoff meeting point only if both pass.

Comment upgrade path inline: `// TODO(zk-upgrade): replace plaintext answer-check with zk-SNARK proof of knowledge, verify circuit instead of decrypting metadata server-side`.

Test cases:
- valid signer + correct answers → pass
- invalid signer + correct answers → fail
- (add) valid signer + wrong answers → fail

Demo: script/route hitting flow with a mock match object end-to-end.

---

## 3. LedgerCourt.sol (Kleros-style dispute)

**Path:** `packages/contracts/src/LedgerCourt.sol`

Functions/flow:
- `raiseDispute(tokenId, evidenceHash)` — either party.
- `stakeAsJuror(amount)` — fixed stake in protocol token.
- Juror selection: 3 per dispute, behind `JurorRandomnessSource` interface (do not inline `block.hash`/`timestamp` logic directly in LedgerCourt). Comment: `// TODO(prod): swap for Chainlink VRF before mainnet — block-based randomness is manipulable by miners/validators, esp. for high-value disputes`.
- `vote(disputeId, choice)` — jurors only, before deadline.
- Resolution: majority wins; losing counterclaim rejected; if fraudulent, slash configurable % of stake → split to honest party + jurors.

**bootstrapMode:**
- Owner-toggleable bool.
- When true: juror pool = small whitelisted address set, not open stake pool.
- Comment: `// bootstrapMode: intended to be disabled once sufficient Lead Score history exists across user base`.

Tests (`LedgerCourt.t.sol` or equivalent): dispute creation, staking, vote tally, majority resolution, slashing math, bootstrap-mode restriction. Run, confirm pass.

---

## 4. LeadScore.sol

**Path:** `packages/contracts/src/LeadScore.sol`

- `mapping(address => uint256)` balance. **Not ERC-20/ERC-721** — non-transferable, non-tokenized by design (no `transfer`/`approve` surface at all).
- `+10` on confirmed handoff — triggered from RewardEscrow's `releaseToFinder`, which reads confirmed state from **Section 1 indexer**, not raw events.
- `+2` on any FoundReport submission, regardless of match outcome.
- `getLeadScore(address) view returns (uint256)`.
- `getTopReporters(limit)` — do NOT sort on-chain; backed by off-chain indexer aggregation (Section 1) reading emitted events.

**Profile page:** `apps/web` — connected wallet's Lead Score (`getLeadScore`, free call, no signing) + recovery history (PoCT + LeadScore). Render and confirm working in browser.

---

## 5. apps/connect-api

**Path:** `apps/connect-api` (Node.js + TS, REST)

Endpoints:
1. Auth: API key middleware.
2. `POST /surrendered-items/bulk-check` — match against active LOST reports. Import Cortex's matching logic as shared lib (`packages/cortex-matching` or similar) — **no duplicate implementation**.
3. Webhook on confirmed match/recovery — fire ONLY from Section 1 indexer's confirmed-event stream, never from raw chain events (prevents notifying a partner of a since-reorg'd recovery).

Deliverables:
- OpenAPI spec (`openapi.yaml`).
- Example request/response per endpoint (Postman-style, in README or `/examples`).
- Integration tests against local instance — run, confirm pass.

---

## 6. E2E Browser Walkthrough

Using browser tool, against local testnet + local services, screenshot each step:

1. Register item — Owner A.
2. Mark lost + set reward.
3. Submit Found Report — Finder B, matching photo.
4. Confirm Cortex surfaces match.
5. Challenge-response as Owner A (Section 2 flow).
6. Confirm handoff.
7. Verify RewardEscrow releases funds to Finder B.
8. Verify LeadScore +10 for Finder B.

Report any failing/unexpected step explicitly — do not silently work around it.
