import { Router } from 'express';
import { GeneratorController } from '../controllers/generator.controller';

const router = Router();

router.get('/:projectId/generate/preview', GeneratorController.getPreview);
router.get('/:projectId/generate/download', GeneratorController.downloadZip);

export default router;
