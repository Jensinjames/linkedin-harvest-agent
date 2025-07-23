// Custom error types for better error handling
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    if (field) {
      this.message = `${field}: ${message}`;
    }
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super('Rate limit exceeded', 429, 'RATE_LIMIT');
    this.name = 'RateLimitError';
    if (retryAfter) {
      this.message = `Rate limit exceeded. Try again in ${retryAfter} seconds`;
    }
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: Error) {
    super(`External service error: ${service}`, 503, 'EXTERNAL_SERVICE');
    this.name = 'ExternalServiceError';
    if (originalError) {
      this.message = `${service}: ${originalError.message}`;
    }
  }
}

export class ProfileExtractionError extends AppError {
  constructor(
    public errorType: string,
    message: string,
    public profileUrl?: string
  ) {
    super(message, 422, 'EXTRACTION_ERROR');
    this.name = 'ProfileExtractionError';
  }
}