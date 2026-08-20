import {
  QueuedWebhookJob,
  WebhookDeadLetter,
  WebhookQueue,
  WebhookQueueStatus,
} from './webhookQueue.types.js';

export class InMemoryWebhookQueue implements WebhookQueue {
  private jobs = new Map<string, QueuedWebhookJob>();
  private deadLetters: WebhookDeadLetter[] = [];

  async enqueue(job: QueuedWebhookJob): Promise<void> {
    // Deduplication guard by event_id + endpoint_id
    const existing = Array.from(this.jobs.values()).find(
      (j) => j.event_id === job.event_id && j.endpoint_id === job.endpoint_id
    );
    if (!existing) {
      this.jobs.set(job.job_id, job);
    }
  }

  async dequeue(limit: number = 10): Promise<QueuedWebhookJob[]> {
    const now = new Date().toISOString();
    const readyJobs: QueuedWebhookJob[] = [];

    for (const job of this.jobs.values()) {
      if (job.next_attempt_at <= now) {
        readyJobs.push(job);
        if (readyJobs.length >= limit) break;
      }
    }

    return readyJobs;
  }

  async ack(jobId: string): Promise<void> {
    this.jobs.delete(jobId);
  }

  async retry(jobId: string, delaySeconds: number, reason: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) {
      const nextTime = new Date(Date.now() + delaySeconds * 1000).toISOString();
      job.attempt_count += 1;
      job.next_attempt_at = nextTime;
      this.jobs.set(jobId, job);
    }
  }

  async fail(jobId: string, reason: string, statusCode?: number): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) {
      this.jobs.delete(jobId);
      this.deadLetters.push({
        id: `wdl_${job.job_id}`,
        event_id: job.event_id,
        tenant_id: job.tenant_id,
        integration_id: job.integration_id,
        endpoint_id: job.endpoint_id,
        destination_url: job.url,
        event_type: job.payload.event_type,
        order_id: job.payload.data?.order_id || (job.payload as any).order_id,
        attempts: job.attempt_count,
        last_error: reason,
        last_status_code: statusCode,
        failed_at: new Date().toISOString(),
        next_action: 'inspect_endpoint_or_manual_retry',
      });
    }
  }

  async getPendingCount(tenantId?: string): Promise<number> {
    if (!tenantId) return this.jobs.size;
    return Array.from(this.jobs.values()).filter((j) => j.tenant_id === tenantId).length;
  }

  async getDeadLetters(tenantId: string, limit: number = 50): Promise<WebhookDeadLetter[]> {
    return this.deadLetters
      .filter((dl) => dl.tenant_id === tenantId)
      .slice(-limit)
      .reverse();
  }

  async getStatus(): Promise<WebhookQueueStatus> {
    return {
      provider: 'in-memory',
      status: 'healthy',
      pending_jobs: this.jobs.size,
      dead_letters_count: this.deadLetters.length,
    };
  }

  async clear(): Promise<void> {
    this.jobs.clear();
    this.deadLetters = [];
  }
}
