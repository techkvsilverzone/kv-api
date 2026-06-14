import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { setAuthCookie, clearAuthCookie } from '../utils/authCookie';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  public signup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.userService.signup(req.body);
      setAuthCookie(res, result.token);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.userService.login(req.body);
      setAuthCookie(res, result.token);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public logout = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      clearAuthCookie(res);
      res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  };

  public getMe = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.userService.getProfile(req.user!._id.toString());
      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  };

  public updateMe = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.userService.updateProfile(req.user!._id.toString(), req.body);
      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  };

  public forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Logic for forgot password (omitted for brevity, would usually involves email service)
      res.status(200).json({ message: 'Password reset link sent to your email' });
    } catch (error) {
      next(error);
    }
  };

  // ── Address book ─────────────────────────────────────────────────────

  public getAddresses = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const addresses = await this.userService.getAddresses(req.user!._id.toString());
      res.status(200).json(addresses);
    } catch (error) {
      next(error);
    }
  };

  public addAddress = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const address = await this.userService.addAddress(req.user!._id.toString(), req.body);
      res.status(201).json(address);
    } catch (error) {
      next(error);
    }
  };

  public updateAddress = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const address = await this.userService.updateAddress(
        req.user!._id.toString(),
        req.params.id as string,
        req.body,
      );
      res.status(200).json(address);
    } catch (error) {
      next(error);
    }
  };

  public deleteAddress = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.userService.deleteAddress(req.user!._id.toString(), req.params.id as string);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  public getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const users = await this.userService.getAllUsers();
      res.status(200).json(users);
    } catch (error) {
      next(error);
    }
  };

  public changePassword = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requesterUserId = req.user!._id.toString();
      const targetUserId = Array.isArray(req.params.userId)
        ? req.params.userId[0]
        : req.params.userId;
      const { newPassword } = req.body;

      if (!targetUserId) {
        res.status(400).json({ message: 'Target user id is required' });
        return;
      }

      const result = await this.userService.changePassword(requesterUserId, targetUserId, newPassword);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
