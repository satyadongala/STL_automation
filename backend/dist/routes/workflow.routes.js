"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const workflow_controller_1 = require("../controllers/workflow.controller");
const router = (0, express_1.Router)();
// Workflows scoped to a project
router.get('/projects/:projectId/workflows', workflow_controller_1.WorkflowController.getWorkflows);
router.post('/projects/:projectId/workflows', workflow_controller_1.WorkflowController.createWorkflow);
// Workflow operations
router.get('/workflows/:id', workflow_controller_1.WorkflowController.getWorkflow);
router.put('/workflows/:id', workflow_controller_1.WorkflowController.updateWorkflow);
router.put('/workflows/:id/definition', workflow_controller_1.WorkflowController.updateWorkflowDefinition);
router.post('/workflows/:id/convert-linear', workflow_controller_1.WorkflowController.convertLinearToDefinition);
router.delete('/workflows/:id', workflow_controller_1.WorkflowController.deleteWorkflow);
// Workflow Test Cases mapping
router.post('/workflows/:id/test-cases', workflow_controller_1.WorkflowController.addTestCaseToWorkflow);
router.put('/workflows/:id/test-cases/order', workflow_controller_1.WorkflowController.updateWorkflowTestCasesOrder);
router.delete('/workflows/:id/test-cases/:relationId', workflow_controller_1.WorkflowController.removeTestCaseFromWorkflow);
// Execution
router.post('/workflows/:id/execute', workflow_controller_1.WorkflowController.executeWorkflow);
exports.default = router;
