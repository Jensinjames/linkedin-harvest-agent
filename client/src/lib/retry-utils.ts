/**
 * Retry utilities for API calls with exponential backoff
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  shouldRetry?: (error: any, attemptNumber: number) => boolean;
  onRetryAttempt?: (error: any, attemptNumber: number) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  shouldRetry: (error: any) => {
    // Don't retry on authentication errors
    if (error?.status === 401 || error?.status === 403) {
      return false;
    }
    // Retry on network errors or 5xx server errors
    if (!error?.status || error.status >= 500) {
      return true;
    }
    // Retry on rate limit errors
    if (error?.status === 429) {
      return true;
    }
    return false;
  },
  onRetryAttempt: () => {},
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt === opts.maxRetries || !opts.shouldRetry(error, attempt + 1)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffFactor, attempt),
        opts.maxDelay
      );

      // Call retry callback
      opts.onRetryAttempt(error, attempt + 1);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export function createRetryHandler(defaultOptions: RetryOptions = {}) {
  return <T>(fn: () => Promise<T>, overrideOptions: RetryOptions = {}) => {
    return withRetry(fn, { ...defaultOptions, ...overrideOptions });
  };
}

/**
 * Parse error to extract meaningful information
 */
export function parseError(error: any): {
  message: string;
  status?: number;
  isNetworkError: boolean;
  isAuthError: boolean;
  isServerError: boolean;
  isRateLimitError: boolean;
} {
  const isNetworkError = !error?.status && error?.message?.includes('fetch');
  const status = error?.status || error?.response?.status;
  
  return {
    message: error?.message || 'An unexpected error occurred',
    status,
    isNetworkError,
    isAuthError: status === 401 || status === 403,
    isServerError: status >= 500 && status < 600,
    isRateLimitError: status === 429,
  };
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: any): {
  title: string;
  description: string;
  action?: string;
} {
  const parsed = parseError(error);

  if (parsed.isNetworkError) {
    return {
      title: 'Connection Error',
      description: 'Unable to connect to the server. Please check your internet connection.',
      action: 'Try refreshing the page or check your connection.',
    };
  }

  if (parsed.isAuthError) {
    return {
      title: 'Authentication Required',
      description: 'Your session has expired. Please log in again.',
      action: 'Click here to go to the login page.',
    };
  }

  if (parsed.isRateLimitError) {
    return {
      title: 'Too Many Requests',
      description: 'You\'ve made too many requests. Please wait a moment before trying again.',
      action: 'Wait a few minutes and try again.',
    };
  }

  if (parsed.isServerError) {
    return {
      title: 'Server Error',
      description: 'Our servers are experiencing issues. We\'re working to fix this.',
      action: 'Please try again in a few minutes.',
    };
  }

  return {
    title: 'Something Went Wrong',
    description: parsed.message || 'An unexpected error occurred.',
    action: 'Please try again or contact support if the issue persists.',
  };
}