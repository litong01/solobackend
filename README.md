# SoloBackend — Digital Music Bundle Store

A single-container full-stack application for selling digital music bundles (PDF + MusicXML + JSON). Built with Next.js, serving both the web UI and API from one process.

## Architecture

```
┌─────────────────────────────────────────────┐
│          Next.js (single container)         │
│                                             │
│   Pages (SSR)          API Routes           │
│   ┌──────────┐    ┌──────────────────┐      │
│   │ /         │    │ /api/bundles     │──────┼──▶ PostgreSQL
│   │ /bundles/ │    │ /api/entitlements│      │
│   │ /library  │    │ /api/purchase    │──────┼──▶ Stripe
│   └──────────┘    │ /api/stripe      │      │
│        │          │ /api/bundles/dl   │──────┼──▶ Cloudflare R2
│        ▼          └──────────────────┘      │
│   Kinde Auth (browser-side PKCE)            │
└─────────────────────────────────────────────┘
```

### Key flows

**Authentication:** User clicks Sign in → browser redirects to Kinde (PKCE flow) → Kinde returns a JWT → browser stores it → sends it as `Authorization: Bearer <token>` on API calls → server verifies the JWT signature locally using Kinde's public JWKS keys. The server never talks to Kinde directly.

**Purchase:** User clicks Purchase → API route creates a Stripe Checkout session → user pays on Stripe's hosted page → Stripe calls `/api/stripe/webhook` → entitlement recorded in Postgres.

**Download:** User clicks Download → API route verifies JWT, checks entitlement → generates a 5-minute pre-signed R2 URL → returns URL to browser.

---

## Required External Services

This application depends on four external services. Below is exactly what information you need from each, how to obtain it, and where to provide it.

### Kinde (Authentication)

Kinde handles user login. The browser SDK manages the PKCE OAuth flow entirely on the client side. The server only verifies JWT signatures using Kinde's publicly available signing keys.

