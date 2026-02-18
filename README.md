# SoloBackend — Digital Music Bundle Store

A full-stack application for selling digital music bundles (PDF + MusicXML + JSON) with authentication, payments, and secure file delivery.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Next.js Web   │────▶│  Express Backend  │────▶│   PostgreSQL    │
│   (Frontend)    │     │     (API)         │     │   (Database)    │
└────────┬────────┘     └──────┬───────────┘     └─────────────────┘
         │                     │
         │                     ├──▶ Cloudflare R2 (File Storage)
         │                     ├──▶ Stripe (Payments)
         │                     │
         └──── Kinde (Auth) ◀──┘
```

**Auth flow:** User logs in via Kinde on the frontend → receives JWT → frontend sends JWT to backend → backend validates via JWKS.

**Purchase flow:** User clicks Purchase → backend creates Stripe Checkout session → user pays on Stripe → Stripe calls webhook → backend records entitlement.

**Download flow:** User requests download → backend checks entitlement → generates a short-lived signed URL for the R2 file → returns URL to frontend.

## Folder Structure

```
solobackend/
├── backend/
│   ├── src/
│   │   ├── config/          # Environment, database, Stripe, R2 clients
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/       # JWT authentication
│   │   ├── routes/          # Express router
│   │   ├── services/        # Business logic and data access
│   │   ├── types/           # TypeScript types
│   │   ├── index.ts         # Entry point
│   │   └── migrate.ts       # Database migration runner
│   ├── migrations/          # SQL migration files
│   ├── Dockerfile
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── web/
│   ├── src/
│   │   ├── app/             # Next.js App Router pages
│   │   ├── components/      # React components
│   │   ├── lib/             # API client
│   │   └── types/           # TypeScript types
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check |
| GET | `/api/bundles` | No | List all bundles |
| GET | `/api/bundles/:id` | No | Get bundle details + metadata |
| GET | `/api/entitlements` | Yes | List user's purchased bundles |
| POST | `/api/purchase/create-checkout-session` | Yes | Create Stripe Checkout session |
| POST | `/api/stripe/webhook` | No* | Stripe webhook (signature verified) |
| GET | `/api/bundles/:id/download` | Yes | Get signed download URL |

*The webhook endpoint validates the Stripe signature instead of a user JWT.

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- A Kinde account
- A Stripe account
- A Cloudflare R2 bucket

### 1. Set Up the Database

```bash
createdb solobackend

cd backend
cp .env.example .env
# Edit .env with your DATABASE_URL

npm install
npm run migrate
```

### 2. Start the Backend

```bash
cd backend
npm run dev
# Runs on http://localhost:4000
```

### 3. Start the Frontend

```bash
cd web
cp .env.example .env.local
# Edit .env.local with your Kinde and API settings

npm install
npm run dev
# Runs on http://localhost:3000
```

### 4. Set Up Stripe Webhooks (Local)

```bash
# Install the Stripe CLI: https://stripe.com/docs/stripe-cli
stripe listen --forward-to localhost:4000/api/stripe/webhook
# Copy the webhook signing secret to your backend .env as STRIPE_WEBHOOK_SECRET
```

## Configuring External Services

### Kinde (Authentication)

