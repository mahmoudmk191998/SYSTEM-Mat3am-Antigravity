import { Response, NextFunction } from 'express';
import { defaultOrderService, OrderService } from '../services/order.service.js';
import { AuthenticatedRequest } from '../types/api.types.js';
import { PublicOrderResponse } from '../types/order.types.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';
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

    getOrderById: async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const tenantId = req.apiClient!.tenantId;
        const orderId = req.params.id as string;

        const order = await orderService.getOrderById(tenantId, orderId);
        if (!order) {
          throw new NotFoundError(`Order '${orderId}' not found`);
        }

        // Enforce branch access restriction if configured for this API client
        const allowedBranches = req.apiClient?.allowedBranchIds || [];
        if (allowedBranches.length > 0 && !allowedBranches.includes(order.branch_id)) {
          throw new ForbiddenError(
            `Branch access denied: Client is not authorized to view orders from branch '${order.branch_id}'`
          );
        }

        // Format customer-safe public order response (stripping internal cost, margins, recipes, secrets)
        const publicOrder: PublicOrderResponse = {
          id: order.id,
          order_number: order.order_number,
          branch_id: order.branch_id,
          order_type: order.order_type,
          status: order.status,
          payment_status: order.payment_status,
          payment_method: order.payment_method,
          customer: order.customer_snapshot,
          delivery: order.delivery_snapshot,
          pricing: {
            subtotal: order.pricing_snapshot.subtotal,
            discount_total: order.pricing_snapshot.discount_total,
            delivery_fee: order.pricing_snapshot.delivery_fee,
            tax_rate: order.pricing_snapshot.tax_rate,
            tax_amount: order.pricing_snapshot.tax_amount,
            grand_total: order.pricing_snapshot.grand_total,
            currency: order.pricing_snapshot.currency,
          },
          items: order.items.map((item) => ({
            product_id: item.product_id,
            name: item.name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            addons: item.addons,
            addons_total: item.addons_total,
            line_subtotal: item.line_subtotal,
            line_total: item.line_total,
          })),
          notes: order.notes,
          created_at: order.created_at,
          updated_at: order.updated_at,
        };

        sendSuccess(res, publicOrder, 200);
      } catch (error) {
        next(error);
      }
    },
  };
}

export const { createOrder, getOrderById } = createOrdersController();
