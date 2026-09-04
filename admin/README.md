# Mini Mystics Admin

Private AdminJS service for moderation, live-ops configuration, economy inspection, seasons, challenges, cards, packs, and match support.

This is intentionally separate from the public Next.js/Cloudflare Worker. Run it on a private Node.js host with access to the same PostgreSQL database.

The service was initialized with `@adminjs/cli`, then extended with the Prisma adapter and Mini Mystics-specific resource policies and actions.

## Setup

1. Copy `.env.example` to `.env` and set a PostgreSQL `DATABASE_URL` and a long random `COOKIE_SECRET`.
2. Set the one-time `ADMIN_BOOTSTRAP_*` values.
3. Run `npm run setup`. This applies the checked-in migrations and creates or updates the first admin account.
4. Remove `ADMIN_BOOTSTRAP_PASSWORD` after the account is created.
5. Run `npm run dev` locally or `npm run build && npm start` in production, then visit `/admin` on the admin service.

The initial database migration is checked in under `prisma/migrations` at the repository root and is copied into this service during setup/build. Never replace `migrate deploy` with `db push` in production.

Never expose this service under the public game Worker. Protect the deployment with a private hostname, HTTPS, and an additional identity-aware access layer where available.

## Cloudflare Container

The repository includes a separate Cloudflare Container deployment in `wrangler.admin.jsonc` and `admin.Dockerfile`. It deploys as the `minimystics-admin` Worker and claims only `admin.minimystics.com`; it does not modify or replace the public `minimystics` Worker.

Set `DATABASE_URL` and `COOKIE_SECRET` as Worker Secrets on `minimystics-admin`. The Worker explicitly forwards those secrets into the container. The remaining runtime settings are non-secret values declared in `wrangler.admin.jsonc`.

Use a Supabase Session Pooler URL on port 5432 for Prisma and the long-running AdminJS container. Run `npm run admin:cloudflare:check` from the repository root to validate the Worker bundle without building the image, and `npm run admin:cloudflare:deploy` to deploy through Wrangler. Cloudflare Workers Builds can build the Dockerfile when local Docker is unavailable.

## Roles

- `SUPER_ADMIN`: all resources, staff accounts, and audit records.
- `GAME_ADMIN`: cards, packs, boosts, opponents, ranked configuration, seasons, challenges, economy inspection, and audited balance adjustments.
- `MODERATOR`: profiles, Handler names, friendships, avatar review, moderation records, and prohibited/reserved names.
- `SUPPORT`: read-only player, inventory, match, transaction, ranked-history, and account-history access.

`isAccessible` protects both AdminJS navigation actions and direct AdminJS API requests. Sensitive authentication fields are hidden, live match state is read-only, and bulk deletion is disabled.

## Safe workflows

- Avatar rejection/removal requires a reason and stamps the reviewer and review time.
- Forced Handler-name moderation stamps the responsible admin and time.
- Manual currency changes use **Adjust balance** on a Player Profile. The database transaction updates the balance and creates `CurrencyTransaction`, `AdminAdjustmentTransaction`, and `AdminAuditLog` records together.
- Card, pack, rank, and season art previews use `PUBLIC_GAME_URL` plus the existing stored asset path. No assets are copied into this service.

Pending private avatar previews require a storage-provider signed-URL endpoint. Until that exists, AdminJS only previews an approved `publicObjectKey`; this keeps unapproved uploads from becoming public.

## Deployment checklist

1. Create and review a Prisma migration from the shared root schema; do not use `db push` against production.
2. Set production secrets in the Node host (`DATABASE_URL`, `COOKIE_SECRET`) and ordinary configuration (`HOST`, `PORT`, `TRUST_PROXY`, `PUBLIC_GAME_URL`).
3. Bootstrap the first Super Admin, then immediately remove `ADMIN_BOOTSTRAP_PASSWORD` from the environment.
4. Put the service behind HTTPS and an identity-aware access proxy, restrict database network access, and keep `/healthz` available to the host health check.
5. Review `npm audit` before each release. The current AdminJS release still carries upstream transitive advisories; do not make this service publicly reachable without the additional access layer.
