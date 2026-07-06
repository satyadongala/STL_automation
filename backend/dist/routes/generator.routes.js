"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const generator_controller_1 = require("../controllers/generator.controller");
const router = (0, express_1.Router)();
router.get('/:projectId/generate/preview', generator_controller_1.GeneratorController.getPreview);
router.get('/:projectId/generate/download', generator_controller_1.GeneratorController.downloadZip);
exports.default = router;
