# SCALE LXP Web App

React + TypeScript + Vite frontend for student and instructor dashboards.

## Local development

From the repository root:

```bash
cp apps/web/.env.example apps/web/.env.local
# Add VITE_CLERK_PUBLISHABLE_KEY (Clerk test key for local dev)

npm run install:web
npm run dev          # API + web together
# or: npm run dev:web   # web only (start API separately with npm run dev:api)
```

The dev server runs at [http://localhost:5173](http://localhost:5173). `npm run dev` also starts the API at `http://localhost:1337`.

## Build

```bash
npm run build:web
```

Output is written to `apps/web/dist/`.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_HOST` | Yes | Backend API base URL (e.g. `http://localhost:1337` locally, `https://api.scalelxp.com` in production) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key for the environment |
| `VITE_CLERK_JWT_TEMPLATE` | No | Clerk JWT template name if the API expects one |

## Deployment (DigitalOcean App Platform)

This app is deployed as a **static site** component:

- **Source directory:** `apps/web`
- **Build command:** `npm ci && npm run build`
- **Output directory:** `dist`
- **Build-time env:** `VITE_API_HOST`, `VITE_CLERK_PUBLISHABLE_KEY` (set as secrets in App Platform)

See [`.do/app.yaml`](../../.do/app.yaml) for the static site spec. Merge it into your full App Platform spec if API and workers are configured separately.

Production URL: [https://app.scalelxp.com](https://app.scalelxp.com)
