# Apex CEX: High-Frequency Central Limit Order Book (CLOB)

Apex Exchange is a full-stack, decoupled, event-driven cryptocurrency spot trading platform designed to facilitate microsecond matching engine execution speeds ($< 15\mu\text{s}$), live charting synchronization, and crash-resistant persistent processing.By separating **Pre-Trade Risk Checking, Execution (Matching), and Post-Trade Settlement (Clearing)**, the architecture operates at maximum efficiency without single-threaded bottlenecks or relational database blocking. All math on the platform is scaled by **$10^8$ (Satoshi multiplier)** and processed as BigInts, bypassing the notorious floating-point rounding errors native to V8 engines and preventing financial rounding hazards.

## Installation 
Follow these steps to spin up the local development ecosystem:
###### 1. Clone the repository
```markdown
git clone https://github.com/punit363/apex-cex.git
cd apex-cex
```

###### 2. Install dependencies 
```markdown
npm install
```

###### 3. Spin up infrastructure containers
```markdown
docker compose up -d
```
or 
```markdown
docker run -d --name apex-redis -p 6379:6379 redis:alpine
docker run -d --name apex-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=apex_cex -p 5432:5432 postgres:alpine
```

###### 4. Migrate database schemas and seed test accounts
```markdown
npm run generate:db
npm run seed:db
npm run studio:db
```

###### 5. Start the Exchange
```markdown
npm run dev
```

###### 6. Setting Up an Account
hit http://localhost:3000/ and register a trading account \
add balance to crypto of your choice

Thats it. All set to go. You can start trading.

> Tip : To see live trading you can run the market maker bot

#### Market Maker Bot

To run the market maker bot set values for **MM_QUOTE_ASSET** and
**MM_BASE_ASSET** \
In the terminal run the following cmds \
```markdown
cd marketmaker
npm run dev
```
<br>

## Architecture & System Design

Apex CEX is designed as an **event-driven, decoupled, high-throughput Central Limit Order Book (CLOB)**. To achieve microsecond-level matching speeds and handle concurrent order floods without database lock contention, the platform strictly separates Pre-Trade Risk Enforcement, In-Memory Order Matching, and Post-Trade Asynchronous Settlement.

<img width="3228" height="2011" alt="cex_architecture" src="https://github.com/user-attachments/assets/bd92c34c-7893-4d52-bd00-564ce99a982a" />

### The 4-Stage Decoupled Execution Pipeline

To eliminate relational database bottlenecks on the critical execution path, order processing is divided into four completely isolated stages:

#### 1. Stage 1: API Gateway & Edge Guard (backend & frontend/middleware.ts)

- **Role :** Ingress validation, route protection, and token authentication.

- **Mechanism :**
  - **Direct API Requests :** Transmitted directly from the client browser to Express with withCredentials: true.

  - **Edge Middleware Header Bridge :** Next.js Edge Middleware intercepts page transitions (/trade, /balance), performs server-to-server auth validation with Express, and forwards Set-Cookie response headers back to the browser cookie jar seamlessly.

- **Latency Overhead :** $O(1)$ in-memory JWT signature verification without database queries.

#### 2. Stage 2: Pre-Trade Risk Gate (Redis Ledger)

- **Role :** Fund verification and locking before order submission to the matching core.

- **Mechanism :** Executes atomic Redis Lua scripts to verify available balances and shift funds from available to locked in under $1\text{ ms}$.

- **Rule :** An order is only passed downstream to the matching engine if its balance reservation succeeds. If the user has insufficient funds, the gateway rejects the order instantly at this boundary.

#### 3. Stage 3: Single-Threaded Matching Core (engine)

- **Role :** High-speed limit/market order matching.

- **Mechanism :**

  - Runs 100% in RAM with zero file I/O, network blocking, or database queries during matches.

  - Operates on a single-threaded execution loop per market pair to eliminate CPU lock contention and race conditions.

  - Maintains localized bids/asks order books and snapshots state to snapshot.json every few seconds.

- **Satoshi Math Engine :** Replaces native JavaScript floating-point arithmetic with scaled 64-bit BigInt/Integer math (multiplied by $10^8$ Satoshi multiplier), guaranteeing zero IEEE-754 rounding errors.

#### 4. Stage 4: Post-Trade Clearing & Settlement (db / Worker)

- **Role :** Asynchronous persistence and database synchronization.

- **Mechanism :** Consumes fill stream events published by the matching engine and executes asynchronous database writes to PostgreSQL via Prisma ORM.

- **Entities Updated :** Order statuses, trade records, candlestick (KLine) aggregates, user transaction logs, and global balance ledgers.

<br>

## Workspace & Component Breakdown

This monorepo is organized using **NPM Workspaces :**
| Workspace | Technology Stack | Responsibilities |
|---------|-------------|-------------|
| **frontend** | Next.js 14 (App Router), Tailwind CSS, Lightweight Charts, Axios | Dynamic trading dashboard, real-time depth visualizations, candlestick charts, and Edge Middleware session bridge. |
| **api** | Express.js, Node.js, cookie-parser, JSONWebTokens | Public REST API Gateway, authentication controllers (login, register, refresh), and order input normalization. |
| **engine** | Node.js, TypeScript, ioredis, Custom CLOB Data Structure | In-memory matching core, Satoshi math execution, depth caching, and Redis stream publisher. |
| **db** | PostgreSQL, Prisma ORM | Relational data layer storing users, order history, trade fills, candles, and transaction ledgers. |
| **sockets** | ws (WebSockets) | WebSocket Broadcast Engine streaming live trade fills, depth diffs, and tickers to UI clients. |
| **marketmaker** | Node.js, Axios, Cookie Session Handler | Automated liquidity provider bot submitting high-frequency bid/ask limit orders. |
