import { Response, NextFunction } from 'express';
import { defaultOrderService, OrderService } from '../services/order.service.js';
import { AuthenticatedRequest } from '../types/api.types.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError } from '../utils/errors.js';
import { defaultWebhookService } from '../services/webhook.service.js';

export function createOrdersController(orderService: OrderService = defaultOrderService) {
  return {
    createOrder: async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const tenantId = req.apiClient!.tenantId;
        const clientId = req.apiClient!.clientId;
        const idempotencyKey = req.header('Idempotency-Key');

        const result = await orderService.createOrder(
          tenantId,
          clientId,
          req.body,
          idempotencyKey
        );

        await defaultWebhookService.emit(tenantId, 'order.created', result as unknown as Record<string, unknown>);

        sendSuccess(res, result, 201);
      } catch (error) {
        next(error);
      }
    },
    getOrder: async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const order = await orderService.getOrderById(req.apiClient!.tenantId, String(req.params.id));
        if (!order) throw new NotFoundError('Order not found');
        const allowed = req.apiClient!.allowedBranchIds;
        if (allowed.length && !allowed.includes(order.branch_id)) throw new NotFoundError('Order not found');
        sendSuccess(res, orderService.toPublicOrder(order));
      } catch (error) { next(error); }
    },
    updateStatus: async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const order = await orderService.transitionStatus(req.apiClient!.tenantId, String(req.params.id), req.body.status, req.apiClient!.allowedBranchIds);
        await defaultWebhookService.emit(req.apiClient!.tenantId, 'order.status_changed', orderService.toPublicOrder(order));
        sendSuccess(res, orderService.toPublicOrder(order));
      } catch (error) { next(error); }
    },
  };
}

export const { createOrder, getOrder, updateStatus } = createOrdersController();
