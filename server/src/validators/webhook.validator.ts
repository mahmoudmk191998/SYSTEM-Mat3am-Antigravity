import { z } from 'zod';
export const createWebhookSubscriptionSchema = z.object({ url: z.string().url().max(2048), events: z.array(z.enum(['order.created', 'order.status_changed'])).min(1).max(2) }).strict();
