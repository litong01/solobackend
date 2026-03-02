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

**Purchase:** User clicks Purchase → API route creates a Stripe Checkout session → user pays on Stripe's hosted page → Stripe calls `/api/stripe/webhook` → entitlement recorded in Postgres. **Free bundles (price $0):** No Stripe call; the API grants the entitlement directly and returns `free_claim: true`, so the platform is not charged. The user still clicks **Get for free** (Purchase button) to claim; they are not redirected to Stripe.

**Download:** User clicks Download → API route verifies JWT, checks entitlement → generates a 5-minute pre-signed R2 URL → returns URL to browser.

**Mobile app (Soloband) — bundle access URL:** Use the same download endpoint with the user’s access token. Call `GET /api/bundles/:id/download` with `Authorization: Bearer <access_token>`. The server verifies the token, checks access (purchased or created), and returns a time-limited presigned R2 URL. The app then uses that URL to fetch the bundle file from R2 (no auth on the URL). Optional: `?expires_in=3600` to request a longer-lived URL (60–3600 seconds; default 300). Response: `{ "data": { "download_url": "<presigned R2 URL>", "filename": "bundle.zip", "expires_in": 300 } }`.

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

Stripe handles checkout and payment processing for **paid** bundles. Users are redirected to Stripe's hosted checkout page — no Stripe UI is embedded in the app. **Free bundles** (price $0) never touch Stripe: the app grants the entitlement directly, so Stripe does not charge for those.

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
3. Under "Select events to listen to", choose **`checkout.session.completed`** and **`charge.refunded`**.
4. After creating the endpoint, click into it and reveal the **Signing secret**.

Both values are server-only (never exposed to the browser).

**Stripe Connect (bundle creator payouts)**

Bundle creators can receive money when users buy their bundles. The app uses **Stripe Connect** with **Express** accounts:

