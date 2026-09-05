# Mini Mystics prototype

A playable Next.js/TypeScript prototype for the first Mini Mystics loop: create a Supabase account, reveal a starter pack, build saved lineups, fight fixed AI opponents, earn rewards, activate boosts, buy packs, and grow a duplicate-aware collection.

## Current milestone

The playable local slice includes:

- Supabase email/password and Google account creation, login, session restoration, password recovery, and logout.
- A 10-card Starter Pack with one Handler, five Mystics, and four reward cards.
- Click-by-click pack reveals, `Reveal all`, immediate XP/Coin redemption, and boost inventory.
- Individual owned-card instances, duplicate counts, and duplicate sales.
- 3-, 5-, and 8-Mystic saved loadouts with up to three Handlers.
- Six fixed campaign opponents with level locks and rule-based AI.
- One-action turns, free actor selection, targeted Basic Attacks, one-die Specials, per-move cooldowns, KO/victory, structured logs, and match rewards.
- Match-count XP/Coin boosts, fixed Standard odds, and Standard Alpha pity.
- Custom named binders, profile statistics, and honest Coming Soon pages for Marketplace and Trading.

Supabase Authentication provides identity and sessions. Game progress renders immediately from browser storage and synchronizes to the PostgreSQL-backed authenticated APIs. The normalized PostgreSQL schema is in `prisma/schema.prisma`; sensitive economy and battle mutations should continue moving toward fully server-authoritative resolution.

## Setup

Requirements: Node.js 20+, npm, a Supabase project, and PostgreSQL 15+.

1. Install dependencies with `npm install`.
2. Import the supplied CSVs and card images with `npm run data:import`.
3. Copy `.env.example` to `.env.local` and add the Supabase project URL and publishable key.
4. In Supabase, enable **Authentication → Providers → Email** and configure Google if desired.
5. Set the production Site URL and allow the local and production callback URLs in Supabase Authentication.
6. Start the prototype with `npm run dev` and open the printed local URL.

Apply Prisma migrations before deploying server changes. Google sign-in requires the Google OAuth callback displayed by the Supabase provider settings.

Existing PostgreSQL player records are linked to Supabase identities by normalized email on the first authenticated request. The legacy Firebase UID column is retained temporarily for relationship compatibility and rollback. Existing Google users can sign in through Supabase with the same email; existing email/password users must either be imported into Supabase Auth or create/confirm a Supabase account with the same email before Firebase is retired.

## Cloudflare deployment

The committed `wrangler.jsonc` and `open-next.config.ts` configure the existing `minimystics` Worker, custom domain, and OpenNext cache bindings. In Cloudflare Workers Builds use:

- Build command: `npm run build:cloudflare`
- Deploy command: `npx opennextjs-cloudflare deploy`
- Version command: `npx opennextjs-cloudflare upload`
- Root directory: `/`

Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as Cloudflare build variables for both production and preview builds. Do not commit `.env.local` or `.dev.vars`.

## Verification

- `npm test` runs deterministic core-engine, boost, Handler-limit, and pity tests.
- `npm run build` runs the production Next.js compiler and TypeScript checks.
- `npm run data:import` validates and regenerates the catalog.

## Card data and assets

Gameplay values come only from the CSVs. Mystic artwork belongs under `Mystics/<order>/`; Handler artwork belongs under `Handlers/`. The importer matches normalized names and supports explicit aliases in `scripts/import-cards.ts`. It never reads gameplay values from images.

To add a Mystic, add its row to `mini_mystics.csv`, place its artwork in `public/cards/Mystics/<order>/`, then run `npm run data:import`. To add a Handler, add its row to `handlers.csv`, place its image in `public/cards/Handlers/`, and rerun the importer. Unsupported text is preserved in `rawText` and marked `needsReview`. See `DATA_IMPORT_REPORT.md` for the current review list and `ARTWORK_CHECKLIST.md` for requested non-card artwork.

## Packs and tuning

Pack definitions and prices live in `lib/game/packs.ts`; the Prisma `PackDefinition` model holds their database representation. Standard rarity weights are centralized in `STANDARD_RARITY_WEIGHTS`. Payment method is not part of rarity selection. Only a future pack definition explicitly marked as boosted should override weights.

Reward constants live in `lib/game/rewards.ts`. The function considers match size, result, opposing KOs, survivors, and surviving Power. The level curve is `xpForLevel` in the same module. Boost durations live in `lib/game/boosts.ts`.

## Cooldown timing

The engine stores `cooldown + 1` when a Special is attempted, regardless of success. Cooldowns tick at the start of that side's turn. Therefore CD 1 displays `1` on the player's next turn and reaches `0` at the following player turn. Cooldowns belong to individual move names; Basic Attack is always available.

## Architecture

- `lib/supabase.ts` — Supabase Authentication browser client and session token access.
- `lib/server/supabase-auth.ts` — verified Supabase JWT claims for authenticated APIs.
- `lib/game/engine.ts` — presentation-independent battle rules and shared dice abstraction.
- `lib/game/move-parser.ts` — isolated move parsing with review flags.
- `lib/game/packs.ts`, `boosts.ts`, `rewards.ts` — centralized economy/progression rules.
- `scripts/import-cards.ts` — validated CSV and asset importer.
- `components/` — responsive presentation and Supabase-aware local/cloud state adapter.
- `prisma/schema.prisma` — normalized PostgreSQL ownership, packs, matches, events, rewards, campaign, custom collections, and future market history.

For a production server-authoritative release, replace `components/game-provider.tsx` with authenticated route calls backed by Prisma transactions and idempotency keys. Never accept client-supplied rolls, damage, rewards, balances, ownership, or pack results.
