import { Router } from 'express';
import { branchesRouter } from './branches.routes.js';
import { categoriesRouter } from './categories.routes.js';
import { deliveryRouter } from './delivery.routes.js';
import { healthRouter } from './health.routes.js';
import { menuRouter } from './menu.routes.js';
import { offersRouter } from './offers.routes.js';
import { ordersRouter } from './orders.routes.js';
import { pricingRouter } from './pricing.routes.js';
import { productsRouter } from './products.routes.js';
import { settingsRouter } from './settings.routes.js';

export const v1Router = Router();

// Mount Health Route (Public)
v1Router.use('/', healthRouter);

// Mount Catalog, Pricing, Delivery, Offers, Settings & Orders Routes
v1Router.use('/', menuRouter);
v1Router.use('/', categoriesRouter);
v1Router.use('/', productsRouter);
v1Router.use('/', branchesRouter);
v1Router.use('/', deliveryRouter);
v1Router.use('/', offersRouter);
v1Router.use('/', settingsRouter);
v1Router.use('/', pricingRouter);
v1Router.use('/', ordersRouter);
