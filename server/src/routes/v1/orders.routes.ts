import { Router } from 'express';
import { createOrder, getOrderById } from '../../controllers/orders.controller.js';
import { authenticateApiKey } from '../../middleware/auth.middleware.js';
import { requireBranchAccess } from '../../middleware/branch.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { validateRequest } from '../../middleware/validator.middleware.js';
import { createOrderSchema } from '../../validators/order.validator.js';

export const ordersRouter = Router();

// POST /orders
ordersRouter.post(
  '/orders',
  authenticateApiKey,
  requirePermission('orders:create'),
  requireBranchAccess('branch_id'),
  validateRequest({ body: createOrderSchema }),
  createOrder
);

// GET /orders/:id
ordersRouter.get(
  '/orders/:id',
  authenticateApiKey,
  requirePermission('orders:read'),
  getOrderById
);
