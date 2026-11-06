# REST API v1 and webhooks

Base URL: `https://<domain>/api/v1`. JSON in, JSON out.

## Authentication

A Super Admin creates API keys in **Settings → API keys**. Each key can be limited to one restaurant and to specific scopes. The full key is shown once; only a peppered SHA-256 hash is stored.

```
Authorization: Bearer t23_xxxxxxxxxxxxxxxx
```

| Scope | Allows |
| --- | --- |
| `availability:read` | `GET /restaurants`, `GET /availability` |
| `reservations:read` | `GET /reservations/{reference}` |
| `reservations:write` | `POST /reservations`, `PATCH /reservations/{reference}` |

Each key is limited to 300 requests per minute. Errors look like `{"error":{"code":"...","message":"..."}}`, with status codes 400 `invalid_request`, 401 `unauthorized`, 403 `forbidden`, 404 `not_found`, 409 `slot_unavailable` / `invalid_state`, 422 `policy`, and 429 `rate_limited`.

## Endpoints

### GET /restaurants
Lists the active restaurants the key can access.

### GET /availability?restaurant={slug}&date=YYYY-MM-DD&party_size=N
```json
{ "restaurant": "marlo", "date": "2026-11-18", "timezone": "Asia/Bangkok", "duration_minutes": 90,
  "available": ["11:30", "11:45", "12:00"] }
```
If the restaurant is closed, `available` is `[]` and `reason` explains why (`closed`, `outside_booking_window` or `party_size_out_of_range`).

### POST /reservations
```json
{ "restaurant": "marlo", "date": "2026-11-18", "time": "19:00", "party_size": 2,
  "customer": { "name": "Somchai P.", "phone": "0812345678", "email": "s@example.com", "language": "th" },
  "notes": "Window seat", "allergies": "Peanuts", "special_occasion": "Birthday",
  "external_reference": "PARTNER-123", "channel": "partner-x" }
```
Response `201`:
```json
{ "reference": "T23-9G4MLK", "status": "confirmed", "date": "2026-11-18", "time": "19:00", "party_size": 2,
  "deposit_amount": 0, "manage_url": "https://<domain>/reservation/T23-9G4MLK?t=..." }
```
Tables are assigned automatically under the same rules as online booking. If no table fits, the response is `409 slot_unavailable`. If the restaurant needs a deposit or manual approval, `status` is `pending`.

### GET /reservations/{reference}
Returns the reference, restaurant, date, time, party size, status, deposit and payment status. Guest contact details are not returned.

### PATCH /reservations/{reference}
```json
{ "status": "cancelled", "reason": "Guest called partner" }
```
Only cancellation is supported, and only while the reservation is `pending` or `confirmed`.

## Outbound webhooks

Add endpoints in **Settings → Webhooks**. They must use HTTPS and a public host. The signing secret is shown when the endpoint is created.

Events: `reservation.created`, `reservation.updated`, `reservation.cancelled`.

```
POST <your url>
X-T23-Event: reservation.created
X-T23-Signature: t=1762400000,v1=<hex hmac-sha256>

{ "id": "<delivery id>", "type": "reservation.created", "created_at": "...",
  "data": { "id": "...", "reference": "T23-...", "restaurant_id": "...", "reservation_date": "2026-11-18",
            "reservation_time": "19:00", "party_size": 2, "status": "confirmed", "restaurants": { "slug": "marlo", "name": "Marlo" } } }
```

To verify a delivery, compute `HMAC_SHA256(secret, "<t>.<raw body>")` and compare it with `v1` in constant time. Reject deliveries whose `t` is more than 5 minutes old. Payloads leave out guest names, phone numbers and emails on purpose (data minimisation); call the API if you need more.

Delivery succeeds on any 2xx response within 10 seconds. Failed deliveries are retried with exponential backoff, up to 5 attempts; each attempt is visible in Settings.

```js
import { createHmac, timingSafeEqual } from "node:crypto";
function verify(secret, rawBody, header) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return Math.abs(Date.now() / 1000 - Number(t)) < 300 && timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}
```

## Inbound payment webhooks

- `POST /api/webhooks/payments/stripe`: the Stripe signature is verified with `STRIPE_WEBHOOK_SECRET`.
- `POST /api/webhooks/payments/omise`: the event is re-fetched from the Omise API before it is trusted.

A successful payment marks the deposit as paid. The reservation's `payment_status` is recalculated from its payments and refunds.
