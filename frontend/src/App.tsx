import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sidebar } from './components/Sidebar';
import { ToastContainer } from './components/ToastContainer';
import { Dashboard } from './pages/Dashboard';
import { ProjectsList } from './pages/ProjectsList';
import { ProjectDetails } from './pages/ProjectDetails';
import { TestCaseForm } from './pages/TestCaseForm';
import { EnvironmentsPage } from './pages/EnvironmentsPage';
import { ExecutionConsole } from './pages/ExecutionConsole';
import { HistoryPage } from './pages/HistoryPage';
import { ReportViewer } from './pages/ReportViewer';
import { WorkflowDetails } from './pages/WorkflowDetails';
import { ProjectGenerator } from './pages/ProjectGenerator';
import { SharedMethodsList } from './pages/SharedMethodsList';
import { SharedMethodForm } from './pages/SharedMethodForm';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false
    }
  }
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="flex h-screen w-screen overflow-hidden bg-primary-bg text-text-primary">
          {/* Sidebar */}
          <Sidebar />

          {/* Main Layout Area */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-transparent">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects" element={<ProjectsList />} />
              <Route path="/projects/:id" element={<ProjectDetails />} />
              <Route path="/projects/:projectId/test-case/new" element={<TestCaseForm />} />
              <Route path="/projects/:projectId/test-case/:id" element={<TestCaseForm />} />
              <Route path="/projects/:projectId/workflows/:workflowId" element={<WorkflowDetails />} />
              <Route path="/projects/:id/generate" element={<ProjectGenerator />} />
              <Route path="/environments" element={<EnvironmentsPage />} />
              <Route path="/shared-methods" element={<SharedMethodsList />} />
              <Route path="/projects/:projectId/shared-methods/new" element={<SharedMethodForm />} />
              <Route path="/projects/:projectId/shared-methods/:id" element={<SharedMethodForm />} />
              <Route path="/execution/:runId" element={<ExecutionConsole />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/report/:runId" element={<ReportViewer />} />
            </Routes>
          </main>

          {/* Sleek Notifications Container */}
          <ToastContainer />
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
