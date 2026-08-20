import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../types/api.types.js';
import { defaultWebhookService } from '../services/webhook.service.js';
import { sendSuccess } from '../utils/response.js';
export const createWebhookSubscription = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const sub = await defaultWebhookService.createSubscription(req.apiClient!.tenantId, req.body.url, req.body.events); const { secret, ...safe } = sub; sendSuccess(res, { ...safe, secret }, 201); } catch (e) { next(e); } };
export const listWebhookSubscriptions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { sendSuccess(res, await defaultWebhookService.listSubscriptions(req.apiClient!.tenantId)); } catch (e) { next(e); } };
export const listWebhookDeliveries = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { sendSuccess(res, await defaultWebhookService.listDeliveries(req.apiClient!.tenantId)); } catch (e) { next(e); } };
