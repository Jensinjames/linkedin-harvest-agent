// Simple logger utility for the application
import { CONFIG } from '../config/constants';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: any;
  userId?: number;
  jobId?: number;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private logLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;

  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level];
    const userInfo = entry.userId ? ` [User: ${entry.userId}]` : '';
    const jobInfo = entry.jobId ? ` [Job: ${entry.jobId}]` : '';
    
    return `${timestamp} [${level}]${userInfo}${jobInfo} ${entry.message}`;
  }

  private log(level: LogLevel, message: string, context?: any): void {
    if (level < this.logLevel) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
    };

    const formattedMessage = this.formatMessage(entry);

    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage, context || '');
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, context || '');
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, context || '');
        break;
      case LogLevel.DEBUG:
        console.log(formattedMessage, context || '');
        break;
    }

    // In production, we could send logs to an external service
    if (!this.isDevelopment && level >= LogLevel.WARN) {
      this.sendToExternalService(entry);
    }
  }

  private sendToExternalService(entry: LogEntry): void {
    // TODO: Implement external logging service integration
    // For now, just a placeholder
  }

  debug(message: string, context?: any): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: any): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: any): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error | any): void {
    const context = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error;
    
    this.log(LogLevel.ERROR, message, context);
  }

  // Specialized logging methods
  jobStart(jobId: number, userId: number, profileCount: number): void {
    this.info(`Job started - ${profileCount} profiles to process`, {
      jobId,
      userId,
      profileCount,
    });
  }

  jobComplete(jobId: number, successful: number, failed: number, duration: number): void {
    this.info(`Job completed - ${successful} successful, ${failed} failed in ${duration}ms`, {
      jobId,
      successful,
      failed,
      duration,
    });
  }

  profileExtracted(jobId: number, profileUrl: string, success: boolean, errorType?: string): void {
    const message = success 
      ? `Profile extracted successfully: ${profileUrl}`
      : `Profile extraction failed: ${profileUrl} - ${errorType}`;
    
    this.log(success ? LogLevel.INFO : LogLevel.WARN, message, {
      jobId,
      profileUrl,
      success,
      errorType,
    });
  }

  apiError(endpoint: string, error: Error, userId?: number): void {
    this.error(`API error at ${endpoint}`, {
      endpoint,
      error: error.message,
      stack: error.stack,
      userId,
    });
  }
}

export const logger = new Logger();