import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedRequest } from '../types/api.types.js';

export function requestIdMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const incomingId = req.header('X-Request-ID');
  const requestId = incomingId && incomingId.trim().length > 0 ? incomingId.trim() : uuidv4();
  
  req.requestId = requestId;
  req.startTime = Date.now();
  
  res.setHeader('X-Request-ID', requestId);
  next();
}
