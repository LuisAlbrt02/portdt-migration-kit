import cors from 'cors';
import express from 'express';

import authRoutes from './routes/authRoutes';
import meterRoutes from './routes/metersRoutes';
import seriesRoutes from './routes/seriesRoutes';
import boatRoutes from './routes/boatRoutes';

const app = express();

app.use(
  cors({
    origin:
      process.env.FRONTEND_URL ||
      'http://localhost:3000',
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/meters', meterRoutes);
app.use('/api/series', seriesRoutes);

/*
 * Port Digital Twin boat endpoints.
 *
 * GET /api/boats
 * GET /api/boats/geofence
 */
app.use('/api/boats', boatRoutes);

/*
 * Keep this LAST.
 *
 * Any route registered below this middleware
 * would never be reached.
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.originalUrl,
  });
});

export default app;