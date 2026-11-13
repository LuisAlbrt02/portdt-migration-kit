
import { Request, Response } from 'express';
import axios from 'axios';

import { getDevices } from '../services/devices.service';

export async function getAllDevices(
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
    const devices = await getDevices(authorization);
    res.json(devices);
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 502;

      console.error('ATLAS Devices API error:', {
        status,
        message: error.message,
        response: error.response?.data,
      });

      res.status(status).json({
        error:
          status === 401
            ? 'Unauthorized'
            : 'Failed to get devices',
      });
      return;
    }

    const message =
      error instanceof Error ? error.message : 'Unknown error';

    console.error('Devices service error:', message);

    res.status(500).json({
      error: 'Failed to get devices',
      ...(process.env.NODE_ENV !== 'production'
        ? { detail: message }
        : {}),
    });
  }
}
