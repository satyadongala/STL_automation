import { Request, Response } from 'express';
import { GeneratorService } from '../services/generator.service';

export class GeneratorController {
  public static async getPreview(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const preview = await GeneratorService.generatePreview(projectId);
      res.json(preview);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  public static async downloadZip(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      // Note: The service handles streaming directly to the response
      await GeneratorService.downloadProjectAsZip(projectId, res);
    } catch (error: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  }
}
