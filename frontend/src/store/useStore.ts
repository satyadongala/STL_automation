import { create } from 'zustand';
import { wsUrl as buildWsUrl } from '../config';

export interface Project {
  id: string;
  projectType?: 'API' | 'UI';
  name: string;
  description?: string;
  baseUrl: string;
  defaultHeaders: string; // JSON string
  variables: string; // JSON string
  createdAt: string;
  updatedAt: string;
}

export interface Environment {
  id: string;
  projectId: string;
  name: string;
  baseUrl: string;
  headers: string;
  variables: string;
}

export interface TestCase {
  id: string;
  projectId: string;
  testType?: 'API' | 'UI';
  name: string;
  description?: string;
  method: string;
  path: string;
  headers: string;
  queryParams: string;
  body?: string;
  assertions: string; // JSON string
  variablesToExtract: string; // JSON string
  uiSteps?: string; // JSON string
  sortOrder: number;
}

export interface ExecutionRun {
  id: string;
  projectId: string;
  environmentId?: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  triggerType: string;
  startedAt: string;
  completedAt?: string;
  summaryPassed: number;
  summaryFailed: number;
  summaryTotal: number;
  durationMs: number;
  rawLogs: string;
  createdAt: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppState {
  projects: Project[];
  selectedProjectId: string | null;
  environments: Environment[];
  testCases: TestCase[];
  executions: ExecutionRun[];
  activeRun: {
    runId: string | null;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | null;
    logs: string[];
    socket: WebSocket | null;
  };
  toasts: Toast[];

  setProjects: (projects: Project[]) => void;
  setSelectedProjectId: (id: string | null) => void;
  setEnvironments: (envs: Environment[]) => void;
  setTestCases: (cases: TestCase[]) => void;
  setExecutions: (runs: ExecutionRun[]) => void;
  
  // Active Run management
  startActiveRun: (runId: string) => void;
  addActiveLog: (log: string) => void;
  updateActiveRunStatus: (status: any) => void;
  setActiveLogs: (logs: string[]) => void;
  clearActiveRun: () => void;

  // Toast notifications
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
}

export const useStore = create<AppState>((set, get) => ({
  projects: [],
  selectedProjectId: null,
  environments: [],
  testCases: [],
  executions: [],
  activeRun: {
    runId: null,
    status: null,
    logs: [],
    socket: null
  },
  toasts: [],

  setProjects: (projects) => set({ projects }),
  setSelectedProjectId: (selectedProjectId) => set({ selectedProjectId }),
  setEnvironments: (environments) => set({ environments }),
  setTestCases: (testCases) => set({ testCases }),
  setExecutions: (executions) => set({ executions }),

  startActiveRun: (runId) => {
    const currentSocket = get().activeRun.socket;
    if (currentSocket) {
      (currentSocket as WebSocket & { intentionalClose?: boolean }).intentionalClose = true;
      currentSocket.close();
    }

    const connect = (attempt = 0) => {
      const ws = new WebSocket(buildWsUrl(runId)) as WebSocket & { intentionalClose?: boolean };
      ws.intentionalClose = false;

      set((state) => ({
        activeRun: {
          ...state.activeRun,
          runId,
          status: state.activeRun.status || 'RUNNING',
          socket: ws,
        },
      }));

      ws.onopen = () => {
        if (attempt > 0) {
          get().addActiveLog('[SYS] Live log stream reconnected.\n');
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'LOG') {
            get().addActiveLog(msg.data);
          } else if (msg.type === 'STATUS') {
            get().updateActiveRunStatus(msg.data);
          }
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };

      ws.onerror = () => {
        if (ws.intentionalClose) return;
        if (attempt === 0) {
          get().addActiveLog('[SYS] Live stream unavailable — loading logs from server…\n');
        }
      };

      ws.onclose = () => {
        if (ws.intentionalClose) return;
        if (attempt < 4) {
          setTimeout(() => connect(attempt + 1), 800 * (attempt + 1));
        }
      };
    };

    set({
      activeRun: {
        runId,
        status: 'RUNNING',
        logs: [],
        socket: null,
      },
    });

    connect();
  },

  addActiveLog: (log) => set((state) => ({
    activeRun: {
      ...state.activeRun,
      logs: [...state.activeRun.logs, log]
    }
  })),

  setActiveLogs: (logs: string[]) => set((state) => ({
    activeRun: {
      ...state.activeRun,
      logs,
    }
  })),

  updateActiveRunStatus: (status) => set((state) => ({
    activeRun: {
      ...state.activeRun,
      status
    }
  })),

  clearActiveRun: () => {
    const ws = get().activeRun.socket as (WebSocket & { intentionalClose?: boolean }) | null;
    if (ws) {
      ws.intentionalClose = true;
      ws.close();
    }
    set({
      activeRun: {
        runId: null,
        status: null,
        logs: [],
        socket: null
      }
    });
  },

  addToast: (message, type = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }]
    }));
    setTimeout(() => {
      get().removeToast(id);
    }, 4000);
  },

  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id)
  }))
}));
