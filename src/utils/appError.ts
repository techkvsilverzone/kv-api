export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  /** The request field at fault, so a form can highlight that input. */
  public readonly field?: string;

  constructor(message: string, statusCode: number, isOperational = true, field?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.field = field;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const EMAIL_IN_USE_MESSAGE = 'An account with this email already exists. Please log in instead.';
