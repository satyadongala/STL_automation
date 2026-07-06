"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSharedMethod = exports.updateSharedMethod = exports.createSharedMethod = exports.getSharedMethod = exports.getProjectSharedMethods = void 0;
const db_1 = __importDefault(require("../db"));
const getProjectSharedMethods = async (req, res) => {
    try {
        const { projectId } = req.params;
        const methods = await db_1.default.sharedMethod.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(methods);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getProjectSharedMethods = getProjectSharedMethods;
const getSharedMethod = async (req, res) => {
    try {
        const { id } = req.params;
        const method = await db_1.default.sharedMethod.findUnique({
            where: { id }
        });
        if (!method)
            return res.status(404).json({ error: 'Shared Method not found' });
        res.json(method);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getSharedMethod = getSharedMethod;
const createSharedMethod = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { name, description, parameters, uiSteps } = req.body;
        const newMethod = await db_1.default.sharedMethod.create({
            data: {
                projectId,
                name,
                description,
                parameters: parameters ? JSON.stringify(parameters) : '[]',
                uiSteps: uiSteps ? JSON.stringify(uiSteps) : '[]',
            }
        });
        res.status(201).json(newMethod);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.createSharedMethod = createSharedMethod;
const updateSharedMethod = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, parameters, uiSteps } = req.body;
        // Optional: detect circular dependencies before saving
        // But since shared methods cannot currently be embedded in shared methods (based on UI for now), we can omit deep check here,
        // or add a check if we allow useMethod within useMethod.
        const updated = await db_1.default.sharedMethod.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(parameters !== undefined && { parameters: JSON.stringify(parameters) }),
                ...(uiSteps !== undefined && { uiSteps: JSON.stringify(uiSteps) }),
            }
        });
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.updateSharedMethod = updateSharedMethod;
const deleteSharedMethod = async (req, res) => {
    try {
        const { id } = req.params;
        await db_1.default.sharedMethod.delete({
            where: { id }
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.deleteSharedMethod = deleteSharedMethod;
