# Stripe Seat Licensing

Organization seat billing uses Stripe Checkout and webhooks.

## Required environment variables

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_SEAT_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
SCALE_APP_HOST=http://localhost:5173
```

Optional:

```env
STRIPE_SEAT_PRODUCT_ID=prod_...
STRIPE_CHECKOUT_SUCCESS_URL=http://localhost:5173/?checkout=success
STRIPE_CHECKOUT_CANCEL_URL=http://localhost:5173/?checkout=cancelled
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## Stripe Dashboard setup

1. Create a one-time **$30** price on your seat product and copy the `price_...` ID into `STRIPE_SEAT_PRICE_ID`.
2. Add a webhook endpoint pointing to your webhooks service:
   - Production: `https://<webhooks-host>/v1/webhooks/stripe`
   - Local: use Stripe CLI (below)
3. Subscribe to `checkout.session.completed`.
4. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

## Local development with Stripe CLI

```bash
stripe listen --forward-to localhost:1340/v1/webhooks/stripe
```

Use the `whsec_...` secret printed by the CLI as `STRIPE_WEBHOOK_SECRET` in `.env`.

Trigger a test checkout completion:

```bash
stripe trigger checkout.session.completed
```

## Flow summary

- Org admins purchase seats via `POST /v1/licensing/org/checkout`.
- Students hit the paywall on classroom enroll via `POST /v1/licensing/student/checkout`.
- Webhooks grant org pool capacity or create a per-classroom `SeatClaim`.
- Each classroom enrollment consumes one prepaid org seat when available.

## Security

Rotate any Stripe secret keys that were shared in chat or committed to version control.
