import { createHash, createHmac, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/environment.js';
import { AppError, NotFoundError } from '../utils/errors.js';
import { getFirestoreDb } from '../config/firebase.js';

export type WebhookEventType = 'order.created' | 'order.status_changed';
export interface WebhookSubscription { id: string; tenant_id: string; url: string; events: WebhookEventType[]; secret: string; is_active: boolean; created_at: string; }
export interface WebhookDelivery { id: string; event_id: string; subscription_id: string; tenant_id: string; event_type: WebhookEventType; payload: Record<string, unknown>; attempts: number; status: 'pending' | 'delivered' | 'failed'; next_attempt_at: string; last_error?: string; delivered_at?: string; }
const subscriptions = new Map<string, WebhookSubscription>();
const deliveries = new Map<string, WebhookDelivery>();
const MAX_ATTEMPTS = 6;
const retryAt = (attempt: number) => new Date(Date.now() + Math.min(60_000 * 2 ** Math.max(0, attempt - 1), 3_600_000)).toISOString();

/** Durable outbox. Production stores subscriptions, events, and delivery state in Firestore. */
export class WebhookService {
  constructor(private useMemory = env.NODE_ENV === 'test') {}
  async createSubscription(tenantId: string, url: string, events: WebhookEventType[]) {
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new AppError('Webhook URL must be valid', 400, 'INVALID_WEBHOOK_URL'); }
    if (parsed.protocol !== 'https:' && !(this.useMemory && parsed.protocol === 'http:')) throw new AppError('Webhook URL must use HTTPS', 400, 'INVALID_WEBHOOK_URL');
    const sub: WebhookSubscription = { id: `whs_${uuidv4().replace(/-/g, '').slice(0, 20)}`, tenant_id: tenantId, url, events, secret: randomBytes(32).toString('hex'), is_active: true, created_at: new Date().toISOString() };
    if (this.useMemory) subscriptions.set(sub.id, sub);
    else { try { await getFirestoreDb().collection('webhook_subscriptions').doc(sub.id).create(sub); } catch { throw new AppError('Webhook persistence failed', 503, 'PERSISTENCE_FAILED'); } }
    return sub;
  }
  async listSubscriptions(tenantId: string) {
    const all = this.useMemory ? [...subscriptions.values()].filter(s => s.tenant_id === tenantId) : (await getFirestoreDb().collection('webhook_subscriptions').where('tenant_id', '==', tenantId).get()).docs.map(doc => doc.data() as WebhookSubscription);
    return all.map(({ secret, ...safe }) => safe);
  }
  async emit(tenantId: string, eventType: WebhookEventType, data: Record<string, unknown>) {
    // An order event has a stable identifier, so a POST retry cannot create a second delivery.
    const source = typeof data.order_id === 'string' ? `${data.order_id}:${String(data.status || '')}` : uuidv4();
    const eventId = `evt_${createHash('sha256').update(`${tenantId}:${eventType}:${source}`).digest('hex').slice(0, 20)}`;
    const payload = { id: eventId, type: eventType, created_at: new Date().toISOString(), data };
    const all = this.useMemory ? [...subscriptions.values()] : (await getFirestoreDb().collection('webhook_subscriptions').where('tenant_id', '==', tenantId).get()).docs.map(doc => doc.data() as WebhookSubscription);
    const target = all.filter(sub => sub.tenant_id === tenantId && sub.is_active && sub.events.includes(eventType));
    if (!this.useMemory) { const db = getFirestoreDb(), batch = db.batch(); batch.set(db.collection('webhook_events').doc(eventId), { id: eventId, tenant_id: tenantId, type: eventType, payload, created_at: payload.created_at }, { merge: true }); for (const sub of target) { const id = `${eventId}:${sub.id}`; batch.set(db.collection('webhook_deliveries').doc(id), { id, event_id: eventId, subscription_id: sub.id, tenant_id: tenantId, event_type: eventType, payload, attempts: 0, status: 'pending', next_attempt_at: payload.created_at }, { merge: true }); } try { await batch.commit(); } catch { throw new AppError('Webhook persistence failed', 503, 'PERSISTENCE_FAILED'); } return eventId; }
    for (const sub of target) {
      const id = `${eventId}:${sub.id}`;
      if (!deliveries.has(id)) deliveries.set(id, { id, event_id: eventId, subscription_id: sub.id, tenant_id: tenantId, event_type: eventType, payload, attempts: 0, status: 'pending', next_attempt_at: new Date().toISOString() });
    }
    return eventId;
  }
  async dispatchDue(now = new Date()) {
    const due = this.useMemory ? [...deliveries.values()].filter(d => d.status === 'pending' && new Date(d.next_attempt_at) <= now) : (await getFirestoreDb().collection('webhook_deliveries').where('status', '==', 'pending').get()).docs.map(d => d.data() as WebhookDelivery).filter(d => new Date(d.next_attempt_at) <= now);
    for (const delivery of due) await this.deliver(delivery);
    return due.length;
  }
  private async deliver(delivery: WebhookDelivery) {
    const subscription = this.useMemory ? subscriptions.get(delivery.subscription_id) : (await getFirestoreDb().collection('webhook_subscriptions').doc(delivery.subscription_id).get()).data() as WebhookSubscription | undefined; if (!subscription) return;
    const body = JSON.stringify(delivery.payload);
    const signature = `sha256=${createHmac('sha256', subscription.secret).update(body).digest('hex')}`;
    delivery.attempts += 1;
    try {
      const response = await fetch(subscription.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RMS-Event-ID': delivery.event_id, 'X-RMS-Signature': signature }, body, signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      delivery.status = 'delivered'; delivery.delivered_at = new Date().toISOString(); delivery.last_error = undefined;
    } catch (error) {
      delivery.last_error = error instanceof Error ? error.message.slice(0, 500) : 'Delivery failed';
      if (delivery.attempts >= MAX_ATTEMPTS) delivery.status = 'failed'; else delivery.next_attempt_at = retryAt(delivery.attempts);
    }
    if (!this.useMemory) { try { await getFirestoreDb().collection('webhook_deliveries').doc(delivery.id).update({ attempts: delivery.attempts, status: delivery.status, next_attempt_at: delivery.next_attempt_at, last_error: delivery.last_error || null, delivered_at: delivery.delivered_at || null }); } catch { throw new AppError('Webhook persistence failed', 503, 'PERSISTENCE_FAILED'); } }
  }
  async listDeliveries(tenantId: string) { const all = this.useMemory ? [...deliveries.values()].filter(d => d.tenant_id === tenantId) : (await getFirestoreDb().collection('webhook_deliveries').where('tenant_id', '==', tenantId).get()).docs.map(doc => doc.data() as WebhookDelivery); return all.map(({ payload, ...safe }) => safe); }
  clearMemory() { subscriptions.clear(); deliveries.clear(); }
}
export const defaultWebhookService = new WebhookService();
