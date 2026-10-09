import { Request, Response } from 'express';
import axios from 'axios';

import { login as loginService } from '../services/auth.service';

export async function login(
  req: Request,
  res: Response
): Promise<void> {
  const username =
    req.body?.username ??
    req.body?.email;

  const password = req.body?.password;

  if (!username || !password) {
    res.status(400).json({
      error: 'Username and password are required',
    });

    return;
  }

  try {
    const data = await loginService(
      username,
      password
    );

    res.json(data);
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const status =
        error.response?.status || 500;

      res.status(status).json({
        error:
          error.response?.data ||
          'Authentication failed',
      });

      return;
    }

    res.status(500).json({
      error: 'Authentication failed',
    });
  }
}