import { Request, Response } from 'express';
import axios from 'axios';

import { getMeters } from '../services/meters.service';

export async function getAllMeters(
  req: Request,
  res: Response
): Promise<void> {
  const authorization = req.headers.authorization;

  if (!authorization) {
    res.status(401).json({
      error: 'Authorization header is required',
    });
    return;
  }

  try {
    const meters = await getMeters(authorization);

    res.json(meters);
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;

      console.error(
        'Meters API error:',
        error.response?.data || error.message
      );

      res.status(status).json({
        error:
          status === 401
            ? 'Unauthorized'
            : 'Failed to get meters',
      });

      return;
    }

    res.status(500).json({
      error: 'Failed to get meters',
    });
  }
}