"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const project_routes_1 = __importDefault(require("./routes/project.routes"));
const environment_routes_1 = __importDefault(require("./routes/environment.routes"));
const testcase_routes_1 = __importDefault(require("./routes/testcase.routes"));
const execution_routes_1 = __importDefault(require("./routes/execution.routes"));
const workflow_routes_1 = __importDefault(require("./routes/workflow.routes"));
const generator_routes_1 = __importDefault(require("./routes/generator.routes"));
const shared_method_routes_1 = __importDefault(require("./routes/shared-method.routes"));
const system_routes_1 = __importDefault(require("./routes/system.routes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Serve Playwright HTML + Allure reports
app.use('/api/reports/html', express_1.default.static(path_1.default.join(process.cwd(), 'reports', 'html')));
app.use('/api/reports/allure', express_1.default.static(path_1.default.join(process.cwd(), 'reports', 'allure')));
// Routes
app.use('/api/projects', project_routes_1.default);
app.use('/api/environments', environment_routes_1.default);
app.use('/api/test-cases', testcase_routes_1.default);
app.use('/api/executions', execution_routes_1.default);
app.use('/api', workflow_routes_1.default); // Use /api as prefix for workflow routes
app.use('/api/projects', generator_routes_1.default); // Generator routes use /projects/:projectId
app.use('/api', shared_method_routes_1.default);
app.use('/api/system', system_routes_1.default);
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});
// Serve built frontend (Docker / production)
const publicDir = path_1.default.join(__dirname, '..', 'public');
if (fs_1.default.existsSync(publicDir)) {
    app.use(express_1.default.static(publicDir));
    app.get(/^(?!\/api).*/, (_req, res) => {
        res.sendFile(path_1.default.join(publicDir, 'index.html'));
    });
}
else {
    console.warn(`[SYS] No frontend at ${publicDir} — API only mode`);
}
exports.default = app;
