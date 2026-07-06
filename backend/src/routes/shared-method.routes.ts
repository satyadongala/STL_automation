import { Router } from 'express';
import {
  getProjectSharedMethods,
  getSharedMethod,
  createSharedMethod,
  updateSharedMethod,
  deleteSharedMethod
} from '../controllers/shared-method.controller';

const router = Router();

router.get('/projects/:projectId/shared-methods', getProjectSharedMethods);
router.post('/projects/:projectId/shared-methods', createSharedMethod);
router.get('/shared-methods/:id', getSharedMethod);
router.put('/shared-methods/:id', updateSharedMethod);
router.delete('/shared-methods/:id', deleteSharedMethod);

export default router;
