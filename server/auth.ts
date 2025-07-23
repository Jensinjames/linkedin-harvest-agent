import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { User } from '@shared/schema';

// Validate environment variables
const envSchema = z.object({
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long"),
  JWT_ACCESS_TOKEN_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_TOKEN_EXPIRY: z.string().default('7d'),
});

const env = envSchema.parse({
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
  JWT_ACCESS_TOKEN_EXPIRY: process.env.JWT_ACCESS_TOKEN_EXPIRY,
  JWT_REFRESH_TOKEN_EXPIRY: process.env.JWT_REFRESH_TOKEN_EXPIRY,
});

// Password hashing utilities
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// JWT token utilities
export interface TokenPayload {
  userId: number;
  username: string;
  email: string;
}

export function generateAccessToken(user: User): string {
  const payload: TokenPayload = {
    userId: user.id,
    username: user.username,
    email: user.email,
  };
  
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_TOKEN_EXPIRY,
  } as jwt.SignOptions);
}

export function generateRefreshToken(user: User): string {
  const payload = {
    userId: user.id,
    type: 'refresh',
  };
  
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_TOKEN_EXPIRY,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

export function verifyRefreshToken(token: string): { userId: number } {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: number; type: string };
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    return { userId: decoded.userId };
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
}

// Generate a secure random string for refresh tokens
export function generateSecureToken(): string {
  return bcrypt.genSaltSync(16);
}

// Calculate token expiry dates
export function getAccessTokenExpiry(): Date {
  return new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
}

export function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
}