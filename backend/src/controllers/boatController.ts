import type {
  Request,
  Response,
} from 'express';

import {
  getBoatMonitorLastPoll,
  getBoatSnapshot,
} from '../services/boatMonitor.service';

import {
  getPortGeofence,
} from '../services/boatGeofence.service';

export function getBoats(
  _req: Request,
  res: Response
): void {
  const lastPollAt =
    getBoatMonitorLastPoll();

  const boats =
    getBoatSnapshot();

  console.log(
    `[BOATS] GET /api/boats -> ${boats.length} boats`
  );

  res.json({
    lastPollAt,
    boats,
  });
}

export function getGeofence(
  _req: Request,
  res: Response
): void {
  console.log(
    '[BOATS] GET /api/boats/geofence'
  );

  res.json(
    getPortGeofence()
  );
}