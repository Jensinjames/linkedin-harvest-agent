import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, path, query, body } = req;

  // Log request start
  logger.debug(`${method} ${path}`, {
    query,
    body: method !== 'GET' ? body : undefined,
    userId: (req as any).user?.id,
  });

  // Override res.json to capture response
  const originalJson = res.json.bind(res);
  res.json = function(data: any) {
    const duration = Date.now() - start;
    
    // Log response
    logger.info(`${method} ${path} ${res.statusCode} in ${duration}ms`, {
      statusCode: res.statusCode,
      duration,
      userId: (req as any).user?.id,
    });

    return originalJson(data);
  };

  next();
}