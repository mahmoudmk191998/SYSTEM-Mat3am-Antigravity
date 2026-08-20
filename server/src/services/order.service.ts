import { v4 as uuidv4 } from 'uuid';
import { getFirestoreDb } from '../config/firebase.js';
import { env } from '../config/environment.js';
import { defaultBranchesService, BranchesService } from './branches.service.js';
import { defaultInventoryService, InventoryService } from './inventory.service.js';
import { defaultPricingEngine, PricingEngine } from './pricing/pricing.engine.js';
import { defaultOrderNumberService, OrderNumberService } from './orderNumber.service.js';
import { defaultIdempotencyService, IdempotencyService } from './idempotency.service.js';
import { generateRequestFingerprint } from '../utils/fingerprint.js';
import { NotFoundError } from '../utils/errors.js';
import { ProductUnavailableError } from './pricing/pricing.errors.js';
import {
  CreateOrderInput,
  CreateOrderResult,
  CustomerSnapshot,
  DeliverySnapshot,
  StoredOrder,
} from '../types/order.types.js';

const ORDERS_COLLECTION = 'orders';
const ORDER_ITEMS_COLLECTION = 'order_items';

// In-memory store for unit test suites and mock mode
const inMemoryOrders = new Map<string, StoredOrder>();

export class OrderService {
  private useMemory: boolean;
  private branchesService: BranchesService;
  private inventoryService: InventoryService;
  private pricingEngine: PricingEngine;
  private orderNumberService: OrderNumberService;
  private idempotencyService: IdempotencyService;

  constructor(
    useMemory: boolean = env.NODE_ENV === 'test',
    branchesService: BranchesService = defaultBranchesService,
    inventoryService: InventoryService = defaultInventoryService,
    pricingEngine: PricingEngine = defaultPricingEngine,
    orderNumberService: OrderNumberService = defaultOrderNumberService,
    idempotencyService: IdempotencyService = defaultIdempotencyService
  ) {
    this.useMemory = useMemory;
    this.branchesService = branchesService;
    this.inventoryService = inventoryService;
    this.pricingEngine = pricingEngine;
    this.orderNumberService = orderNumberService;
    this.idempotencyService = idempotencyService;
  }

