
PRODUCT REQUIREMENTS DOCUMENT
Blockchain Lost & Found System
A Decentralized Protocol for Verified Lost-Item Recovery
Web3 Wallets  ·  Decentralized Storage  ·  Verifiable Ownership  ·  Tamper-Proof Records

Version 1.0  |  Draft for Review
Prepared: July 15, 2026

1  Overview & Problem Statement
Every year, billions of physical items — wallets, phones, luggage, pets, devices, documents — are lost in transit, in public venues, and across borders. Existing lost-and-found systems are fragmented, manual, and built on institutional trust: a lost item is only as recoverable as the goodwill and diligence of whoever finds it and whichever centralized lobby, airline, or city office happens to log it.
This creates three structural failures:
No universal registry — lost-item reports live in siloed spreadsheets, per-venue lost-and-found desks, or nowhere at all.
No trustworthy ownership proof — anyone can claim an item verbally, enabling fraud and disputes.
No incentive alignment — finders have little reason to report an item beyond goodwill, and there is no tamper-proof audit trail once an item changes hands.

The Opportunity
Blockchain, Web3 wallets, and decentralized storage let us replace institutional trust with cryptographic trust. Ownership, custody, and recovery events become verifiable, portable, and resistant to tampering — without requiring a single company or government to run (or be trusted with) the registry.
2  Vision & Goals
Vision Statement
Build the world's first decentralized, trustless Lost & Found protocol — a public good where any item, anywhere, can be registered, reported, matched, and returned with cryptographically verifiable proof of ownership, eliminating fraud and rewarding honest participants.
Goals
Give owners a tamper-proof, portable proof-of-ownership for their belongings, independent of any single company.
Let finders report items in under 60 seconds and get rewarded fairly and transparently.
Automate lost/found matching using decentralized identifiers (DIDs) and item fingerprints instead of manual desk lookups.
Make every recovery event auditable on-chain, deterring fraudulent claims.
Remain accessible to non-crypto-native users through custodial wallet options and fiat-equivalent rewards.
3  Target Users & Personas
Persona
Description
Core Need
Owner (Registrant)
Registers valuable items (phone, bike, luggage, pet) with a digital fingerprint before loss occurs.
Prove ownership instantly, recover items fast.
Finder
Discovers a lost item in public and wants to report it safely and get credit/reward.
Frictionless reporting, guaranteed reward, no liability.
Venue / Partner
Airports, hotels, transit authorities, universities running local lost-and-found operations.
Reduce manual workload, integrate via API, cut fraud/disputes.
Verifier / Arbiter
Community node or staked validator who resolves disputed claims.
Clear evidence trail, fair incentive to adjudicate honestly.
Insurer (secondary)
Insurance companies referencing recovery records for claims processing.
Trustworthy, immutable proof of loss/recovery timeline.
4  How It Works — Solution Overview
Core Concept
Each item is represented on-chain as a non-transferable “Proof-of-Ownership” token (a Soulbound Token, or SBT) minted to the owner's Web3 wallet. The token references an off-chain, encrypted metadata bundle — photos, serial numbers, unique markings, purchase proof — stored on decentralized storage (IPFS/Filecoin/Arweave) and hashed on-chain for tamper-evidence.
When an item goes missing, the owner flips its on-chain status to “Lost,” optionally revealing a bounty. When a finder discovers an item, they scan a tag (NFC/QR) or submit photos; the protocol's matching layer compares the item's fingerprint against the registry and notifies the owner directly — no personal data changes hands until both parties opt in.
End-to-End Flow
Registration: Owner mints an SBT for the item, attaching photos and identifying data encrypted and pinned to decentralized storage; a physical NFC/QR tag can be affixed to the item.
Loss Event: Owner marks the item “Lost” via wallet or app, optionally posting a reward in stablecoin or protocol tokens, held in escrow by a smart contract.
Discovery: Finder scans the item's tag or submits a “Found Item” report with photos; the app runs on-device perceptual hashing and queries the registry for candidate matches.
Match & Notify: Smart contract flags a probable match; both parties receive a notification with a proposed secure handoff (public meeting point, partner venue locker, or courier).
Verification: Owner confirms identifying details only they would know (challenge-response) before any location or contact data is revealed to the finder.
Reward & Settlement: Upon confirmed handoff (QR check-in at handoff), escrow releases the reward automatically to the finder's wallet; the recovery event is written immutably to the item's on-chain history.
Dispute Path (if needed): If two parties claim the same item, a decentralized arbiter panel (staked jurors) reviews the encrypted evidence trail and resolves via majority vote, slashing stake from fraudulent claimants.

