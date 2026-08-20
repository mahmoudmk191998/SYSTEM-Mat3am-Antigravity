import { Response, NextFunction } from 'express';
import { defaultOrderService, OrderService } from '../services/order.service.js';
import { AuthenticatedRequest } from '../types/api.types.js';
import { sendSuccess } from '../utils/response.js';

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

        sendSuccess(res, result, 201);
      } catch (error) {
        next(error);
      }
    },
  };
}

export const { createOrder } = createOrdersController();
