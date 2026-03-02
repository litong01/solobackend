#!/bin/sh
# When STRIPE_SECRET_KEY starts with sk_test_, we're in dev/test mode: run stripe listen,
# capture the webhook signing secret, and pass it to the app so you don't need to run
# stripe listen on the host or set STRIPE_WEBHOOK_SECRET manually.
set -e

# Dev/test mode = Stripe test key (sk_test_...)
case "${STRIPE_SECRET_KEY}" in
  sk_test_*) ;;
  *) exec node server.js ;;
esac

# Stripe CLI may be in /app/bin
PATH="${PATH}:/app/bin"
if ! command -v stripe >/dev/null 2>&1; then
  exec node server.js
fi

# CLI needs an API key (same as app's secret key)
if [ -n "$STRIPE_SECRET_KEY" ]; then
  export STRIPE_API_KEY="$STRIPE_SECRET_KEY"
fi

# Start stripe listen in background; forward to this container's app
tmpout="/tmp/stripe_listen_out"
stripe listen --forward-to "http://127.0.0.1:${PORT:-3000}/api/stripe/webhook" > "$tmpout" 2>&1 &
listen_pid=$!

# Wait for the signing secret to appear (CLI prints "Your webhook signing secret is whsec_...")
i=0
while [ $i -lt 20 ]; do
  if grep -q 'whsec_' "$tmpout" 2>/dev/null; then
    break
  fi
  sleep 1
  i=$(( i + 1 ))
done

secret=$(grep -o 'whsec_[a-zA-Z0-9]*' "$tmpout" 2>/dev/null | head -1)
if [ -n "$secret" ]; then
  export STRIPE_WEBHOOK_SECRET="$secret"
fi

exec node server.js
