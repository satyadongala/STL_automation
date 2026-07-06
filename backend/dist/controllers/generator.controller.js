"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeneratorController = void 0;
const generator_service_1 = require("../services/generator.service");
class GeneratorController {
    static async getPreview(req, res) {
        try {
            const { projectId } = req.params;
            const preview = await generator_service_1.GeneratorService.generatePreview(projectId);
            res.json(preview);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async downloadZip(req, res) {
        try {
            const { projectId } = req.params;
            // Note: The service handles streaming directly to the response
            await generator_service_1.GeneratorService.downloadProjectAsZip(projectId, res);
        }
        catch (error) {
            if (!res.headersSent) {
                res.status(500).json({ error: error.message });
            }
        }
    }
}
exports.GeneratorController = GeneratorController;
