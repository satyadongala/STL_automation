"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProject = exports.updateProject = exports.createProject = exports.getProjectById = exports.getProjects = void 0;
const db_1 = __importDefault(require("../db"));
const playwright_project_init_1 = require("../services/playwright-project-init");
const getProjects = async (req, res) => {
    try {
        const projects = await db_1.default.project.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(projects);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getProjects = getProjects;
const getProjectById = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await db_1.default.project.findUnique({
            where: { id },
            include: { environments: true, testCases: { orderBy: { sortOrder: 'asc' } } }
        });
        if (!project)
            return res.status(404).json({ error: 'Project not found' });
        res.json(project);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getProjectById = getProjectById;
const createProject = async (req, res) => {
    try {
        const { projectType, name, description, baseUrl, defaultHeaders, variables } = req.body;
        const normalizedProjectType = projectType === 'UI' ? 'UI' : 'API';
        if (!name || !baseUrl) {
            return res.status(400).json({ error: 'Name and Base URL are required' });
        }
        const project = await db_1.default.project.create({
            data: {
                projectType: normalizedProjectType,
                name,
                description,
                baseUrl,
                defaultHeaders: defaultHeaders ? JSON.stringify(defaultHeaders) : '{}',
                variables: variables ? JSON.stringify(variables) : '{}',
                playwrightReady: false,
            }
        });
        if (normalizedProjectType === 'UI') {
            try {
                console.log(`[SYS] Initializing Playwright for UI project ${project.id}...`);
                await (0, playwright_project_init_1.initPlaywrightProject)(project.id, { baseUrl, name });
                const ready = await db_1.default.project.update({
                    where: { id: project.id },
                    data: { playwrightReady: true },
                });
                return res.status(201).json(ready);
            }
            catch (err) {
                (0, playwright_project_init_1.removeProjectWorkspace)(project.id);
                await db_1.default.project.delete({ where: { id: project.id } });
                return res.status(500).json({
                    error: `Playwright init failed (npm init playwright@latest): ${err.message}`,
                });
            }
        }
        res.status(201).json(project);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.createProject = createProject;
const updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const { projectType, name, description, baseUrl, defaultHeaders, variables } = req.body;
        const normalizedProjectType = projectType === 'UI' ? 'UI' : projectType === 'API' ? 'API' : undefined;
        const project = await db_1.default.project.update({
            where: { id },
            data: {
                projectType: normalizedProjectType,
                name,
                description,
                baseUrl,
                defaultHeaders: defaultHeaders ? JSON.stringify(defaultHeaders) : undefined,
                variables: variables ? JSON.stringify(variables) : undefined
            }
        });
        res.json(project);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.updateProject = updateProject;
const deleteProject = async (req, res) => {
    try {
        const { id } = req.params;
        await db_1.default.project.delete({ where: { id } });
        (0, playwright_project_init_1.removeProjectWorkspace)(id);
        res.json({ message: 'Project deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.deleteProject = deleteProject;
