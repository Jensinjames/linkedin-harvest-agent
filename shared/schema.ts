import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(), // Will store bcrypt hashed passwords
  isActive: boolean("is_active").default(true),
  lastLogin: timestamp("last_login"),
  linkedinAccessToken: text("linkedin_access_token"),
  linkedinRefreshToken: text("linkedin_refresh_token"),
  linkedinTokenExpiry: timestamp("linkedin_token_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  fileName: text("file_name").notNull(),
  status: text("status").notNull(), // 'pending', 'processing', 'completed', 'failed', 'paused'
  totalProfiles: integer("total_profiles").notNull(),
  processedProfiles: integer("processed_profiles").default(0),
  successfulProfiles: integer("successful_profiles").default(0),
  failedProfiles: integer("failed_profiles").default(0),
  retryingProfiles: integer("retrying_profiles").default(0),
  batchSize: integer("batch_size").default(50),
  errorBreakdown: jsonb("error_breakdown"), // JSON object with error types and counts
  filePath: text("file_path").notNull(),
  resultPath: text("result_path"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  estimatedCompletion: timestamp("estimated_completion"),
  processingRate: text("processing_rate"), // e.g., "12.3 profiles/min"
  createdAt: timestamp("created_at").defaultNow(),
});

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  linkedinUrl: text("linkedin_url").notNull(),
  status: text("status").notNull(), // 'pending', 'processing', 'success', 'failed', 'retrying'
  profileData: jsonb("profile_data"), // LinkedIn profile information
  errorType: text("error_type"), // 'captcha', 'not_found', 'access_restricted', 'rate_limit'
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  lastAttempt: timestamp("last_attempt"),
  extractedAt: timestamp("extracted_at"),
});

export const apiStats = pgTable("api_stats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  requestsUsed: integer("requests_used").default(0),
  requestsLimit: integer("requests_limit").default(1000),
  resetTime: timestamp("reset_time"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Session management for JWT refresh tokens
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  refreshToken: text("refresh_token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const aiAnalyses = pgTable("ai_analyses", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  profileId: integer("profile_id"), // null for bulk analysis
  analysisType: text("analysis_type").notNull(), // 'profile', 'bulk', 'recruiting'
  analysisData: jsonb("analysis_data").notNull(), // AI analysis results
  createdAt: timestamp("created_at").defaultNow(),
});

// User schemas with validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
}).extend({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens"),
  email: z.string().email(),
  password: z.string().min(8).max(100).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain at least one uppercase letter, one lowercase letter, and one number"),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const insertSessionSchema = createInsertSchema(sessions).pick({
  userId: true,
  refreshToken: true,
  expiresAt: true,
});

export const insertJobSchema = createInsertSchema(jobs).pick({
  userId: true,
  fileName: true,
  totalProfiles: true,
  batchSize: true,
  filePath: true,
});

export const insertProfileSchema = createInsertSchema(profiles).pick({
  jobId: true,
  linkedinUrl: true,
  status: true,
});

export const insertAiAnalysisSchema = createInsertSchema(aiAnalyses).pick({
  jobId: true,
  profileId: true,
  analysisType: true,
  analysisData: true,
});

export const insertApiStatsSchema = createInsertSchema(apiStats).pick({
  userId: true,
  requestsUsed: true,
  requestsLimit: true,
  resetTime: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;

export type ApiStats = typeof apiStats.$inferSelect;
export type InsertApiStats = z.infer<typeof insertApiStatsSchema>;

export type AiAnalysis = typeof aiAnalyses.$inferSelect;
export type InsertAiAnalysis = z.infer<typeof insertAiAnalysisSchema>;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;

// Shared interfaces
export interface LinkedInUrl {
  url: string;
  rowIndex: number;
  additionalData?: Record<string, any>;
}

export interface ProcessedProfile {
  url: string;
  status: 'success' | 'failed' | 'retrying';
  data?: any;
  error?: string;
  errorType?: string;
  retryCount?: number;
}
