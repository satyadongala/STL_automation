import { Router } from 'express';
import {
  getEnvironments,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment
} from '../controllers/environment.controller';

const router = Router();

router.get('/', getEnvironments);
router.post('/', createEnvironment);
router.put('/:id', updateEnvironment);
router.delete('/:id', deleteEnvironment);

export default router;
