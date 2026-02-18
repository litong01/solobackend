#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# dev-start.sh
#
# Starts a Postgres container, runs migrations,
# seeds data, then starts the app container.
#
# Usage:
#   ./scripts/dev-start.sh          # start everything
#   ./scripts/dev-start.sh --down   # tear everything down
# ──────────────────────────────────────────────

POSTGRES_CONTAINER="solobackend-db"
APP_CONTAINER="solobackend-app"
APP_IMAGE="solobackend"
NETWORK="solobackend-net"

DB_USER="postgres"
DB_PASS="postgres"
DB_NAME="solobackend"
DB_PORT="5432"

# Connection string the app container uses (hostname = Postgres container name)
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${POSTGRES_CONTAINER}:5432/${DB_NAME}"

# Connection string for running migrations from the host
DATABASE_URL_HOST="postgresql://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}"

# ──────────────────────────────────────────────
# Tear down
# ──────────────────────────────────────────────
if [[ "${1:-}" == "--down" ]]; then
  echo "Stopping containers..."
  docker rm -f "$APP_CONTAINER" "$POSTGRES_CONTAINER" 2>/dev/null || true
  docker network rm "$NETWORK" 2>/dev/null || true
  echo "Done."
  exit 0
fi

# ──────────────────────────────────────────────
# Load env file
# ──────────────────────────────────────────────
ENV_FILE=".env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  ENV_FILE=".env"
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: No .env.local or .env file found."
  echo "Copy .env.example to .env.local and fill in your credentials first:"
  echo "  cp .env.example .env.local"
  exit 1
fi

echo "Using env file: $ENV_FILE"

# ──────────────────────────────────────────────
# Create Docker network
# ──────────────────────────────────────────────
if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
  echo "Creating Docker network: $NETWORK"
  docker network create "$NETWORK"
fi

# ──────────────────────────────────────────────
# Start Postgres
# ──────────────────────────────────────────────
if docker ps -a --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
  echo "Postgres container already exists."
  if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
    echo "Starting stopped Postgres container..."
    docker start "$POSTGRES_CONTAINER"
  fi
else
  echo "Starting Postgres container..."
  docker run -d \
    --name "$POSTGRES_CONTAINER" \
    --network "$NETWORK" \
    -e POSTGRES_USER="$DB_USER" \
    -e POSTGRES_PASSWORD="$DB_PASS" \
    -e POSTGRES_DB="$DB_NAME" \
    -p "${DB_PORT}:5432" \
    -v solobackend-pgdata:/var/lib/postgresql/data \
    postgres:16-alpine
fi

# ──────────────────────────────────────────────
# Wait for Postgres to be ready
# ──────────────────────────────────────────────
echo "Waiting for Postgres to be ready..."
for i in $(seq 1 30); do
  if docker exec "$POSTGRES_CONTAINER" pg_isready -U "$DB_USER" >/dev/null 2>&1; then
    echo "Postgres is ready."
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "Error: Postgres did not become ready in time."
    exit 1
  fi
  sleep 1
done

# ──────────────────────────────────────────────
# Run migrations
# ──────────────────────────────────────────────
echo "Running migrations..."
for f in migrations/*.sql; do
  echo "  → $(basename "$f")"
  docker exec -i "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$f"
done
echo "Migrations complete."

# ──────────────────────────────────────────────
# Build app image (if not already built)
# ──────────────────────────────────────────────
if ! docker image inspect "$APP_IMAGE" >/dev/null 2>&1; then
  echo "Building app image..."
  docker build -t "$APP_IMAGE" .
else
  echo "App image '$APP_IMAGE' already exists. To rebuild: docker build -t $APP_IMAGE ."
fi

# ──────────────────────────────────────────────
# Start app container
# ──────────────────────────────────────────────
docker rm -f "$APP_CONTAINER" 2>/dev/null || true

echo "Starting app container..."
docker run -d \
  --name "$APP_CONTAINER" \
  --network "$NETWORK" \
  -p 3000:3000 \
  --env-file "$ENV_FILE" \
  -e DATABASE_URL="$DATABASE_URL" \
  "$APP_IMAGE"

echo ""
echo "============================================"
echo "  App is running at http://localhost:3000"
echo "============================================"
echo ""
echo "  Postgres: localhost:${DB_PORT} (user: ${DB_USER}, db: ${DB_NAME})"
echo "  App logs: docker logs -f ${APP_CONTAINER}"
echo "  Stop all: ./scripts/dev-start.sh --down"
echo ""
