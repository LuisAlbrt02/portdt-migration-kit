import {
  Router,
} from 'express';

import {
  getBoats,
  getGeofence,
} from '../controllers/boatController';

const router = Router();

router.get(
  '/',
  getBoats
);

router.get(
  '/geofence',
  getGeofence
);

export default router;