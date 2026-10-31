import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { NotificationService, notificationService } from '../services/notification.service';

export class NotificationController {
  constructor(private service: NotificationService = notificationService) {}

  public list = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json(await this.service.list(req.user!._id.toString()));
    } catch (error) {
      next(error);
    }
  };

  public markRead = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.markRead(req.user!._id.toString(), String(req.params.id));
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  };

  public markAllRead = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.markAllRead(req.user!._id.toString());
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  };

  public registerToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.registerToken(req.user!._id.toString(), req.body?.token, req.body?.platform);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  };

  public unregisterToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.unregisterToken(req.user!._id.toString(), req.body?.token);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  };
}
