import { Router } from 'express';
import {
  getTestCases,
  getTestCaseById,
  createTestCase,
  updateTestCase,
  deleteTestCase,
  reorderTestCases
} from '../controllers/testcase.controller';

const router = Router();

router.get('/', getTestCases);
router.get('/:id', getTestCaseById);
router.post('/', createTestCase);
router.put('/reorder', reorderTestCases); // Put reorder before :id to prevent mapping collision
router.put('/:id', updateTestCase);
router.delete('/:id', deleteTestCase);

export default router;
