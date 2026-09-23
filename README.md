# Spira — Portal

The web app for **Spira**, a food-surplus donation platform connecting retailers
with NGOs and foodbanks. **One app, both sides** — what you see depends on the role
the API reports for your account.

- Backend: [**SpiraAPI**](https://github.com/Dava2310/SpiraAPI)
- Superseded prototypes, kept for reference:
  [Spira-Retailer-Portal](https://github.com/Dava2310/Spira-Retailer-Portal) ·
  [Spira-NGO-Portal](https://github.com/Dava2310/Spira-NGO-Portal)

## Why one app

The two prototypes modelled the same domain with disjoint vocabularies and, worse,
two different state machines for the same object:

| Retailer prototype | NGO prototype | This app (from the API) |
|---|---|---|
| `InventoryItem` | `SurplusItem` | `InventoryItemResponseDto` |
| `DonationBatch` | `Reservation` | `DonationResponseDto` |
| `MarketBranch` | `Store` | `LocationResponseDto` |
| `ProductStatus` (`in_inventory`…) | `ItemStatus` (`available`…) | `InventoryItemStatus` |

Generating a client from the API's OpenAPI spec replaces **both** vocabularies with
one. That is the point of the merge, not the convenience of a single deploy.

## Architecture

```
src/
  api-client/       generated from swagger.json — never hand-edited
  lib/
    axios.ts        one instance; Bearer request interceptor + 401 handler
    api-client.ts   the generated Api classes, bound to that instance
    error-utils.ts  API errors → readable messages (handles message arrays)
    token-storage.ts the only thing persisted locally
  auth/             AuthProvider, route guards, session context
  features/<x>/_logic/   view models, mappers, API calls, query keys
  routes/           login, register, retailer/*, ngo/*
  components/       shared shell and primitives
```

**Components never call the API directly.** They call a `_logic` module, which is
the only place the generated method names (`recipientPortalControllerClaim`) appear.
Mappers are deliberately thin — the API already returns derived values like
`urgency`, `distanceKm` and `pickupWindowLabel`, so restating them field by field
would just invent a third vocabulary.

**The token is never trusted for its contents.** It is exchanged for a session via
`GET /api/me` on every load, so a revoked or expired token fails closed instead of
rendering a shell from a stale JWT payload.

## Run locally

**Prerequisites:** Node 22+, pnpm.

```bash
pnpm install
cp .env.example .env.local     # then point it at your API
pnpm dev                       # http://localhost:5173
pnpm build                     # tsc -b && vite build
pnpm lint
```

`.env.example` points at the deployed API. To run against a local one, set
`VITE_API_BASE_URL=http://localhost:3333` in `.env.local` and make sure the API's
`CORS_ORIGIN` includes `http://localhost:5173`.

> The base URL must **not** include `/api` — every generated path already carries it.

## Regenerating the API client

The client is committed so a clone builds without the backend present. After a DTO
or route changes in the API:

```bash
cd ../spira-api
pnpm generate:clients                      # needs a running database + Java
rm -rf ../Spira-Portal/src/api-client
cp -r generated/api-client/. ../Spira-Portal/src/api-client/
rm -rf ../Spira-Portal/src/api-client/{docs,git_push.sh}
```

It is excluded from Prettier and from `noUnusedLocals`, and
`erasableSyntaxOnly` is off because it uses constructor parameter properties.

## Status

Auth is wired end to end: sign-in, self-registration for both sides, role-gated
routes, session from `GET /api/me`, sign-out with server-side revocation. The two
side homes are placeholders — the prototype screens are ported onto them next.