1. Create an account at [kinde.com](https://kinde.com).
2. Create an application (choose "Regular Web App").
3. Note your **Domain** (e.g., `https://your-app.kinde.com`), **Client ID**, and **Client Secret**.
4. In Kinde settings → "Callback URLs", add:
   - **Allowed callback URLs:** `http://localhost:3000/api/auth/kinde_callback`
   - **Allowed logout redirect URLs:** `http://localhost:3000`
5. If using API audiences, create one and note the **Audience** identifier.
6. Set these in your `.env` files:
   - Backend: `KINDE_ISSUER_URL`, `KINDE_CLIENT_ID`, `KINDE_AUDIENCE`
   - Frontend: `KINDE_CLIENT_ID`, `KINDE_CLIENT_SECRET`, `KINDE_ISSUER_URL`, `KINDE_SITE_URL`

### Stripe (Payments)

1. Create a Stripe account at [stripe.com](https://stripe.com).
2. Get your **Secret Key** from Dashboard → Developers → API keys.
3. Set up a webhook endpoint:
   - **URL:** `https://your-backend-domain/api/stripe/webhook`
   - **Events:** `checkout.session.completed`
4. Copy the **Webhook Signing Secret**.
5. Set in backend `.env`: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

### Cloudflare R2 (File Storage)

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Go to **R2** → create a bucket (e.g., `music-bundles`).
3. Create an **API token** with read/write access to R2.
4. Note your **Account ID** (visible in the dashboard URL or overview page).
5. Set in backend `.env`: `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY`, `CLOUDFLARE_R2_SECRET_KEY`, `CLOUDFLARE_R2_BUCKET`

#### R2 File Structure

Each bundle has a folder in R2 with a `metadata.json` file:

```
bundles/
  bach-cello-suite-1/
    metadata.json
    score.pdf
    score.musicxml
    analysis.json
  debussy-clair-de-lune/
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

## Deploying the Backend Container

### Build

```bash
cd backend
docker build -t solobackend-api .
```

### Run

```bash
docker run -d \
  --name solobackend-api \
  -p 4000:4000 \
  -e DATABASE_URL="postgresql://user:pass@db-host:5432/solobackend" \
  -e KINDE_ISSUER_URL="https://your-app.kinde.com" \
  -e KINDE_CLIENT_ID="your_client_id" \
  -e KINDE_AUDIENCE="" \
  -e STRIPE_SECRET_KEY="sk_live_..." \
  -e STRIPE_WEBHOOK_SECRET="whsec_..." \
  -e CLOUDFLARE_R2_ACCOUNT_ID="your_account_id" \
  -e CLOUDFLARE_R2_ACCESS_KEY="your_access_key" \
  -e CLOUDFLARE_R2_SECRET_KEY="your_secret_key" \
  -e CLOUDFLARE_R2_BUCKET="music-bundles" \
  -e FRONTEND_URL="https://your-frontend.com" \
  solobackend-api
```

### Run Migrations in Container

```bash
docker exec solobackend-api node -e "require('./dist/migrate.js')"
```

Or run migrations before starting the container with a separate init container.

### Deploying to Cloud Services

The container can be deployed to:
- **Google Cloud Run** — `gcloud run deploy solobackend-api --image gcr.io/PROJECT/solobackend-api`
- **AWS ECS / Fargate** — push image to ECR and create a task definition
- **Fly.io** — `fly launch` with the Dockerfile
- **Railway / Render** — connect the repo and point to `backend/Dockerfile`

Set all environment variables in your cloud provider's configuration.

## Database Schema

```sql
-- Users (synced from Kinde on first auth / purchase)
CREATE TABLE users (
    id          TEXT PRIMARY KEY,         -- Kinde user ID
    email       TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Bundles (music score packages)
CREATE TABLE bundles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    price           NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    metadata_url    TEXT NOT NULL,       -- R2 key to metadata JSON
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Entitlements (purchase records)
CREATE TABLE entitlements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         TEXT NOT NULL REFERENCES users(id),
    bundle_id       UUID NOT NULL REFERENCES bundles(id),
    purchased_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, bundle_id)
);
```

## Signed URL Generation

The backend uses the AWS S3 SDK (compatible with Cloudflare R2) to generate pre-signed `GetObject` URLs:

```typescript
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const command = new GetObjectCommand({ Bucket: "music-bundles", Key: fileKey });
const url = await getSignedUrl(r2Client, command, { expiresIn: 300 });
```

- URLs expire after **5 minutes** (300 seconds).
- The URL is not user-specific — entitlement checks happen in the backend *before* generating the URL.
- The R2 bucket remains private; no public access is needed.

## License

See [LICENSE](./LICENSE).
