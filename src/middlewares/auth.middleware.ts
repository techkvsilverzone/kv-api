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

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
  } catch (error) {
    return next(new AppError('Invalid token. Please log in again!', 401));
  }

  try {
    const currentUser = await userRepository.findById(decoded.id);
    if (!currentUser) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    req.user = currentUser;
    next();
  } catch (error) {
    // A lookup failure (Mongo unreachable, timeout) is NOT an auth failure. This used
    // to share the catch above and surface as 401, which told every client to discard
    // a perfectly valid session over a transient blip. Let it fall through as a 5xx so
    // clients can retry instead of logging the user out.
    if ((error as { name?: string })?.name === 'CastError') {
      // Signed token carrying a non-ObjectId subject — that IS a bad token.
      return next(new AppError('Invalid token. Please log in again!', 401));
    }
    return next(error);
  }
};

export const admin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    next(new AppError('Not authorized as an admin', 403));
  }
};

// The mandatory daily metal-rate update (and its lock status) must be clearable by staff,
// not just full admins — the RateUpdateGate is shown to admin AND staff.
export const adminOrStaff = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user && (req.user.isAdmin || req.user.role === 'staff')) {
    next();
  } else {
    next(new AppError('Not authorized as an admin or staff', 403));
  }
};
