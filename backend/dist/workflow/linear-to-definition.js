"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLinearWorkflowDefinition = buildLinearWorkflowDefinition;
function buildLinearWorkflowDefinition(workflowId, workflowName, testCaseIds) {
    return {
        schemaVersion: '1.0.0',
        id: workflowId,
        name: workflowName,
        root: {
            id: 'root',
            type: 'group',
            name: workflowName,
            children: testCaseIds.map((testCaseId, index) => ({
                id: `tc-ref-${index}`,
                type: 'testCaseRef',
                name: `Step ${index + 1}`,
                testCaseId,
            })),
        },
    };
}
