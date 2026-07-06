import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import projectRoutes from './routes/project.routes';
import environmentRoutes from './routes/environment.routes';
import testCaseRoutes from './routes/testcase.routes';
import executionRoutes from './routes/execution.routes';
import workflowRoutes from './routes/workflow.routes';
import generatorRoutes from './routes/generator.routes';
import sharedMethodRoutes from './routes/shared-method.routes';

const app = express();

app.use(cors());
app.use(express.json());

// Serve Playwright HTML + Allure reports
app.use('/api/reports/html', express.static(path.join(process.cwd(), 'reports', 'html')));
app.use('/api/reports/allure', express.static(path.join(process.cwd(), 'reports', 'allure')));

// Routes
app.use('/api/projects', projectRoutes);
app.use('/api/environments', environmentRoutes);
app.use('/api/test-cases', testCaseRoutes);
app.use('/api/executions', executionRoutes);
app.use('/api', workflowRoutes); // Use /api as prefix for workflow routes
app.use('/api/projects', generatorRoutes); // Generator routes use /projects/:projectId
app.use('/api', sharedMethodRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Serve built frontend (Docker / production)
const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
} else {
  console.warn(`[SYS] No frontend at ${publicDir} — API only mode`);
}

export default app;
