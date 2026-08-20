import { Request, Response } from 'express';

export function getHealthCheck(req: Request, res: Response): void {
  res.status(200).json({
    success: true,
    service: 'rms-api',
    version: 'v1',
  });
}
