# TrustTag Protocol

A decentralized, trustless lost-and-found protocol using Web3 wallets, Soulbound Tokens
(SBT) for proof-of-custody, and decentralized storage for item metadata.

---

## Overview

TrustTag replaces institutional trust with cryptographic trust. Registered physical items
are minted as non-transferable Proof-of-Custody Tokens (PoCT / SBT) bound to the
registrant's wallet. Item details are encrypted client-side and stored on IPFS/Filecoin;
only a Keccak-256 integrity hash is stored on-chain. Smart-contract escrow automates
bounty payouts to finders; staked arbiters resolve disputes.

---

## Monorepo Structure

```
trusttag-protocol/
├── apps/
│   └── web/                    # Next.js 15 · TypeScript · Tailwind CSS
│       └── app/                # Owner / Finder / Arbiter dashboards
├── packages/
│   ├── contracts/              # Hardhat · Solidity 0.8.24
│   │   ├── contracts/
│   │   │   ├── PoCT.sol        # Proof-of-Custody Token (primary SBT)
│   │   │   ├── LostAndFoundSBT.sol
│   │   │   └── LostAndFoundEscrow.sol
│   │   ├── scripts/
│   │   │   └── deploy.ts       # Full deploy script (imports networks.config.ts)
│   │   ├── networks.config.ts  # ◄── SINGLE SOURCE OF TRUTH for all network constants
│   │   └── hardhat.config.ts   # Imports from networks.config.ts
│   └── shared/                 # Shared TypeScript types
└── .env.example                # Mirrored values from networks.config.ts
```

---

## Target Network — Base Sepolia

All network constants are defined **once** in
[`packages/contracts/networks.config.ts`](./packages/contracts/networks.config.ts).
No other file hardcodes chain IDs, RPC URLs, or explorer URLs.

| Field        | Value |
|---|---|
| **Network**  | Base Sepolia |
| **Chain ID** | `84532` |
| **RPC URL**  | `https://sepolia.base.org` |
| **Explorer** | <https://sepolia.basescan.org> |
| **Faucet**   | <https://portal.cdp.coinbase.com/products/faucet> |

To target a different network: edit `DEFAULT_NETWORK_KEY` in `networks.config.ts` — no
other file needs to change.

---

## Getting Started

### 1 · Install

```bash
npm install
```

### 2 · Configure environment

```bash
cp .env.example .env
# Fill in PRIVATE_KEY (deployer) and BASESCAN_API_KEY
```

### 3 · Compile contracts

```bash
npm run contracts:compile
```

### 4 · Run tests

```bash
npm run contracts:test
```

### 5 · Deploy

```bash
# Local Hardhat node (no env vars needed)
npm run contracts:deploy:local

# Base Sepolia (requires PRIVATE_KEY in .env with funded test ETH)
# Get test ETH at: https://portal.cdp.coinbase.com/products/faucet
npm run contracts:deploy:basesepolia
```

The deploy script prints a ready-to-paste `.env` block with all deployed addresses.
Copy those values back into `.env` so the web app picks them up.

### 6 · Run the web app

```bash
npm run web:dev
```

Open <http://localhost:3000>.

### 7 · Build shared types

```bash
npm run shared:build
```

---

## Contract Verification (Base Sepolia)

After deployment, verify source on Basescan:

```bash
cd packages/contracts
npx hardhat verify --network baseSepolia <DEPLOYED_ADDRESS>
```

Requires `BASESCAN_API_KEY` in `.env`. Get a free key at <https://basescan.org/myapikey>.
