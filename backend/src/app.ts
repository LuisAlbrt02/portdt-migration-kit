import 'dotenv/config';

import cors from 'cors';
import express from 'express';

import authRoutes from './routes/authRoutes';
import meterRoutes from './routes/metersRoutes';
import seriesRoutes from './routes/seriesRoutes';

const app = express();

app.use(
  cors({
    origin:
      process.env.FRONTEND_URL ||
      'http://localhost:3000',
  })
);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'OK' });
});

app.use('/api/auth', authRoutes);
app.use('/api/meters', meterRoutes);
app.use('/api/series', seriesRoutes);

export default app;