| Variable | What it is | How to obtain it |
|----------|-----------|-----------------|
| `NEXT_PUBLIC_KINDE_ISSUER_URL` | Your Kinde domain | Sign up at [kinde.com](https://kinde.com). Create an application. Your domain is shown at the top of the dashboard, e.g. `https://yourapp.kinde.com`. |
| `NEXT_PUBLIC_KINDE_CLIENT_ID` | Identifies your app to Kinde | In the Kinde dashboard, go to **Settings → Applications → [your app] → Details**. The Client ID is listed there. |

**Callback URL setup:** In your Kinde application settings, add your site URL to the **Allowed callback URLs** and **Allowed logout redirect URLs**:
- Local development: `http://localhost:3000`
- Production: `https://your-production-domain.com`

**No secret is needed.** The browser SDK uses the PKCE flow (public client). The server verifies tokens by checking their signature against Kinde's public JWKS keys (`<issuer_url>/.well-known/jwks.json`), which are fetched once and cached automatically.

### Stripe (Payments)

Stripe handles checkout and payment processing. Users are redirected to Stripe's hosted checkout page — no Stripe UI is embedded in the app.

| Variable | What it is | How to obtain it |
|----------|-----------|-----------------|
| `STRIPE_SECRET_KEY` | Server-side API key | Go to [stripe.com](https://stripe.com) → Dashboard → **Developers → API keys**. Copy the **Secret key**. Starts with `sk_test_` (test mode) or `sk_live_` (production). |
| `STRIPE_WEBHOOK_SECRET` | Verifies webhook authenticity | See below — differs for local vs. production. Starts with `whsec_`. |

**Getting the webhook secret — local development:**

```bash
# Install the Stripe CLI: https://stripe.com/docs/stripe-cli
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The CLI prints a signing secret like `whsec_...` — use that as `STRIPE_WEBHOOK_SECRET`.

**Getting the webhook secret — production:**

1. In the Stripe Dashboard, go to **Developers → Webhooks → Add endpoint**.
2. Set the URL to `https://your-production-domain.com/api/stripe/webhook`.
3. Under "Select events to listen to", choose **`checkout.session.completed`**.
4. After creating the endpoint, click into it and reveal the **Signing secret**.

Both values are server-only (never exposed to the browser).

### Cloudflare R2 (File Storage)

R2 stores the bundle files (PDFs, MusicXML, JSON) privately. The server generates short-lived signed URLs so users can download files without the bucket being public.

| Variable | What it is | How to obtain it |
|----------|-----------|-----------------|
| `CLOUDFLARE_R2_ACCOUNT_ID` | Your Cloudflare account identifier | Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com). Your Account ID is visible in the URL bar (`dash.cloudflare.com/<account_id>`) or on the R2 overview page. |
| `CLOUDFLARE_R2_ACCESS_KEY` | S3-compatible access key ID | In the Cloudflare Dashboard, go to **R2 → Manage R2 API Tokens → Create API Token**. Choose "Object Read & Write" permissions. After creating the token, the **Access Key ID** is displayed. |
| `CLOUDFLARE_R2_SECRET_KEY` | S3-compatible secret access key | Shown **once** on the same page when you create the API token. Copy it immediately. If you lose it, create a new token. |
| `CLOUDFLARE_R2_BUCKET` | The bucket name | Go to **R2 → Create Bucket**. Choose a name (e.g., `music-bundles`). Use that name here. |

All four values are server-only.

### PostgreSQL (Database)

| Variable | What it is | How to obtain it |
|----------|-----------|-----------------|
| `DATABASE_URL` | Postgres connection string | Format: `postgresql://user:password@host:5432/dbname`. For local development, create a database with `createdb solobackend` and use `postgresql://postgres:postgres@localhost:5432/solobackend`. For production, use the connection string from your hosting provider (Neon, Supabase, AWS RDS, etc.). |

---

## Environment Variable Summary

All variables at a glance:

```
# Kinde (public — used in the browser and for JWKS verification)
NEXT_PUBLIC_KINDE_ISSUER_URL=https://yourapp.kinde.com
NEXT_PUBLIC_KINDE_CLIENT_ID=your_client_id

# Stripe (server-only)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cloudflare R2 (server-only)
CLOUDFLARE_R2_ACCOUNT_ID=your_account_id
CLOUDFLARE_R2_ACCESS_KEY=your_access_key
CLOUDFLARE_R2_SECRET_KEY=your_secret_key
CLOUDFLARE_R2_BUCKET=music-bundles

# PostgreSQL
DATABASE_URL=postgresql://user:password@host:5432/solobackend
```

---

## Running the Container

### Build

```bash
docker build -t solobackend .
```

### Run

Pass all environment variables when starting the container:

```bash
docker run -d \
  --name solobackend \
  -p 3000:3000 \
  -e NEXT_PUBLIC_KINDE_ISSUER_URL="https://yourapp.kinde.com" \
  -e NEXT_PUBLIC_KINDE_CLIENT_ID="your_client_id" \
  -e STRIPE_SECRET_KEY="sk_live_..." \
  -e STRIPE_WEBHOOK_SECRET="whsec_..." \
  -e CLOUDFLARE_R2_ACCOUNT_ID="your_account_id" \
  -e CLOUDFLARE_R2_ACCESS_KEY="your_access_key" \
  -e CLOUDFLARE_R2_SECRET_KEY="your_secret_key" \
  -e CLOUDFLARE_R2_BUCKET="music-bundles" \
  -e DATABASE_URL="postgresql://user:pass@db-host:5432/solobackend" \
  solobackend
```

Or use an env file:

```bash
docker run -d --name solobackend -p 3000:3000 --env-file .env solobackend
```

The app serves on port 3000.

### Run migrations

Before first use, run the database migrations:

```bash
# From your host with DATABASE_URL set:
npm run migrate

# Or inside a running container:
docker exec solobackend node -e "require('./scripts/migrate')"
```

### Cloud deployment

The container runs on any Docker-compatible platform:

- **Google Cloud Run** — `gcloud run deploy solobackend --image gcr.io/PROJECT/solobackend`
- **AWS ECS / Fargate** — push to ECR, create task definition
- **Fly.io** — `fly launch`
- **Railway / Render** — connect repo, point to Dockerfile

Set all environment variables in your cloud provider's dashboard.

---

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL 15+

### Setup

```bash
cp .env.example .env.local    # fill in your credentials
npm install
createdb solobackend
npm run migrate
npm run dev                    # http://localhost:3000
```

For Stripe webhooks during local development:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

---

## Folder Structure

```
solobackend/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── bundles/route.ts              # GET  /api/bundles
│   │   │   ├── bundles/[id]/route.ts         # GET  /api/bundles/:id
│   │   │   ├── bundles/[id]/download/route.ts# GET  /api/bundles/:id/download
│   │   │   ├── entitlements/route.ts         # GET  /api/entitlements
│   │   │   ├── purchase/create-checkout-session/route.ts
│   │   │   ├── stripe/webhook/route.ts       # POST /api/stripe/webhook
│   │   │   └── health/route.ts               # GET  /api/health
│   │   ├── bundles/[id]/page.tsx
│   │   ├── library/page.tsx
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── AuthProvider.tsx                  # Kinde browser SDK provider
│   │   ├── Header.tsx
│   │   ├── BundleCard.tsx
│   │   ├── PurchaseButton.tsx
│   │   └── DownloadButton.tsx
│   ├── lib/
│   │   ├── api-client.ts                    # Browser-side fetch wrapper
│   │   ├── auth.ts                          # JWT verification via JWKS
│   │   ├── db.ts                            # Postgres pool
│   │   ├── r2.ts                            # Cloudflare R2 client
│   │   └── stripe.ts                        # Stripe client
│   ├── services/
│   │   ├── bundle.service.ts
│   │   ├── checkout.service.ts
│   │   ├── entitlement.service.ts
│   │   └── user.service.ts
│   └── types/
│       └── api.ts
├── migrations/
│   ├── 001_initial_schema.sql
│   └── 002_seed_bundles.sql
├── scripts/
│   └── migrate.ts
├── Dockerfile
├── .env.example
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
└── postcss.config.js
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check |
| GET | `/api/bundles` | No | List all bundles |
| GET | `/api/bundles/:id` | No | Bundle details + metadata |
| GET | `/api/entitlements` | Bearer | User's purchased bundles |
| POST | `/api/purchase/create-checkout-session` | Bearer | Create Stripe Checkout session |
| POST | `/api/stripe/webhook` | Stripe sig | Handle purchase confirmation |
| GET | `/api/bundles/:id/download` | Bearer | Get signed download URL |

## Database Schema

```sql
CREATE TABLE users (
    id          TEXT PRIMARY KEY,          -- Kinde user ID
    email       TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bundles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    price           NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    metadata_url    TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE entitlements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         TEXT NOT NULL REFERENCES users(id),
    bundle_id       UUID NOT NULL REFERENCES bundles(id),
    purchased_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, bundle_id)
);
```

## R2 File Layout

Each bundle has a folder in R2 with a `metadata.json` describing its files:

```
bundles/
  bach-cello-suite-1/
    metadata.json
    score.pdf
    score.musicxml
    analysis.json
```

Example `metadata.json`:

```json
{
  "files": [
    { "key": "bundles/bach-cello-suite-1/score.pdf", "filename": "Bach_Cello_Suite_1.pdf", "type": "pdf", "size_bytes": 245760 },
    { "key": "bundles/bach-cello-suite-1/score.musicxml", "filename": "Bach_Cello_Suite_1.musicxml", "type": "musicxml", "size_bytes": 102400 },
    { "key": "bundles/bach-cello-suite-1/analysis.json", "filename": "Bach_Cello_Suite_1_Analysis.json", "type": "json", "size_bytes": 51200 }
  ],
  "composer": "J.S. Bach",
  "genre": "Baroque",
  "difficulty": "Advanced"
}
```

## License

See [LICENSE](./LICENSE).
