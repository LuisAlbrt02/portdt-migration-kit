import { NextFunction, Request, Response } from 'express';

export interface AuthenticatedRequest extends Request {
  upstreamAuthorization?: string;
}

export function requireBearerToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authorization = req.header('authorization');

  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    res.status(401).json({ error: 'Bearer token is required' });
    return;
  }

  req.upstreamAuthorization = authorization;
  next();
}
