import { Request, Response } from 'express';
import axios from 'axios';

import {
  DataLakeSeriesRequest,
  getDataLakeSeries,
} from '../services/series.service';

export async function getSeriesData(
  req: Request,
  res: Response
): Promise<void> {
  console.log('✅ POST /api/series/data_lake reached');

  const authorization = req.headers.authorization;

  if (!authorization) {
    res.status(401).json({
      error: 'Authorization header is required',
    });
    return;
  }

  const payload = req.body as DataLakeSeriesRequest;

  if (
    !payload?.start_dtm ||
    !payload?.end_dtm ||
    !Array.isArray(payload?.series)
  ) {
    res.status(400).json({
      error: 'Invalid series request',
    });
    return;
  }

  try {
    console.log(
      '➡️ Sending to Atlas:',
      JSON.stringify(payload, null, 2)
    );

    const data = await getDataLakeSeries(
    authorization,
    payload
    );

    console.log('✅ Atlas series response received');

    console.log(
    '⬅️ Atlas response:',
    JSON.stringify(data, null, 2)
    );

    res.json(data);

  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error('❌ Atlas series error:', {
        status: error.response?.status,
        data: error.response?.data,
        baseURL: error.config?.baseURL,
        url: error.config?.url,
        method: error.config?.method,
      });

      res.status(error.response?.status || 500).json({
        error: 'Failed to get series data',
        details: error.response?.data,
      });

      return;
    }

    console.error('❌ Unexpected series error:', error);

    res.status(500).json({
      error: 'Failed to get series data',
    });
  }
}