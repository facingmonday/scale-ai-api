# ScaleLXP DigitalOcean environments

`.do/app-spec.mjs` is the source of truth for the two App Platform apps:

- `scalelxp-dev` follows `develop` and serves the `*-dev.scalelxp.com` domains.
- `scalelxp-prod` follows `main` and serves the canonical production domains.

Every paid service and worker uses one `apps-s-1vcpu-0.5gb` container: 512 MB RAM, one shared vCPU, and 50 GB included bandwidth at $5/month. The web component is a free static site. DigitalOcean requires Redis-compatible databases to use production database plans, so development and production each use the smallest one-node managed Valkey cluster to preserve queue isolation.

Deployment secrets are read from the ignored root `.env.development` file for development and `.env.production` for production. Local processes use `.env.local` (with a temporary `.env` fallback for existing checkouts). The renderer streams the resolved JSON directly to `doctl`; it does not persist a resolved app spec.

Bootstrap each environment from its committed template:

```sh
cp .env.example .env.local
cp .env.development.example .env.development
cp .env.production.example .env.production
cp apps/web/.env.example apps/web/.env.local
```

Do not copy hosted production credentials into either local or development files. The local web app uses `apps/web/.env.local`; DigitalOcean injects the hosted web values at build time.

Validate without making changes:

```sh
npm run do:validate:dev
npm run do:validate:prod
```

Create or update after validation:

```sh
npm run do:deploy:dev
npm run do:deploy:prod
```

Clerk values must be different between the two hosted environment files. Add Stripe live values to `.env.production` and Stripe test values to `.env.development` before enabling checkout or registering the corresponding webhook endpoints.

Legacy app specifications are retained in `legacy-snapshots/` with environment values redacted.
