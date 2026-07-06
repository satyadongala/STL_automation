import { Router } from 'express';
import { WorkflowController } from '../controllers/workflow.controller';

const router = Router();

// Workflows scoped to a project
router.get('/projects/:projectId/workflows', WorkflowController.getWorkflows);
router.post('/projects/:projectId/workflows', WorkflowController.createWorkflow);

// Workflow operations
router.get('/workflows/:id', WorkflowController.getWorkflow);
router.put('/workflows/:id', WorkflowController.updateWorkflow);
router.put('/workflows/:id/definition', WorkflowController.updateWorkflowDefinition);
router.post('/workflows/:id/convert-linear', WorkflowController.convertLinearToDefinition);
router.delete('/workflows/:id', WorkflowController.deleteWorkflow);

// Workflow Test Cases mapping
router.post('/workflows/:id/test-cases', WorkflowController.addTestCaseToWorkflow);
router.put('/workflows/:id/test-cases/order', WorkflowController.updateWorkflowTestCasesOrder);
router.delete('/workflows/:id/test-cases/:relationId', WorkflowController.removeTestCaseFromWorkflow);

// Execution
router.post('/workflows/:id/execute', WorkflowController.executeWorkflow);

export default router;
