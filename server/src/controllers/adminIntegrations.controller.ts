import { Response, NextFunction } from 'express';
import {
  defaultIntegrationService,
  IntegrationService,
} from '../services/integration.service.js';
import {
  defaultWebhookService,
  WebhookService,
} from '../services/webhook.service.js';
import { AuthenticatedRequest } from '../types/api.types.js';
import { sendSuccess } from '../utils/response.js';

export function createAdminIntegrationsController(
  integrationService: IntegrationService = defaultIntegrationService,
  webhookService: WebhookService = defaultWebhookService
) {
  return {
    onboardIntegration: async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const tenantId = req.apiClient!.tenantId;
        const result = await integrationService.onboardIntegration(tenantId, {
          ...req.body,
          created_by: req.apiClient?.clientId,
        });
        sendSuccess(res, result, 201);
      } catch (error) {
        next(error);
      }
    },

    listIntegrations: async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const tenantId = req.apiClient!.tenantId;
        const type = req.query.type as string | undefined;
        const status = req.query.status as string | undefined;
        const items = await integrationService.listIntegrations(tenantId, { type, status });
        sendSuccess(res, items, 200);
      } catch (error) {
        next(error);
      }
    },

    getIntegrationById: async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const tenantId = req.apiClient!.tenantId;
        const id = req.params.id as string;
        const item = await integrationService.getIntegrationById(tenantId, id);
        sendSuccess(res, item, 200);
      } catch (error) {
        next(error);
      }
    },

    updateIntegration: async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const tenantId = req.apiClient!.tenantId;
        const id = req.params.id as string;
        const updated = await integrationService.updateIntegration(tenantId, id, req.body);
        sendSuccess(res, updated, 200);
      } catch (error) {
        next(error);
      }
    },

    revokeIntegration: async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const tenantId = req.apiClient!.tenantId;
        const id = req.params.id as string;
        const result = await integrationService.revokeIntegration(tenantId, id);
        sendSuccess(res, result, 200);
      } catch (error) {
        next(error);
      }
    },

    rotateSecret: async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const tenantId = req.apiClient!.tenantId;
        const id = req.params.id as string;
        const result = await integrationService.rotateSecret(tenantId, id);
        sendSuccess(res, result, 200);
      } catch (error) {
        next(error);
      }
    },

    getWebhookHealth: async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const tenantId = req.apiClient!.tenantId;
        const id = req.params.id as string;
        const integration = await integrationService.getIntegrationById(tenantId, id);
        const health = await webhookService.getIntegrationWebhookHealth(
          tenantId,
          integration.webhook_endpoint_id
        );
        sendSuccess(res, { integration_id: id, ...health }, 200);
      } catch (error) {
        next(error);
      }
    },

    getDeadLetters: async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const tenantId = req.apiClient!.tenantId;
        const id = req.params.id as string;
        await integrationService.getIntegrationById(tenantId, id);
        const deadLetters = await webhookService.getDeadLetters(tenantId);
        sendSuccess(res, { integration_id: id, dead_letters: deadLetters }, 200);
      } catch (error) {
        next(error);
      }
    },
  };
}

export const {
  onboardIntegration,
  listIntegrations,
  getIntegrationById,
  updateIntegration,
  revokeIntegration,
  rotateSecret,
  getWebhookHealth,
  getDeadLetters,
} = createAdminIntegrationsController();
