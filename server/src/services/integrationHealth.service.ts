import { defaultWebhookService, WebhookService } from './webhook.service.js';
import { defaultCircuitBreaker } from '../infrastructure/circuit-breaker/circuitBreaker.js';
import { CircuitBreaker } from '../infrastructure/circuit-breaker/circuitBreaker.types.js';
import { defaultIntegrationService, IntegrationService } from './integration.service.js';

export interface IntegrationHealthReport {
  integration_id: string;
  status: 'healthy' | 'degraded' | 'failing' | 'idle' | 'no_endpoint';
  health_score: number; // 0 to 100
  circuit_state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  success_rate: number;
  failure_rate: number;
  average_latency_ms: number;
  pending_events: number;
  retry_count: number;
  dead_letter_count: number;
  last_success_at?: string;
  last_failure_at?: string;
  endpoint_url?: string;
}

export class IntegrationHealthService {
  private webhookService: WebhookService;
  private integrationService: IntegrationService;
  private circuitBreaker: CircuitBreaker;

  constructor(
    webhookService: WebhookService = defaultWebhookService,
    integrationService: IntegrationService = defaultIntegrationService,
    circuitBreaker: CircuitBreaker = defaultCircuitBreaker
  ) {
    this.webhookService = webhookService;
    this.integrationService = integrationService;
    this.circuitBreaker = circuitBreaker;
  }

  /**
   * Calculates comprehensive health and reliability metrics for an external integration
   */
  async getIntegrationHealth(
    tenantId: string,
    integrationId: string
  ): Promise<IntegrationHealthReport> {
    const integration = await this.integrationService.getIntegrationById(tenantId, integrationId);
    const webhookHealth = await this.webhookService.getIntegrationWebhookHealth(
      tenantId,
      integration.webhook_endpoint_id
    );

    let circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    if (integration.webhook_endpoint_id) {
      const cbStatus = await this.circuitBreaker.getState(tenantId, integration.webhook_endpoint_id);
      circuitState = cbStatus.state;
    }

    // Deterministic Reliability Score (0 - 100)
    let healthScore = 100;
    const total = webhookHealth.total_deliveries;

    if (total > 0) {
      // 1. Success rate weight (up to 50 pts)
      const successScore = (webhookHealth.successful_deliveries / total) * 50;

      // 2. Failure rate penalty (up to -30 pts)
      const failurePenalty = (webhookHealth.failed_deliveries / total) * 30;

      // 3. Circuit breaker penalty
      let circuitPenalty = 0;
      if (circuitState === 'OPEN') circuitPenalty = 30;
      else if (circuitState === 'HALF_OPEN') circuitPenalty = 15;

      // 4. Latency penalty
      let latencyPenalty = 0;
      if (webhookHealth.avg_response_time_ms > 5000) latencyPenalty = 20;
      else if (webhookHealth.avg_response_time_ms > 2000) latencyPenalty = 10;

      // 5. Dead letters penalty (-5 per dead letter, max 20)
      const deadLetterPenalty = Math.min(20, webhookHealth.dead_letter_count * 5);

      healthScore = Math.max(
        0,
        Math.min(
          100,
          Math.round(50 + successScore - failurePenalty - circuitPenalty - latencyPenalty - deadLetterPenalty)
        )
      );
    } else {
      healthScore = 100; // New integration with 0 events
    }

    let overallStatus: IntegrationHealthReport['status'] = 'idle';
    if (webhookHealth.status === 'no_endpoint') {
      overallStatus = 'no_endpoint';
    } else if (circuitState === 'OPEN' || healthScore < 50 || webhookHealth.dead_letter_count > 0) {
      overallStatus = 'failing';
    } else if (circuitState === 'HALF_OPEN' || healthScore < 80) {
      overallStatus = 'degraded';
    } else if (total > 0) {
      overallStatus = 'healthy';
    }

    return {
      integration_id: integrationId,
      status: overallStatus,
      health_score: healthScore,
      circuit_state: circuitState,
      success_rate: webhookHealth.success_rate,
      failure_rate: webhookHealth.failure_rate,
      average_latency_ms: webhookHealth.avg_response_time_ms,
      pending_events: webhookHealth.pending_count,
      retry_count: webhookHealth.retry_count,
      dead_letter_count: webhookHealth.dead_letter_count,
      last_success_at: webhookHealth.last_success_at,
      last_failure_at: webhookHealth.last_failure_at,
      endpoint_url: webhookHealth.endpoint_url,
    };
  }
}

export const defaultIntegrationHealthService = new IntegrationHealthService();