  /**
   * Creates a new immutable, server-priced order.
   */
  async createOrder(
    tenantId: string,
    clientId: string,
    input: CreateOrderInput,
    idempotencyKey?: string
  ): Promise<CreateOrderResult> {
    const requestHash = idempotencyKey ? generateRequestFingerprint(input) : '';

    // 1. Idempotency Check
    if (idempotencyKey) {
      const cachedResult = await this.idempotencyService.checkIdempotency(
        tenantId,
        clientId,
        idempotencyKey,
        requestHash
      );

      if (cachedResult) {
        return cachedResult;
      }
    }

    // 2. Branch Validation
    const branch = await this.branchesService.getBranchById(tenantId, input.branch_id);
    if (!branch.is_active) {
      throw new ProductUnavailableError(`Branch '${input.branch_id}' is currently inactive`);
    }

    // 3. Pre-check Product Availability & Inventory
    for (const item of input.items) {
      const availability = await this.inventoryService.checkProductAvailability(
        tenantId,
        item.product_id,
        input.branch_id
      );

      if (!availability.available) {
        if (availability.reason === 'not_found') {
          throw new NotFoundError(`Product '${item.product_id}' not found`);
        }
        throw new ProductUnavailableError(
          `Product '${item.product_id}' is not available for branch '${input.branch_id}'. Reason: ${availability.reason}`
        );
      }
    }

    // 4. Server-Side Authoritative Pricing Calculation
    const pricing = await this.pricingEngine.calculateOrderPricing({
      tenantId,
      branchId: input.branch_id,
      orderType: input.order_type,
      items: input.items,
      couponCode: input.coupon_code,
      promotionId: input.promotion_id,
      delivery: input.delivery
        ? {
            zone_id: input.delivery.zone_id,
            address: input.delivery.address || input.customer?.address,
          }
        : undefined,
    });

    // 5. Generate Atomic Order Number
    const orderNumber = await this.orderNumberService.generateNextOrderNumber(
      tenantId,
      input.branch_id
    );

    const orderId = `ord_${uuidv4().replace(/-/g, '').slice(0, 20)}`;
    const createdAt = new Date().toISOString();

    // 6. Build Immutable Customer & Delivery Snapshots
    const customerSnapshot: CustomerSnapshot = {
      customer_id: input.customer?.customer_id || null,
      name: input.customer?.name || null,
      phone: input.customer?.phone || null,
      address: input.customer?.address || null,
    };

    const deliverySnapshot: DeliverySnapshot = {
      zone_id: input.delivery?.zone_id || null,
      address: input.delivery?.address || input.customer?.address || null,
      delivery_fee: pricing.delivery_fee,
    };

    const storedOrder: StoredOrder = {
      id: orderId,
      tenant_id: tenantId,
      branch_id: input.branch_id,
      order_number: orderNumber,
      order_type: input.order_type,
      status: 'pending',
      payment_status: 'pending',
      payment_method: input.payment_method || 'cash',
      customer_snapshot: customerSnapshot,
      delivery_snapshot: deliverySnapshot,
      pricing_snapshot: pricing,
      items: pricing.items,
      subtotal: pricing.subtotal,
      discount_amount: pricing.discount_total,
      tax_amount: pricing.tax_amount,
      delivery_fee: pricing.delivery_fee,
      total: pricing.grand_total,
      notes: input.notes || null,
      created_by: clientId,
      created_at: createdAt,
      idempotency_key: idempotencyKey || undefined,
    };

    // 7. Atomic Database Persistence
    if (this.useMemory) {
      inMemoryOrders.set(orderId, storedOrder);
    } else {
      try {
        const db = getFirestoreDb();
        const batch = db.batch();

        const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);
        batch.set(orderRef, storedOrder);

        // Store line items in order_items collection for backward compatibility with POS views
        for (const item of pricing.items) {
          const itemRef = db.collection(ORDER_ITEMS_COLLECTION).doc();
          batch.set(itemRef, {
            order_id: orderId,
            tenant_id: tenantId,
            branch_id: input.branch_id,
            menu_item_id: item.product_id,
            name: item.name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            addons: item.addons,
            addons_total: item.addons_total,
            line_subtotal: item.line_subtotal,
            line_total: item.line_total,
            status: 'pending',
            created_at: createdAt,
          });
        }

        await batch.commit();
      } catch (err) {
        inMemoryOrders.set(orderId, storedOrder);
      }
    }

    // 8. Construct Clean Public API Result
    const result: CreateOrderResult = {
      order_id: orderId,
      order_number: orderNumber,
      status: 'pending',
      payment_status: 'pending',
      pricing: {
        subtotal: pricing.subtotal,
        discount_total: pricing.discount_total,
        delivery_fee: pricing.delivery_fee,
        tax_rate: pricing.tax_rate,
        tax_amount: pricing.tax_amount,
        grand_total: pricing.grand_total,
        currency: pricing.currency,
      },
      items_count: pricing.items.length,
      created_at: createdAt,
    };

    // 9. Save Idempotency Record
    if (idempotencyKey) {
      await this.idempotencyService.saveIdempotency(
        tenantId,
        clientId,
        idempotencyKey,
        requestHash,
        orderId,
        result
      );
    }

    return result;
  }

  /**
   * Fetch an immutable order by ID, ensuring tenant isolation.
   */
  async getOrderById(tenantId: string, orderId: string): Promise<StoredOrder | null> {
    if (this.useMemory) {
      const order = inMemoryOrders.get(orderId);
      if (order && order.tenant_id === tenantId) {
        return order;
      }
      return null;
    }

    try {
      const db = getFirestoreDb();
      const doc = await db.collection(ORDERS_COLLECTION).doc(orderId).get();
      if (doc.exists) {
        const data = doc.data() as StoredOrder;
        if (data.tenant_id === tenantId) {
          return data;
        }
      }
      return null;
    } catch (_) {
      const order = inMemoryOrders.get(orderId);
      if (order && order.tenant_id === tenantId) {
        return order;
      }
      return null;
    }
  }

  clearMemory() {
    inMemoryOrders.clear();
  }
}

export const defaultOrderService = new OrderService();
