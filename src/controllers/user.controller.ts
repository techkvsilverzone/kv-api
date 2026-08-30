import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { OtpService } from '../services/otp.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { setAuthCookie, clearAuthCookie } from '../utils/authCookie';
import Logger from '../utils/logger';

export class UserController {
  private userService: UserService;
  private otpService: OtpService;

  constructor() {
    this.userService = new UserService();
    this.otpService = new OtpService();
  }

  public signup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.userService.signup(req.body);
      setAuthCookie(res, result.token);

      // Item 1: fire the first-time mobile verification code. Best-effort — the account is
      // already created and the customer already has a session; a dispatch failure here
      // shouldn't fail signup itself (they can retry via "Verify phone" in Profile).
      let phoneVerification: { message: string; channel: 'whatsapp' | 'email' } | undefined;
      try {
        const userId = (result.user as { _id?: string })?._id;
        if (userId) {
          phoneVerification = await this.otpService.requestPhoneVerification(userId);
        }
      } catch (otpError) {
        Logger.error(`Signup phone verification dispatch failed: ${otpError instanceof Error ? otpError.message : String(otpError)}`);
      }

      res.status(201).json({ ...result, phoneVerification });
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

  public requestLoginOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.otpService.requestLoginOtp(req.body?.email);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public verifyLoginOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.otpService.verifyLoginOtp(req.body?.email, req.body?.code);
      setAuthCookie(res, result.token);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /** Item 1: request a WhatsApp/email code to verify the calling (authenticated) user's own
   * phone number — normally triggered right after signup. */
  public requestPhoneVerification = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.otpService.requestPhoneVerification(req.user!._id.toString());
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public verifyPhoneOtp = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.otpService.verifyPhoneOtp(req.user!._id.toString(), req.body?.code);
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
      const result = await this.otpService.requestPasswordReset(req.body?.email);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.otpService.resetPassword(
        req.body?.email,
        req.body?.code,
        req.body?.newPassword,
      );
      res.status(200).json(result);
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

  public adminUpdateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.userService.updateProfile(req.params.id as string, req.body);
      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  };

  public deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.userService.deleteUser(req.params.id as string);
      res.status(200).json({ status: 'success' });
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
