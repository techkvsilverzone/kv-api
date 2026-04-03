import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError';
import Logger from '../utils/logger';

export const errorMiddleware = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  const unknownError = err as any;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (unknownError?.code === 11000) {
    statusCode = 409;
    message = 'Duplicate value violates unique constraint';
  } else if (unknownError?.name === 'ValidationError') {
    statusCode = 400;
    const details = unknownError?.errors
      ? Object.values(unknownError.errors)
          .map((e: any) => e?.message)
          .filter(Boolean)
          .join(', ')
      : '';
    message = details || 'Validation failed';
  } else if (unknownError?.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid value provided for one or more fields';
  } else if (unknownError instanceof SyntaxError && 'body' in unknownError) {
    statusCode = 400;
    message = 'Invalid JSON payload';
  } else {
    Logger.error(`${err.name}: ${err.message}\n${err.stack}`);
  }

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
