"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProject = exports.updateProject = exports.createProject = exports.getProjectById = exports.getProjects = void 0;
const db_1 = __importDefault(require("../db"));
const playwright_setup_1 = require("../services/playwright-setup");
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
                variables: variables ? JSON.stringify(variables) : '{}'
            }
        });
        if (normalizedProjectType === 'UI') {
            (0, playwright_setup_1.ensurePlaywrightBrowsersBackground)();
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
        res.json({ message: 'Project deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.deleteProject = deleteProject;
