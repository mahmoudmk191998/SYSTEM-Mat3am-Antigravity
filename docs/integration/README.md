# RMS Integration Guide & Developer Portal

Welcome to the RMS (Restaurant Management System) REST API Integration Guide. This portal documents how external websites, mobile apps, kiosks, and aggregators securely integrate with the RMS central platform.

## Integration Topics

1. [Authentication & Credentials](./authentication.md) — API keys, scopes, headers, and client management.
2. [Catalog & Menu](./menu.md) — Retrieving categories, items, and branch availability.
3. [Delivery & Zones](./delivery.md) — Delivery zones, coverage checking, and fees.
4. [Server-Authoritative Pricing](./pricing.md) — Calculating deterministic subtotals, coupons, taxes, and grand totals.
5. [Order Creation & Idempotency](./orders.md) — Secure order placement with deduplication guarantees.
6. [Order Tracking](./tracking.md) — Polling and fetching real-time, customer-safe order updates.
7. [Webhooks & HMAC Verification](./webhooks.md) — Real-time event subscription with HMAC-SHA256 signatures.
8. [Security & Best Practices](./security.md) — Best practices, PII protection, rate limits, and CORS.
9. [Sushi Bar Full Integration Walkthrough](./sushi-bar-example.md) — End-to-end example integration.

## Official TypeScript / JavaScript SDK

The official SDK is located at `server/src/integration/` (or imported as `@rms/sdk`):

```typescript
import { RmsApiClient } from './integration/index.js';

const client = new RmsApiClient({
  baseUrl: 'https://api.rms.example.com/api/v1',
  apiKey: 'rms_live_cli_sushi_bar.rms_sec_xxxxxxxxxxxx',
  branchId: 'branch_sushi_main',
});
```