10 Extra Points Feature — Lead Rewards
In the gamified/hackathon context of this concept, users are rewarded 10 extra points whenever their reported lead directly results in a verified recovery match — reinforcing the incentive loop between reporting activity and successful returns.
5  Key Features
5.1 Digital Ownership Passport (Soulbound Token)
A non-transferable token bound to the owner's wallet representing verified ownership of a physical item, including encrypted metadata hash, registration date, and full custody history.
5.2 Decentralized Storage Vault
Item photos, receipts, and identifying documents are encrypted client-side and stored on IPFS/Filecoin/Arweave; only content hashes live on-chain, keeping the chain lightweight while metadata stays tamper-evident and always retrievable.
5.3 Smart Contract Escrow & Rewards
Bounties are locked in escrow at the moment an item is reported lost and released automatically upon verified handoff — removing the need to trust that a reward will actually be paid.
5.4 Fingerprint Matching Engine
Combines physical tags (NFC/QR) with perceptual image hashing and structured attributes (brand, serial number, color) to surface probable matches between “lost” and “found” reports without exposing raw personal data.
5.5 Privacy-Preserving Handoff
Zero-knowledge challenge-response lets an owner prove they know unique, non-public details about an item before any contact information or meeting location is disclosed to the finder.
5.6 Decentralized Dispute Resolution
A staked-juror arbitration layer (similar to Kleros-style courts) reviews contested claims using the immutable evidence trail, with economic penalties for bad-faith claims.
5.7 Venue & Partner API
Airports, transit systems, hotels, and universities can plug into the registry via API to auto-check items surrendered at their physical lost-and-found desks against the decentralized registry.
5.8 Reputation & Points Layer
Finders and honest reporters accrue an on-chain reputation score and bonus points (e.g., +10 points per verified lead-to-recovery) that unlock lower fees, priority support, and community recognition.
6  Technical Architecture
System Layers
Layer
Technology
Purpose
Identity
Web3 wallets (MetaMask, WalletConnect) + DIDs
Self-sovereign identity for owners, finders, and venues
Ownership Ledger
EVM-compatible L2 (e.g., Polygon/Optimism-style rollup)
Low-fee minting of ownership tokens, escrow, status updates
Storage
IPFS / Filecoin / Arweave
Encrypted item metadata, images, and documents
Matching
Off-chain indexer + perceptual hashing service
Compares lost/found reports, surfaces candidate matches
Privacy
Zero-knowledge proofs (zk-SNARKs)
Ownership challenge-response without revealing raw data
Arbitration
Staked juror smart contracts
Decentralized dispute resolution for contested claims
Client
Mobile app (iOS/Android) + PWA + partner API/SDK
Registration, reporting, notifications, venue integrations
Data Flow Principle
On-chain: only hashes, status flags, escrow logic, and reputation scores. Off-chain: encrypted personal data and images, retrievable only by the token holder or an authorized counterparty after mutual verification. This keeps the chain light, keeps costs low, and keeps sensitive data legally compliant with data-protection regimes (e.g., GDPR right-to-erasure applies to off-chain storage, not the immutable hash).
7  User Stories
As a...
I want to...
So that...
Owner
register my luggage before a flight
I have instant proof of ownership if it's lost or misdirected
Owner
post a bounty when my phone goes missing
finders are motivated to report it instead of keeping it
Finder
scan a QR tag on a found wallet
I can report it in seconds without giving up personal contact info upfront
Finder
receive my reward automatically
I don't have to trust a stranger or a company to pay me
Venue Partner
check surrendered items against the registry via API
I can return items faster and reduce my desk's manual backlog
Juror/Verifier
review anonymized evidence for a disputed claim
I can vote fairly and earn a share of arbitration fees
8  Success Metrics
Metric
Target (Year 1)
Items registered on protocol
500,000+
Lost-to-recovered conversion rate
≥ 35% (vs. ~15-20% industry baseline for centralized lost & found)
Median time-to-recovery
< 48 hours for tagged items in partner venues
Fraudulent claim rate
< 1% of resolved cases
Partner venues onboarded (API)
50+ airports/transit hubs/universities
Finder reward payout reliability
100% automated settlement, zero manual intervention
9  Roadmap
Phase 1 — MVP (0–3 months)
Wallet-based registration + SBT minting on testnet
Decentralized storage integration for item metadata
Basic lost/found reporting flow with manual match confirmation
Phase 2 — Matching & Escrow (3–6 months)
Automated fingerprint matching engine
Smart contract escrow and reward automation
Mobile app beta (iOS/Android) + NFC/QR tag pilot
Phase 3 — Trust Layer (6–9 months)
Zero-knowledge challenge-response verification
Decentralized arbitration / staked juror system
Reputation and points system launch
Phase 4 — Scale & Partnerships (9–12 months)
Venue/partner API and SDK general availability
Mainnet launch on low-fee L2
Insurance-industry data integrations
10  Risks & Mitigations
Risk
Mitigation
Low Web3 adoption among mainstream users
Offer custodial/social-login wallets so non-crypto users can participate without seed phrases
Gas fees deter registration of low-value items
Deploy on a low-fee L2; batch/gasless meta-transactions for registration
False matches from image hashing
Combine multiple signals (tag ID, serial number, structured attributes) before surfacing a match
Privacy concerns over item photos/data
Client-side encryption, zero-knowledge verification, no raw data on-chain
Fraudulent ownership or finder claims
Staked arbitration with slashing; challenge-response proof of unique item knowledge
Regulatory uncertainty (data protection, custody of funds)
Off-chain personal data with erasure capability; licensed escrow/compliance review per region
11  Open Questions
Should the reward token be a stablecoin, a native protocol token, or both — and how should venue partners fund bounty pools?
What is the minimal viable KYC threshold for higher-value item claims to stay compliant without breaking the trustless promise?
Should physical NFC/QR tags be protocol-issued hardware or an open standard any manufacturer can implement?
How do we handle cross-border recovery where custody, tax, or customs rules differ?

Summary
The Blockchain Lost & Found System reframes lost-item recovery as a trust problem solvable with cryptography rather than institutions. By combining Web3 wallets, decentralized storage, smart-contract escrow, and privacy-preserving verification, it creates a self-sustaining, fraud-resistant, and globally interoperable recovery network — with rewarded, verifiable leads (including the +10 points bonus) driving a flywheel of honest participation.