1. **Enable Connect** in the [Stripe Dashboard](https://dashboard.stripe.com/settings/connect): **Connect settings → enable Connect** and choose your branding.
2. **Creator onboarding:** Creators go to **My Bundles → Payouts** (or `/settings/payouts`) and click "Set up payouts with Stripe". They are redirected to Stripe’s hosted onboarding to create an Express connected account (bank details, identity, etc.).
3. **When a buyer purchases a bundle:** If the bundle has a creator who has completed Connect onboarding, the payment is created as a **destination charge**: the full amount is transferred to the creator’s connected account, and the **application fee** (platform fee) is sent back to your platform. If the creator has not set up Connect, the full payment goes to your platform account.
4. **Platform fee:** Set `STRIPE_APPLICATION_FEE_PERCENT` (e.g. `10` for 10%). Default is 10% if unset.
5. **Payout schedule:** By default, Stripe pays out connected accounts on a **daily** schedule. To pay creators **once per month** (e.g. last day of the month), use either:
   - **Stripe Dashboard:** Connect → select the connected account → **Settings → Payouts** → set **Payout schedule** to **Monthly** and choose the day (e.g. last day).
   - **Balance Settings API:** If your Stripe SDK supports it, call the [Balance Settings API](https://docs.stripe.com/api/balance-settings/update) for each connected account with `interval: "monthly"` and `monthly_payout_days: [31]` (31 = last day of month). The Node SDK may expose this as `stripe.balanceSettings.update(..., { stripeAccount })` in newer versions.

**Refunds (including Connect)**

When a purchase is refunded (via the app’s **POST /api/purchase/refund** or from the Stripe Dashboard), the app creates the refund with **`reverse_transfer: true`** and **`refund_application_fee: true`**. That way:

- The **customer** is refunded (from the platform balance).
- The **creator’s share** is taken back from their connected account (Stripe reverses the transfer).
- The **platform’s application fee** is refunded (your platform gives back its cut).

**Restocking fee:** Stripe does not refund the processing fee it kept on the original charge, so the platform would lose that amount on every refund. To avoid that, refunds issued via the app are **partial**: the customer receives **(charge amount − restocking fee)** and the platform keeps the restocking fee to cover the non-refunded Stripe fee. The restocking fee defaults to **2.9% + 30¢** (aligned with Stripe’s typical fee). Configure with:

- `STRIPE_RESTOCKING_FEE_PERCENT` (default `2.9`)
- `STRIPE_RESTOCKING_FEE_FIXED_CENTS` (default `30`)
- `STRIPE_RESTOCKING_FEE_MAX_PERCENT` (default `50`) — cap so customer gets at least (100 − this)% back on small refunds

**Small sales:** For small charges (e.g. $0.50), 30¢ + 2.9% can exceed the sale amount or leave almost nothing for the customer. The restocking fee is **capped** so it never exceeds a percentage of the charge; the customer always gets at least that share back. Set **`STRIPE_RESTOCKING_FEE_MAX_PERCENT`** (default `50`): the restocking fee is at most this % of the charge, so the customer gets at least **(100 − MAX_PERCENT)%** refunded. Example: for a 50¢ charge with default 50% cap, fee = min(31¢, 25¢) = 25¢, so the customer receives 25¢ back.

The refund API response includes `amount_refunded_to_customer` and `restocking_fee_cents` so the UI can show the net refund and the retained fee. Access to the bundle is revoked as soon as the refund is created.

Refunds triggered in the Dashboard are full refunds (no restocking fee); use the app’s refund endpoint if you want the restocking fee applied.

**Stripe test cards (test mode only)**

When testing checkout in Stripe's test/sandbox mode, use these test card numbers. Use **any future expiry** (e.g. `12/34`), **any 3-digit CVC** (e.g. `123`), and any billing ZIP.

| Result | Card number |
|--------|-------------|
| **Success — Visa** | `4242 4242 4242 4242` |
| **Success — Mastercard** | `5555 5555 5555 4444` |
| **Success — American Express** | `3782 822463 10005` |
| **Declined (generic)** | `4000 0000 0000 0002` |
| **Declined (insufficient funds)** | `4000 0000 0000 9995` |
| **Declined (expired card)** | `4000 0000 0000 0069` |

For a quick successful test, use **4242 4242 4242 4242** with any future expiry and any CVC. Never use test cards in live mode.

**Redirect back to your app after payment**

Stripe redirects the customer to the `success_url` you pass when creating the Checkout session (and to `cancel_url` if they cancel). That URL is built from `NEXT_PUBLIC_SITE_URL` in your env (default `http://localhost:3000`).

- **Use the same URL you use to open the app.** If you open the app at `http://localhost:3000`, keep `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. If you use a tunnel (e.g. ngrok) or another host/port, set `NEXT_PUBLIC_SITE_URL` to that base URL (e.g. `https://abc123.ngrok.io`) so Stripe redirects the browser back to a page that loads.
- **Rebuild/restart after changing env.** If you change `.env.local`, restart the app (e.g. `./start.sh down && ./start.sh up` or rebuild the image with `./start.sh build`).

If redirect still doesn’t happen, check the Stripe Dashboard → **Settings → Checkout** (or **Branding**) for any “Customer success page” or redirect override.

### Cloudflare R2 (File Storage)

R2 stores the bundle files (PDFs, MusicXML, JSON) privately. The server generates short-lived signed URLs so users can download files without the bucket being public.

| Variable | What it is | How to obtain it |
|----------|-----------|-----------------|
| `CLOUDFLARE_R2_ACCOUNT_ID` | Your Cloudflare account identifier | Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com). Your Account ID is visible in the URL bar (`dash.cloudflare.com/<account_id>`) or on the R2 overview page. |
| `CLOUDFLARE_R2_ACCESS_KEY` | S3-compatible access key ID | In the Cloudflare Dashboard, go to **R2 → Manage R2 API Tokens → Create API Token**. Choose "Object Read & Write" permissions. After creating the token, the **Access Key ID** is displayed. |
| `CLOUDFLARE_R2_SECRET_KEY` | S3-compatible secret access key | Shown **once** on the same page when you create the API token. Copy it immediately. If you lose it, create a new token. |
| `CLOUDFLARE_R2_BUCKET` | The bucket name | Go to **R2 → Create Bucket**. Use a single bucket for all bundles (e.g. `solobankdbooks`). User-created bundles are stored under keys `bundles/YYYYMM/{bundle_id}.zip`; seed bundles can use keys under `bundles/...`. |

If you see **AccessDenied** when creating a bundle (upload to R2), check:

1. **API token permissions** – The token must allow **Object Read & Write**. In Cloudflare: **R2 → Manage R2 API Tokens**. Edit or create a token and ensure it has **Object Read & Write** (not just Read). If it still fails, try **Admin Read & Write** for that token.
2. **Token scope** – When creating the token, choose **Apply to all buckets** (or ensure your bucket is in the “Apply to specific buckets” list). The bucket name is case-sensitive.
3. **Bucket name** – `CLOUDFLARE_R2_BUCKET` must match the bucket name exactly (e.g. `solobankdbooks`). The bucket must already exist in the same account.
4. **Credentials in the container** – The app runs with `--env-file .env.local`. Ensure `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY`, `CLOUDFLARE_R2_SECRET_KEY`, and `CLOUDFLARE_R2_BUCKET` are set in `.env.local` with no typos or extra spaces. After changing `.env.local`, restart the app: `./start.sh down && ./start.sh up`.

The app uses **path-style** requests for R2 (`forcePathStyle: true`), which R2’s S3 API often requires.

All four values are server-only.

**Downloads and seed bundles:** The seed data references metadata keys (e.g. `bundles/bach-cello-suite-1/metadata.json`). For **Download** to work, those keys (and the actual files they reference) must exist in your R2 bucket. If they don’t, the app still runs and shows bundles; only the Download action will show “Download is not available for this bundle yet.” Upload the `metadata.json` and bundle files to R2 as in the [R2 File Layout](#r2-file-layout) section to enable downloads.

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

The container runs on any Docker-compatible platform. For **Google Cloud Run** this repo provides a `service.yaml` that uses Secret Manager for all configuration (no hardcoded secrets).

#### Google Cloud Run (Secret Manager)

1. **Build and push the image** to Artifact Registry, e.g.:
   ```bash
   docker build -t REGION-docker.pkg.dev/PROJECT_ID/REPO_NAME/solobackend:latest .
   docker push REGION-docker.pkg.dev/PROJECT_ID/REPO_NAME/solobackend:latest
   ```

2. **Create one Secret Manager secret per variable** (same names as in `.env.local`). Example for one variable:
   ```bash
   echo -n "https://your-app.run.app" | gcloud secrets create NEXT_PUBLIC_SITE_URL --data-file=-
   ```
   Create each of: `NEXT_PUBLIC_SITE_URL`, `DATABASE_URL`, `NEXT_PUBLIC_KINDE_ISSUER_URL`, `NEXT_PUBLIC_KINDE_CLIENT_ID`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY`, `CLOUDFLARE_R2_SECRET_KEY`, `CLOUDFLARE_R2_BUCKET`. Use your production values (e.g. Cloud SQL connection string for `DATABASE_URL`).

3. **Edit `service.yaml`**: set `containers[0].image` to your image URI (replace `IMAGE_PLACEHOLDER`).

4. **Deploy**:
   ```bash
   gcloud run services replace service.yaml
   ```
   Ensure the Cloud Run service account has `roles/secretmanager.secretAccessor` on these secrets (or on the project).

#### Other platforms

- **AWS ECS / Fargate** — push to ECR, create task definition, use Secrets Manager or SSM for env.
- **Fly.io** — `fly launch`, set secrets via `fly secrets set`.
- **Railway / Render** — connect repo, set environment variables in the dashboard.

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

A full **OpenAPI 3.0** specification is in the repo root: **`openapi.yaml`**. Use it to generate client SDKs, validate requests, or view in Swagger UI (e.g. [Swagger Editor](https://editor.swagger.io/) or `npx @redocly/cli preview openapi.yaml`).

**Swagger UI in the app:** In **development** (`npm run dev`) or when Swagger is enabled, open **`/api-docs`** in the browser. The spec is served at `GET /api/openapi` (JSON). **Docker:** Add `ENABLE_SWAGGER_UI=true` to `.env.local`, then run `./start.sh build` (the script passes it as a build-arg so the app is built with Swagger on) and `./start.sh up`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check |
| GET | `/api/bundles` | No | List all bundles |
| POST | `/api/bundles` | Bearer | Create bundle (multipart form: title, description, price, category, file) |
| GET | `/api/bundles/:id` | No | Bundle details + metadata |
| PATCH | `/api/bundles/:id` | Bearer | Update bundle (creator only) |
| DELETE | `/api/bundles/:id` | Bearer | Delete bundle (creator only; no purchases) |
| GET | `/api/bundles/:id/download` | Bearer | Get presigned R2 download URL (optional `?expires_in=60–3600`) |
| GET | `/api/entitlements` | Bearer | User's purchased + owned bundles |
| GET | `/api/collection` | Bearer | My Collection (purchased + owned + saved, deduplicated) |
| POST | `/api/collection` | Bearer | Add bundle to collection |
| GET | `/api/collection/check?bundle_id=` | Bearer | Check if bundle is saved in collection |
| DELETE | `/api/collection/:bundleId` | Bearer | Remove bundle from collection |
| POST | `/api/purchase/create-checkout-session` | Bearer | Create Stripe Checkout session |
| POST | `/api/purchase/refund` | Bearer | Request refund for a purchased bundle (Connect: reverses transfer + app fee) |
| GET | `/api/my-bundles` | Bearer | Bundles created by the user |
| POST | `/api/stripe/webhook` | Stripe sig | Handle purchase confirmation (internal) |

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

A single R2 bucket (e.g. `solobankdbooks`) holds all bundle files. Set `CLOUDFLARE_R2_BUCKET` to that bucket name.

**User-created bundles** are a single compressed file per bundle. Keys are organized by **upload month** for scalability (e.g. `bundles/202603/{bundle_id}.zip`). Ownership and metadata (title, description, category) are stored in Postgres; R2 only stores the file.

```
bundles/
  202601/
    <bundle-uuid>.zip
  202602/
    <bundle-uuid>.zip
  202603/
    <bundle-uuid>.zip
```

**Seed / legacy bundles** (optional) use keys under `bundles/` with a `metadata.json` and multiple files:

```
bundles/
  bach-cello-suite-1/
    metadata.json
    score.pdf
    score.musicxml
    analysis.json
```

Example `metadata.json` (for legacy seed bundles only):

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
