import { Router } from 'express';
import { getSeriesData } from '../controllers/seriesController';

const router = Router();

router.post('/data_lake', getSeriesData);

export default router;