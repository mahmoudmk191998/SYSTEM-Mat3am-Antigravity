# @rms/sdk — Official Universal RMS Client

The official TypeScript/JavaScript SDK for integrating external restaurant websites, mobile applications, self-service kiosks, and third-party systems with the Restaurant Management System (RMS) API.

## Installation

```bash
npm install @rms/sdk
```

## Quick Start

```typescript
import { RmsApiClient } from '@rms/sdk';

const rms = new RmsApiClient({
  baseUrl: 'https://api.example-restaurant.com/api/v1',
  apiKey: process.env.RMS_API_KEY!,
});

// 1. Fetch restaurant settings & menu
const settings = await rms.getSettings();
const menu = await rms.getMenu();

// 2. Authoritative server-side pricing preview
const pricing = await rms.previewPricing({
  branch_id: 'branch_123',
  order_type: 'delivery',
  items: [{ product_id: 'prod_456', quantity: 2 }],
  coupon_code: 'WELCOME10',
});

// 3. Create an order with idempotency protection
const order = await rms.createOrder(
  {
    branch_id: 'branch_123',
    order_type: 'delivery',
    items: [{ product_id: 'prod_456', quantity: 2 }],
    customer: { name: 'Jane Doe', phone: '+1234567890' },
    delivery_address: { street: '123 Main St', city: 'Metropolis' },
    payment_method: 'credit_card',
  },
  {
    idempotencyKey: 'checkout_session_abc123',
  }
);
```

## Webhook Verification

```typescript
import { verifyWebhookSignature } from '@rms/sdk';

const isValid = verifyWebhookSignature({
  signatureHeader: req.headers['x-rms-signature'],
  rawBody: req.rawBody,
  secret: process.env.RMS_WEBHOOK_SECRET!,
});
```
