import { WebhookQueue } from './webhookQueue.types.js';
import { InMemoryWebhookQueue } from './inMemoryWebhookQueue.js';

export function createWebhookQueue(): WebhookQueue {
  return new InMemoryWebhookQueue();
}

export const defaultWebhookQueue: WebhookQueue = createWebhookQueue();
