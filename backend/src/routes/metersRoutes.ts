import { Router } from 'express';

import {
  getAllMeters,
} from '../controllers/metersController';

const router = Router();

router.get('/', getAllMeters);

export default router;