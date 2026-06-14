import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from '../utils/appError';
import { readTokenFromRequest } from '../utils/authCookie';
import { IUser, UserRepository } from '../repositories/user.repository';

export interface AuthRequest extends Request {
  user?: IUser;
}

const userRepository = new UserRepository();

interface JwtPayload {
  id: string;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // Prefer the httpOnly auth cookie; fall back to the Authorization header for
  // API clients (Swagger, mobile).
  const token = readTokenFromRequest(req);

  if (!token) {
    return next(new AppError('You are not logged in! Please log in to get access.', 401));
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

    const currentUser = await userRepository.findById(decoded.id);
    if (!currentUser) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    req.user = currentUser;
    next();
  } catch (error) {
    return next(new AppError('Invalid token. Please log in again!', 401));
  }
};

export const admin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    next(new AppError('Not authorized as an admin', 403));
  }
};
