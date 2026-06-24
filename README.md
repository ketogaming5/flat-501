# flat-101_Maani

Household food-expense splitting app. Expenses are split **only** among the people who actually participated — absent roommates are never charged.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Prisma · PostgreSQL · Decimal.js · bcrypt session auth

## Accounting rules (enforced in `src/lib/accounting.ts`, covered by tests in `src/lib/__tests__/accounting.test.ts`)

- Split only among selected participants, never absent users.
- If the payer is a participant, no self-debt entry is created for them.
- If the payer is not a participant, every participant owes the payer their share.
- All money math uses Decimal.js, never floating point. Per-head shares round down to 2dp; the **last participant in the list absorbs the rounding remainder** so debts always sum exactly to the original amount (this matters: a naive equal split on amounts not evenly divisible by participant count will lose or gain a cent unless one person explicitly absorbs it).
- Balances = expenses + settlements + admin adjustments, computed live, never cached.

## Local setup

```bash
# 1. Install deps (now includes pg + @prisma/adapter-pg for Prisma 7)
npm install

# 2. Copy env file and fill in your values
cp .env.example .env
# DATABASE_URL  → your Neon connection string (from Neon dashboard → Connection string)
#               format: postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
# SESSION_SECRET → run: openssl rand -base64 32  (or any long random string)

# 3. Generate Prisma client
npx prisma generate

# 4. Push schema to Neon (creates all tables)
npx prisma migrate dev --name init

# 5. Seed users and sample data
npm run seed

# 6. Start
npm run dev
```

Visit `http://localhost:3000`. Seed credentials:

| Username | Password   | Role        |
|----------|------------|-------------|
| bhalu    | adminBhalu | ADMIN       |
| sheena   | sheena123  | read-only   |
| peeru    | peeru123   | read-only   |
| ajbhau   | ajbhau123  | read-only   |

**Change these passwords immediately after first login** (Admin → Reset Pw) — they are public in this README.

## Running tests

```bash
npm test
```

This runs the accounting engine test suite against real execution (not just type-checking) — 9 tests covering the split rules, rounding, and combined expense+settlement+adjustment balance calculations.

## Docker (local, with bundled Postgres)

```bash
docker compose up --build
```

App on `http://localhost:3000`, Postgres on `localhost:5432`. First run still needs migrations:

```bash
docker compose exec app npx prisma migrate deploy
docker compose exec app npm run seed
```

## Deploying to Railway (PostgreSQL)

1. Create a new Railway project → **Add PostgreSQL**.
2. Copy the `DATABASE_URL` from the Postgres service's **Variables** tab.
3. You do not need to deploy the Next.js app itself to Railway unless you prefer that over Vercel — this guide assumes Railway hosts only the database.

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Set environment variables in Vercel project settings:
   - `DATABASE_URL` — the Railway Postgres connection string
   - `SESSION_SECRET` — output of `openssl rand -base64 32`
4. Build command: `npm run build` (already runs `prisma generate` first via the `build` script).
5. Deploy.
6. **Run the first migration against the production database** — Vercel does not run this automatically:
   ```bash
   DATABASE_URL="<your railway url>" npx prisma migrate deploy
   DATABASE_URL="<your railway url>" npm run seed
   ```
   Run this from your local machine or any environment with network access to the Railway DB.

## What this app intentionally does NOT include, and why

- **No distributed rate limiter.** Login attempt limiting (`src/lib/auth.ts`) is in-memory and per-instance — fine for a 4-person household, not a substitute for Redis-backed limiting if you ever expose this publicly.
- **No CSRF token middleware.** Session cookies are `httpOnly`, `sameSite: lax`, and `secure` in production, which is Next.js's standard mitigation for cookie-based auth without a separate CSRF token dance. Add explicit CSRF tokens if you add cross-origin form submission later.
- **No graph-minimized debt simplification** (e.g. collapsing A→B→C chains into a single A→C transfer). Balances stay traceable to the actual expense/settlement that created them, which matters more for a household than minimizing transfer count.

## Project structure

```
prisma/schema.prisma       Database models
prisma/seed.ts             Seed script
src/lib/accounting.ts      Core split/balance engine (pure functions, tested)
src/lib/ledger.ts          DB → accounting engine bridge
src/lib/auth.ts            bcrypt + session cookie auth
src/lib/audit.ts           Audit log writer
src/middleware.ts          Coarse route gate (session presence only)
src/app/api/*              REST API routes (all server-side authorized)
src/app/*/page.tsx         Server-rendered pages
src/components/*           Client form components + shared UI primitives
```
