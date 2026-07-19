import { Request, Response, NextFunction } from 'express';
import { ReturnService } from '../services/return.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export class ReturnController {
  private returnService: ReturnService;

  constructor() {
    this.returnService = new ReturnService();
  }

  public createReturn = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const returnRequest = await this.returnService.createReturn(req.user!._id.toString(), req.body);
      res.status(201).json(returnRequest);
    } catch (error) {
      next(error);
    }
  };

  public getReturnPolicy = (_req: Request, res: Response): void => {
    res.status(200).json(this.returnService.getReturnPolicy());
  };

  public getMyReturns = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const returns = await this.returnService.getMyReturns(req.user!._id.toString());
      res.status(200).json(returns);
    } catch (error) {
      next(error);
    }
  };

  public getAllReturns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const returns = await this.returnService.getAllReturns();
      res.status(200).json(returns);
    } catch (error) {
      next(error);
    }
  };

  public updateReturnStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, refundAmount } = req.body;
      const updated = await this.returnService.updateReturnStatus(
        req.params.id as string,
        status,
        Number(refundAmount || 0),
      );
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  };

  // ── Admin: video review ─────────────────────────────────────────────

  public streamReturnVideo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { filePath, mimeType } = await this.returnService.getReturnVideoFile(req.params.id as string);
      res.setHeader('Content-Type', mimeType);
      res.sendFile(filePath);
    } catch (error) {
      next(error);
    }
  };

  public listUnmatchedVideos = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const videos = await this.returnService.getUnmatchedVideos();
      res.status(200).json(videos);
    } catch (error) {
      next(error);
    }
  };

  public streamUnmatchedVideo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { filePath, mimeType } = await this.returnService.getUnmatchedVideoFile(req.params.id as string);
      res.setHeader('Content-Type', mimeType);
      res.sendFile(filePath);
    } catch (error) {
      next(error);
    }
  };

  public linkUnmatchedVideo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const updated = await this.returnService.linkUnmatchedVideo(
        req.params.id as string,
        req.body?.returnId,
      );
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  };
}
