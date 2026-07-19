# TrustTag Protocol — Production Deployment Guide

This guide covers deploying all four services of the TrustTag Protocol monorepo to production. The architecture is split across different hosting targets based on each service's runtime requirements.

---

## Architecture Overview

```
┌────────────────────────────────┐
│  apps/web (Next.js 15)         │  → Vercel / Netlify / Cloudflare Pages
│  Static + SSR frontend         │
└──────────────┬─────────────────┘
               │ NEXT_PUBLIC_CORTEX_URL
               ▼
┌────────────────────────────────┐
│  apps/cortex (Express)         │  → Railway / Render / Fly.io / AWS ECS
│  pHash matching engine         │
│  Needs: Postgres, sharp (C++)  │
└──────────────┬─────────────────┘
               │ DATABASE_URL
               ▼
┌────────────────────────────────┐
│  PostgreSQL 16                 │  → Neon / Supabase / Railway / RDS
│  lost_items, found_reports,    │
│  match_candidates              │
└────────────────────────────────┘

┌────────────────────────────────┐
│  apps/connect-api (Express)    │  → Railway / Render (same host as cortex)
│  Partner bulk-check + webhooks │
└────────────────────────────────┘

┌────────────────────────────────┐
│  apps/indexer (Node.js)        │  → Railway / Render / long-lived VM
│  On-chain event listener       │
│  Needs: persistent process     │
└────────────────────────────────┘

┌────────────────────────────────┐
│  packages/contracts (Solidity) │  → One-time deploy via Hardhat CLI
│  PoCT, RewardEscrow, etc.     │  → Target: Base Sepolia (testnet)
└────────────────────────────────┘
```

---

## Pre-deployment Checklist

Before deploying anything, complete these steps:

