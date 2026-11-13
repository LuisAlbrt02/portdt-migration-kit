import { Router } from 'express';
import { getAllDevices } from '../controllers/devicesController';

const router = Router();

router.get('/', getAllDevices);

export default router;