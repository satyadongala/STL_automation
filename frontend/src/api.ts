import axios from 'axios';
import { API_BASE_URL } from './config';

export { API_BASE_URL };

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const api = {
  // Projects
  getProjects: () => apiClient.get('/projects').then(res => res.data),
  getProject: (id: string) => apiClient.get(`/projects/${id}`).then(res => res.data),
  createProject: (data: any) =>
    apiClient.post('/projects', data, { timeout: 300000 }).then((res) => res.data),
  updateProject: (id: string, data: any) => apiClient.put(`/projects/${id}`, data).then(res => res.data),
  deleteProject: (id: string) => apiClient.delete(`/projects/${id}`).then(res => res.data),

  // Environments
  getEnvironments: (projectId: string) => apiClient.get(`/environments?projectId=${projectId}`).then(res => res.data),
  createEnvironment: (data: any) => apiClient.post('/environments', data).then(res => res.data),
  updateEnvironment: (id: string, data: any) => apiClient.put(`/environments/${id}`, data).then(res => res.data),
  deleteEnvironment: (id: string) => apiClient.delete(`/environments/${id}`).then(res => res.data),

  // Test Cases
  getTestCases: (projectId: string) => apiClient.get(`/test-cases?projectId=${projectId}`).then(res => res.data),
  getTestCase: (id: string) => apiClient.get(`/test-cases/${id}`).then(res => res.data),
  createTestCase: (data: any) => apiClient.post('/test-cases', data).then(res => res.data),
  updateTestCase: (id: string, data: any) => apiClient.put(`/test-cases/${id}`, data).then(res => res.data),
  deleteTestCase: (id: string) => apiClient.delete(`/test-cases/${id}`).then(res => res.data),
  reorderTestCases: (orders: { id: string; sortOrder: number }[]) => apiClient.put('/test-cases/reorder', { orders }).then(res => res.data),

  // Workflows
  getWorkflows: (projectId: string) => apiClient.get(`/projects/${projectId}/workflows`).then(res => res.data),
  getWorkflow: (id: string) => apiClient.get(`/workflows/${id}`).then(res => res.data),
  createWorkflow: (projectId: string, data: any) => apiClient.post(`/projects/${projectId}/workflows`, data).then(res => res.data),
  updateWorkflow: (id: string, data: any) => apiClient.put(`/workflows/${id}`, data).then(res => res.data),
  updateWorkflowDefinition: (id: string, definition: object) =>
    apiClient.put(`/workflows/${id}/definition`, { definition }).then(res => res.data),
  convertWorkflowLinearToDefinition: (id: string) =>
    apiClient.post(`/workflows/${id}/convert-linear`).then(res => res.data),
  deleteWorkflow: (id: string) => apiClient.delete(`/workflows/${id}`).then(res => res.data),
  addTestCaseToWorkflow: (workflowId: string, testCaseId: string) => apiClient.post(`/workflows/${workflowId}/test-cases`, { testCaseId }).then(res => res.data),
  updateWorkflowTestCasesOrder: (workflowId: string, relationIds: string[]) => apiClient.put(`/workflows/${workflowId}/test-cases/order`, { relationIds }).then(res => res.data),
  removeTestCaseFromWorkflow: (workflowId: string, relationId: string) => apiClient.delete(`/workflows/${workflowId}/test-cases/${relationId}`).then(res => res.data),
  executeWorkflow: (
    workflowId: string,
    environmentId?: string | null,
    options?: { headed?: boolean; workers?: number; video?: 'on' | 'off' | 'failed'; trace?: 'on' | 'off' | 'failed'; screenshot?: 'on' | 'off' | 'failed' }
  ) =>
    apiClient
      .post(`/workflows/${workflowId}/execute`, {
        environmentId,
        headed: options?.headed,
        workers: options?.workers,
        video: options?.video,
        trace: options?.trace,
        screenshot: options?.screenshot,
      })
      .then((res) => res.data),

  // Generator
  getProjectPreview: (projectId: string) => apiClient.get(`/projects/${projectId}/generate/preview`).then(res => res.data),
  getProjectDownloadUrl: (projectId: string) => `${API_BASE_URL}/projects/${projectId}/generate/download`,

  // Executions
  triggerRun: (data: {
    projectId: string;
    environmentId?: string | null;
    workflowId?: string | null;
    testCaseIds?: string[];
    grepPattern?: string;
    headed?: boolean;
    workers?: number;
    video?: 'on' | 'off' | 'failed';
    trace?: 'on' | 'off' | 'failed';
    screenshot?: 'on' | 'off' | 'failed';
  }) =>
    apiClient.post('/executions/run', data).then(res => res.data),
  getExecutions: (projectId?: string) => apiClient.get(`/executions/runs${projectId ? `?projectId=${projectId}` : ''}`).then(res => res.data),
  getExecution: (id: string) => apiClient.get(`/executions/runs/${id}`).then(res => res.data),
  getExecutionSpans: (id: string) => apiClient.get(`/executions/runs/${id}/spans`).then(res => res.data),
  stopExecution: (id: string) => apiClient.post(`/executions/runs/${id}/stop`).then(res => res.data),
  getStats: () => apiClient.get('/executions/stats').then(res => res.data),

  // Shared Methods
  getProjectSharedMethods: (projectId: string) => apiClient.get(`/projects/${projectId}/shared-methods`).then(res => res.data),
  getSharedMethod: (id: string) => apiClient.get(`/shared-methods/${id}`).then(res => res.data),
  createSharedMethod: (projectId: string, data: any) => apiClient.post(`/projects/${projectId}/shared-methods`, data).then(res => res.data),
  updateSharedMethod: (id: string, data: any) => apiClient.put(`/shared-methods/${id}`, data).then(res => res.data),
  deleteSharedMethod: (id: string) => apiClient.delete(`/shared-methods/${id}`).then(res => res.data),

  getLiveBrowserView: () => apiClient.get('/system/live-browser').then(res => res.data),
};