- [ ] **Deploy smart contracts** to Base Sepolia (or your chosen L2 testnet)
- [ ] **Verify contracts** on Basescan
- [ ] **Provision a Postgres database** for Cortex
- [ ] **Obtain RPC endpoints** (Alchemy or Infura) — public RPCs have strict rate limits
- [ ] **Set up a WalletConnect Project ID** at [cloud.walletconnect.com](https://cloud.walletconnect.com)
- [ ] **Register your production domain** in the WalletConnect dashboard to fix CORS

### Deploy & Verify Smart Contracts

```bash
# 1. Set your deployer private key and Basescan API key
export PRIVATE_KEY="0xYourPrivateKeyHere"
export BASESCAN_API_KEY="YourBasescanApiKey"

# 2. Deploy to Base Sepolia
npm run contracts:deploy:basesepolia

# 3. Verify each contract (replace addresses with actual deployed ones)
cd packages/contracts
npx hardhat verify --network baseSepolia 0xDeployedPoCTAddress
npx hardhat verify --network baseSepolia 0xDeployedRewardEscrowAddress
npx hardhat verify --network baseSepolia 0xDeployedHandoffVerifierAddress
```

Save the deployed addresses — you'll need them for environment variables below.

---

## Option 1: Vercel (Recommended for `apps/web`)

Vercel is the best option for the Next.js frontend. It handles SSR, edge caching, preview deploys, and custom domains out of the box.

### Step 1 — Connect your repository

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub/GitLab repository
3. Set the following build configuration:

| Setting | Value |
|---------|-------|
| **Framework Preset** | Next.js |
| **Root Directory** | `apps/web` |
| **Build Command** | `cd ../.. && npm install --include=dev && npm run shared:build && cd apps/web && npm run build` |
| **Output Directory** | `.next` |
| **Install Command** | `npm install` |

> [!IMPORTANT]
> The build command first installs the monorepo root (to link workspaces), builds the `shared` package (required dependency), then builds the web app.

### Step 2 — Set environment variables

In the Vercel dashboard → **Settings → Environment Variables**, add:

```env
# ── Network ──────────────────────────────────────────────
NEXT_PUBLIC_NETWORK_NAME="Base Sepolia"
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_RPC_URL=https://base-sepolia.g.alchemy.com/v2/ochESiSjTM1f8za7ncSou
NEXT_PUBLIC_EXPLORER_URL=https://sepolia.basescan.org

# ── Deployed Contract Addresses ──────────────────────────
NEXT_PUBLIC_LOST_FOUND_SBT_ADDRESS=0xYourDeployedAddress
NEXT_PUBLIC_LOST_FOUND_ESCROW_ADDRESS=0xYourDeployedAddress
NEXT_PUBLIC_POCT_ADDRESS=0xYourDeployedAddress

# ── Services ─────────────────────────────────────────────
NEXT_PUBLIC_CORTEX_URL=https://cortex.yourdomain.com
NEXT_PUBLIC_IPFS_GATEWAY=https://ipfs.io/ipfs/
```

### Step 3 — Deploy

```bash
# Via CLI (optional — Vercel auto-deploys on push)
npx vercel --prod
```

### Step 4 — Custom domain

1. Vercel dashboard → **Settings → Domains**
2. Add your domain (e.g. `app.trusttag.xyz`)
3. Configure DNS: add the CNAME record Vercel provides
4. **Update WalletConnect** dashboard to whitelist this domain

---

## Option 2: Netlify (Alternative for `apps/web`)

### Build configuration

| Setting | Value |
|---------|-------|
| **Base directory** | `(root)` |
| **Build command** | `npm install --include=dev && npm run shared:build && cd apps/web && npm run build` |
| **Publish directory** | `apps/web/.next` |

### Netlify-specific setup

1. Install the Next.js runtime plugin:
   ```toml
   # netlify.toml (in repo root)
   [build]
     base = "."
     command = "npm install --include=dev && npm run shared:build && cd apps/web && npm run build"
     publish = "apps/web/.next"

   [[plugins]]
     package = "@netlify/plugin-nextjs"
   ```

2. Set environment variables in the Netlify dashboard (same as Vercel above).

> [!WARNING]
> Netlify's Next.js support can lag behind Vercel's. Test that SSR routes and API routes work correctly in preview deploys before going to production.

---

## Option 3: Cloudflare Pages (Alternative for `apps/web`)

1. Connect your repo at [dash.cloudflare.com](https://dash.cloudflare.com)
2. Build configuration:

| Setting | Value |
|---------|-------|
| **Framework preset** | Next.js |
| **Root directory** | `apps/web` |
| **Build command** | `cd ../.. && npm install --include=dev && npm run shared:build && cd apps/web && npx @cloudflare/next-on-pages` |
| **Output directory** | `.vercel/output/static` |

3. Set environment variables (same as Vercel).

> [!NOTE]
> Cloudflare Pages uses the `@cloudflare/next-on-pages` adapter. Some Next.js features (middleware, ISR) may behave differently. Test thoroughly.

---

## Deploying `apps/cortex` (Matching Engine)

Cortex is a stateful Express service with native dependencies (`sharp` for image processing) and needs a persistent Postgres connection. It **cannot** run on Vercel/Netlify serverless.

### Option A: Railway (Recommended)

Railway supports Docker, managed Postgres, and persistent processes — ideal for Cortex.

#### 1. Provision Postgres

```bash
# In the Railway dashboard, add a PostgreSQL plugin
# Copy the DATABASE_URL connection string
```

Or use **Neon** (serverless Postgres):
1. Create a project at [neon.tech](https://neon.tech)
2. Copy the connection string

#### 2. Deploy Cortex

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and link project
railway login
railway link

# Link local service context to cortex
railway service link cortex

# Note: Since cortex depends on shared monorepo packages (packages/cortex-matching),
# the build context must be the repository root. Configure these in the Railway dashboard:
# 1. Go to the 'cortex' service -> Settings -> Root Directory and set it to: /
# 2. Under Build -> Dockerfile Path, set it to: apps/cortex/Dockerfile

# Set environment variables
railway variables --set DATABASE_URL="postgresql://..."
railway variables --set PORT=3001
railway variables --set CORS_ORIGINS="https://app.trusttag.xyz"
railway variables --set PHASH_WEIGHT=0.6
railway variables --set ATTRIBUTE_WEIGHT=0.4
railway variables --set PHASH_HAMMING_THRESHOLD=10

# Deploy
railway up
```

Railway will use the repository root directory context to build using `apps/cortex/Dockerfile`.

#### 3. Run migrations

```bash
railway run npm run db:migrate --workspace=cortex
```

### Option B: Render

1. Go to [render.com](https://render.com) → **New Web Service**
2. Connect your repo
3. Configure:

| Setting | Value |
|---------|-------|
| **Root Directory** | `apps/cortex` |
| **Runtime** | Docker |
| **Dockerfile Path** | `./Dockerfile` |
| **Health Check Path** | `/health` |

4. Add a **Render PostgreSQL** database and link it via `DATABASE_URL`
5. Set other environment variables as listed above

### Option C: Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Launch from the cortex directory
cd apps/cortex
fly launch --name trusttag-cortex --dockerfile Dockerfile

# Create a Postgres cluster
fly postgres create --name trusttag-db
fly postgres attach --app trusttag-cortex trusttag-db

# Set secrets
fly secrets set \
  CORS_ORIGINS="https://app.trusttag.xyz" \
  PHASH_WEIGHT=0.6 \
  ATTRIBUTE_WEIGHT=0.4 \
  PHASH_HAMMING_THRESHOLD=10

# Deploy
fly deploy
```

### Option D: AWS (ECS + RDS)

For teams needing full infrastructure control:

1. **ECR**: Push the Docker image
   ```bash
   cd apps/cortex
   docker build -t trusttag-cortex .
   aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
   docker tag trusttag-cortex:latest <account>.dkr.ecr.<region>.amazonaws.com/trusttag-cortex:latest
   docker push <account>.dkr.ecr.<region>.amazonaws.com/trusttag-cortex:latest
   ```

2. **RDS**: Create a Postgres 16 instance (db.t3.micro for testnet)
3. **ECS**: Create a Fargate service using the pushed image
4. **ALB**: Create an Application Load Balancer with HTTPS
5. Set environment variables in the ECS task definition

---

## Deploying `apps/connect-api` (Partner API)

The connect-api is a lightweight Express service. Deploy it alongside Cortex on the same platform.

### Railway / Render / Fly.io

Same steps as Cortex:
- **Link local context**: Run `railway service link connect-api`
- **Root Directory in dashboard**: Set to `/` (since it also depends on `packages/cortex-matching`)
- **No Dockerfile** exists yet — add a Dockerfile (similar to Cortex's monorepo Dockerfile but copying `apps/connect-api` instead) or set up a custom start command using the Node.js buildpack.
- Set `CONNECT_API_KEY` as a secret variable
- Set `PORT` (e.g. `3002`)

```env
PORT=3002
CONNECT_API_KEY=your-secure-api-key-here
```

---

## Deploying `apps/indexer` (On-chain Event Listener)

The indexer is a **long-running process** that watches for on-chain events. It must stay alive continuously.

> [!IMPORTANT]
> The indexer has `TODO(prod)` stubs for real RPC calls. Before deploying, replace `getBlockHash()` and `getCurrentBlock()` with actual viem public client calls, and wire `listenPoCTStatusChanged()` to a real WebSocket subscription.

### Recommended: Railway Worker

```bash
# Link local context to the indexer service
railway service link indexer

# Note: In the Railway dashboard:
# 1. Set the Root Directory to /
# 2. Under settings, configure the build command: npm run indexer:build (or configure a Dockerfile)
# 3. Configure the start command: node apps/indexer/dist/index.js

# Set environment variables
railway variables --set RPC_URL="wss://base-sepolia.g.alchemy.com/v2/YOUR_KEY"
railway variables --set CONFIRMATIONS_REQUIRED=5

# Deploy
railway up
```

### Alternative: A simple VPS (DigitalOcean, Hetzner)

```bash
# On the server
git clone <repo>
cd apps/indexer
npm install
npm run build
# Use pm2 for process management
pm2 start dist/index.js --name trusttag-indexer
pm2 save
pm2 startup
```

---

## Environment Variables — Complete Reference

### `apps/web` (Next.js)

| Variable | Required | Example |
|----------|----------|---------|
| `NEXT_PUBLIC_NETWORK_NAME` | ✅ | `Base Sepolia` |
| `NEXT_PUBLIC_CHAIN_ID` | ✅ | `84532` |
| `NEXT_PUBLIC_RPC_URL` | ✅ | `https://base-sepolia.g.alchemy.com/v2/KEY` |
| `NEXT_PUBLIC_EXPLORER_URL` | ✅ | `https://sepolia.basescan.org` |
| `NEXT_PUBLIC_POCT_ADDRESS` | ✅ | `0x...` |
| `NEXT_PUBLIC_LOST_FOUND_SBT_ADDRESS` | ✅ | `0x...` |
| `NEXT_PUBLIC_LOST_FOUND_ESCROW_ADDRESS` | ✅ | `0x...` |
| `NEXT_PUBLIC_CORTEX_URL` | ✅ | `https://cortex.trusttag.xyz` |
| `NEXT_PUBLIC_IPFS_GATEWAY` | ✅ | `https://ipfs.io/ipfs/` |

### `apps/cortex` (Express)

| Variable | Required | Example |
|----------|----------|---------|
| `PORT` | ✅ | `3001` |
| `DATABASE_URL` | ✅ | `postgresql://user:pass@host:5432/db` |
| `CORS_ORIGINS` | ✅ | `https://app.trusttag.xyz` |
| `PHASH_WEIGHT` | ○ | `0.6` |
| `ATTRIBUTE_WEIGHT` | ○ | `0.4` |
| `PHASH_HAMMING_THRESHOLD` | ○ | `10` |

### `apps/connect-api` (Express)

| Variable | Required | Example |
|----------|----------|---------|
| `PORT` | ✅ | `3002` |
| `CONNECT_API_KEY` | ✅ | `sk_live_...` |

### `apps/indexer` (Node.js)

| Variable | Required | Example |
|----------|----------|---------|
| `RPC_URL` | ✅ | `wss://base-sepolia.g.alchemy.com/v2/KEY` |
| `CONFIRMATIONS_REQUIRED` | ○ | `5` |

---

## Production Security Checklist

- [ ] **Never expose `PRIVATE_KEY`** in any frontend env variable — it's only used for CLI contract deploys
- [ ] **Use a dedicated RPC endpoint** (Alchemy/Infura) — public RPCs throttle aggressively
- [ ] **Set `CORS_ORIGINS`** on Cortex to your exact production domain only
- [ ] **Rotate `CONNECT_API_KEY`** regularly and store it in the platform's secrets manager
- [ ] **Enable Postgres SSL** — append `?sslmode=require` to `DATABASE_URL`
- [ ] **Whitelist your domain** in the WalletConnect Cloud dashboard
- [ ] **Verify contracts on Basescan** so users can audit the code before interacting
- [ ] **Set up rate limiting** on Cortex's `/match` endpoint (e.g. `express-rate-limit`) to prevent abuse
- [ ] **Enable HTTPS** everywhere — all platforms above do this by default

---

## Cost Estimates (Testnet Phase)

| Service | Platform | Estimated Cost |
|---------|----------|----------------|
| `apps/web` | Vercel (Hobby) | **Free** |
| `apps/cortex` | Railway (Starter) | ~$5/month |
| PostgreSQL | Neon (Free tier) | **Free** (0.5 GB) |
| `apps/indexer` | Railway (Worker) | ~$5/month |
| RPC (Alchemy) | Free tier | **Free** (300M CU/month) |
| **Total** | | **~$10/month** |

---

## CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: CI / CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci

      # Build shared package (dependency for other workspaces)
      - run: npm run shared:build

      # Smart contract tests + gas checks
      - run: npm run contracts:test

      # Cortex unit tests
      - run: npm run cortex:test

      # Web app build check
      - run: npm run web:build

  deploy-web:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## Quick Start — Minimal Production Deploy

If you want the fastest path to a live deployment:

1. **Contracts**: Deploy from CLI → `npm run contracts:deploy:basesepolia`
2. **Database**: Create a free Neon Postgres → copy `DATABASE_URL`
3. **Cortex**: Push to Railway with Docker → set env vars → `railway up`
4. **Web**: Connect repo to Vercel → set env vars → auto-deploys on push
5. **Done** — visit your Vercel URL and connect a wallet
