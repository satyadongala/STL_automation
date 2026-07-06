"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteEnvironment = exports.updateEnvironment = exports.createEnvironment = exports.getEnvironments = void 0;
const db_1 = __importDefault(require("../db"));
const getEnvironments = async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId)
            return res.status(400).json({ error: 'projectId is required' });
        const environments = await db_1.default.environment.findMany({
            where: { projectId: String(projectId) },
            orderBy: { createdAt: 'desc' }
        });
        res.json(environments);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getEnvironments = getEnvironments;
const createEnvironment = async (req, res) => {
    try {
        const { projectId, name, baseUrl, headers, variables } = req.body;
        if (!projectId || !name || !baseUrl) {
            return res.status(400).json({ error: 'projectId, name, and baseUrl are required' });
        }
        const env = await db_1.default.environment.create({
            data: {
                projectId,
                name,
                baseUrl,
                headers: headers ? JSON.stringify(headers) : '{}',
                variables: variables ? JSON.stringify(variables) : '{}'
            }
        });
        res.status(201).json(env);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.createEnvironment = createEnvironment;
const updateEnvironment = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, baseUrl, headers, variables } = req.body;
        const env = await db_1.default.environment.update({
            where: { id },
            data: {
                name,
                baseUrl,
                headers: headers ? JSON.stringify(headers) : undefined,
                variables: variables ? JSON.stringify(variables) : undefined
            }
        });
        res.json(env);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.updateEnvironment = updateEnvironment;
const deleteEnvironment = async (req, res) => {
    try {
        const { id } = req.params;
        await db_1.default.environment.delete({ where: { id } });
        res.json({ message: 'Environment deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.deleteEnvironment = deleteEnvironment;
