import { Router } from 'express';
import {
  triggerExecution,
  getExecutions,
  getExecutionById,
  getExecutionSpans,
  stopExecution,
  getDashboardStats
} from '../controllers/execution.controller';

const router = Router();

router.post('/run', triggerExecution);
router.get('/runs', getExecutions);
router.get('/stats', getDashboardStats);
router.get('/runs/:id', getExecutionById);
router.get('/runs/:id/spans', getExecutionSpans);
router.post('/runs/:id/stop', stopExecution);

export default router;
