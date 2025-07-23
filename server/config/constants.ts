// Configuration constants for the application
export const CONFIG = {
  // File upload limits
  FILE_UPLOAD: {
    MAX_SIZE: 50 * 1024 * 1024, // 50MB
    ALLOWED_EXTENSIONS: ['.xlsx', '.xls'],
    TEMP_DIRECTORY: 'uploads/',
  },

  // Job processing
  JOB_PROCESSING: {
    DEFAULT_BATCH_SIZE: 50,
    MIN_BATCH_SIZE: 10,
    MAX_BATCH_SIZE: 100,
    RATE_LIMIT_DELAY: 2000, // 2 seconds between requests
    BATCH_DELAY: 5000, // 5 seconds between batches
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // Initial retry delay
  },

  // API limits
  API_LIMITS: {
    DEFAULT_REQUEST_LIMIT: 1000,
    RATE_LIMIT_WINDOW: 60 * 60 * 1000, // 1 hour
  },

  // Demo mode
  DEMO: {
    USERNAME: 'demo_user',
    PASSWORD: 'demo_password',
    SIMULATION_MIN_DELAY: 1000,
    SIMULATION_MAX_DELAY: 3000,
    SIMULATION_SUCCESS_RATE: 0.8,
  },

  // Database
  DATABASE: {
    CONNECTION_TIMEOUT: 10000,
    IDLE_TIMEOUT: 30000,
    MAX_CONNECTIONS: 20,
  },

  // Session
  SESSION: {
    SECRET: process.env.SESSION_SECRET || 'demo-secret-key',
    MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
    COOKIE_NAME: 'sessionId',
  },

  // Error types
  ERROR_TYPES: {
    CAPTCHA: 'captcha',
    NOT_FOUND: 'not_found',
    ACCESS_RESTRICTED: 'access_restricted',
    RATE_LIMIT: 'rate_limit',
  },

  // Status types
  STATUS: {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    PAUSED: 'paused',
    RETRYING: 'retrying',
    SUCCESS: 'success',
  },
} as const;

export type Config = typeof CONFIG;