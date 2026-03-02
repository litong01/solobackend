#!/bin/bash
# SoloBackend: build image, run containers, or run tests.
# Usage: ./start.sh <command>
#   build  - build the Docker image
#   up     - start PostgreSQL and app (stops existing containers first)
#   down   - stop and remove the two containers (if running)
#   seed   - run DB migrations (schema + seed) via docker exec into solobackend-db

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

cmd="${1:-}"

ensure_network() {
  docker network inspect soloband &>/dev/null || docker network create soloband
}

do_build() {
  echo "Building solobackend image..."
  docker build -t solobackend .
  echo "Done."
}

do_up() {
  ensure_network

  if docker ps -a -q -f name=^solobackend-db$ | grep -q .; then
    echo "Stopping and removing existing solobackend-db container..."
    docker stop solobackend-db 2>/dev/null || true
    docker rm solobackend-db
  fi
  echo "Starting PostgreSQL (solobackend-db)..."
  docker run -d --name solobackend-db \
    --network soloband \
    -p 5432:5432 \
    -v solobackend-db-data:/var/lib/postgresql/data \
    -e POSTGRES_USER=tongli \
    -e POSTGRES_PASSWORD=jietao \
    -e POSTGRES_DB=solobackend \
    postgres:17

  if docker ps -a -q -f name=^solobackend$ | grep -q .; then
    echo "Stopping and removing existing solobackend container..."
    docker stop solobackend 2>/dev/null || true
    docker rm solobackend
  fi
  echo "Starting backend (solobackend)..."
  docker run -d --name solobackend \
    --network soloband \
    -p 3000:3000 \
    --env-file .env.local \
    solobackend

  echo "Done. DB: solobackend-db, App: solobackend (port 3000)."
}

do_down() {
  for name in solobackend solobackend-db; do
    if docker ps -a -q -f name=^${name}$ | grep -q .; then
      echo "Stopping and removing $name..."
      docker stop "$name" 2>/dev/null || true
      docker rm "$name"
    else
      echo "$name is not running."
    fi
  done
  echo "Done."
}

do_test() {
  if ! grep -q '"test"' package.json 2>/dev/null; then
    echo "No \"test\" script in package.json yet. Add one to run tests here."
    exit 1
  fi
  npm test
}

do_seed() {
  if ! docker ps -q -f name=^solobackend-db$ | grep -q .; then
    echo "Error: solobackend-db container is not running. Run ./start.sh up first."
    exit 1
  fi
  echo "Running migrations (schema + seed) on solobackend-db..."
  for f in migrations/*.sql; do
    echo "  → $(basename "$f")"
    docker exec -i solobackend-db psql -U tongli -d solobackend < "$f"
  done
  echo "Done."
}

case "$cmd" in
  build)
    do_build
    ;;
  up)
    do_up
    ;;
  down)
    do_down
    ;;
  seed)
    do_seed
    ;;
  test)
    do_test
    ;;
  "")
    echo "Usage: $0 <command>"
    echo "  build  - build the Docker image"
    echo "  up     - start PostgreSQL and app containers"
    echo "  down   - stop and remove the two containers"
    echo "  seed   - run DB migrations (schema + seed)"
    echo "  test   - run tests (npm test)"
    exit 1
    ;;
  *)
    echo "Unknown command: $cmd"
    echo "Usage: $0 build|up|down|seed|test"
    exit 1
    ;;
esac
