import { 
  users, jobs, profiles, apiStats, aiAnalyses, sessions,
  type User, type InsertUser,
  type Job, type InsertJob,
  type Profile, type InsertProfile,
  type ApiStats, type InsertApiStats,
  type AiAnalysis, type InsertAiAnalysis,
  type Session, type InsertSession
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLinkedInTokens(userId: number, accessToken: string, refreshToken: string, expiry: Date): Promise<void>;
  updateUserLastLogin(userId: number): Promise<void>;
  
  // Session operations
  createSession(session: InsertSession): Promise<Session>;
  getSessionByRefreshToken(refreshToken: string): Promise<Session | undefined>;
  deleteSession(refreshToken: string): Promise<void>;
  deleteUserSessions(userId: number): Promise<void>;

  // Job operations
  createJob(job: InsertJob): Promise<Job>;
  getJob(id: number): Promise<Job | undefined>;
  getJobsByUser(userId: number): Promise<Job[]>;
  updateJobStatus(id: number, status: string, data?: Partial<Job>): Promise<void>;
  getActiveJob(userId: number): Promise<Job | undefined>;

  // Profile operations
  createProfile(profile: InsertProfile): Promise<Profile>;
  getProfilesByJob(jobId: number): Promise<Profile[]>;
  updateProfileStatus(id: number, status: string, data?: Partial<Profile>): Promise<void>;
  getFailedProfiles(jobId: number): Promise<Profile[]>;

  // API Stats operations
  getApiStats(userId: number): Promise<ApiStats | undefined>;
  updateApiStats(userId: number, data: Partial<ApiStats>): Promise<void>;

  // Analytics
  getJobStats(userId: number): Promise<{
    totalProfiles: number;
    successfulProfiles: number;
    failedProfiles: number;
    successRate: string;
  }>;
  
  getErrorBreakdown(userId: number): Promise<{
    captchaBlocked: number;
    profileNotFound: number;
    accessRestricted: number;
  }>;

  // AI Analysis operations
  createAiAnalysis(analysis: InsertAiAnalysis): Promise<AiAnalysis>;
  getAiAnalysisByJob(jobId: number): Promise<AiAnalysis[]>;
  getAiAnalysisByProfile(profileId: number): Promise<AiAnalysis | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private jobs: Map<number, Job>;
  private profiles: Map<number, Profile>;
  private apiStats: Map<number, ApiStats>;
  private sessions: Map<string, Session>;
  private currentUserId: number;
  private currentJobId: number;
  private currentProfileId: number;
  private currentApiStatsId: number;
  private currentSessionId: number;

  constructor() {
    this.users = new Map();
    this.jobs = new Map();
    this.profiles = new Map();
    this.apiStats = new Map();
    this.sessions = new Map();
    this.currentUserId = 1;
    this.currentJobId = 1;
    this.currentProfileId = 1;
    this.currentApiStatsId = 1;
    this.currentSessionId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { 
      ...insertUser, 
      id,
      isActive: true,
      lastLogin: null,
      linkedinAccessToken: null,
      linkedinRefreshToken: null,
      linkedinTokenExpiry: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserLinkedInTokens(userId: number, accessToken: string, refreshToken: string, expiry: Date): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.linkedinAccessToken = accessToken;
      user.linkedinRefreshToken = refreshToken;
      user.linkedinTokenExpiry = expiry;
      this.users.set(userId, user);
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async updateUserLastLogin(userId: number): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.lastLogin = new Date();
      user.updatedAt = new Date();
      this.users.set(userId, user);
    }
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const id = this.currentSessionId++;
    const session: Session = {
      ...insertSession,
      id,
      createdAt: new Date(),
    };
    this.sessions.set(insertSession.refreshToken, session);
    return session;
  }

  async getSessionByRefreshToken(refreshToken: string): Promise<Session | undefined> {
    return this.sessions.get(refreshToken);
  }

  async deleteSession(refreshToken: string): Promise<void> {
    this.sessions.delete(refreshToken);
  }

  async deleteUserSessions(userId: number): Promise<void> {
    const tokensToDelete: string[] = [];
    this.sessions.forEach((session, token) => {
      if (session.userId === userId) {
        tokensToDelete.push(token);
      }
    });
    tokensToDelete.forEach(token => this.sessions.delete(token));
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const id = this.currentJobId++;
    const job: Job = {
      ...insertJob,
      id,
      status: 'pending',
      processedProfiles: 0,
      successfulProfiles: 0,
      failedProfiles: 0,
      retryingProfiles: 0,
      batchSize: insertJob.batchSize || 50,
      errorBreakdown: null,
      resultPath: null,
      startedAt: null,
      completedAt: null,
      estimatedCompletion: null,
      processingRate: null,
      createdAt: new Date(),
    };
    this.jobs.set(id, job);
    return job;
  }

  async getJob(id: number): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  async getJobsByUser(userId: number): Promise<Job[]> {
    return Array.from(this.jobs.values())
      .filter(job => job.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async updateJobStatus(id: number, status: string, data?: Partial<Job>): Promise<void> {
    const job = this.jobs.get(id);
    if (job) {
      job.status = status;
      if (data) {
        Object.assign(job, data);
      }
      this.jobs.set(id, job);
    }
  }

  async getActiveJob(userId: number): Promise<Job | undefined> {
    return Array.from(this.jobs.values()).find(
      job => job.userId === userId && (job.status === 'processing' || job.status === 'paused')
    );
  }

  async createProfile(insertProfile: InsertProfile): Promise<Profile> {
    const id = this.currentProfileId++;
    const profile: Profile = {
      ...insertProfile,
      id,
      profileData: null,
      errorType: null,
      errorMessage: null,
      retryCount: 0,
      lastAttempt: null,
      extractedAt: null,
    };
    this.profiles.set(id, profile);
    return profile;
  }

  async getProfilesByJob(jobId: number): Promise<Profile[]> {
    return Array.from(this.profiles.values()).filter(profile => profile.jobId === jobId);
  }

  async updateProfileStatus(id: number, status: string, data?: Partial<Profile>): Promise<void> {
    const profile = this.profiles.get(id);
    if (profile) {
      profile.status = status;
      if (data) {
        Object.assign(profile, data);
      }
      this.profiles.set(id, profile);
    }
  }

  async getFailedProfiles(jobId: number): Promise<Profile[]> {
    return Array.from(this.profiles.values()).filter(
      profile => profile.jobId === jobId && profile.status === 'failed'
    );
  }

  async getApiStats(userId: number): Promise<ApiStats | undefined> {
    return Array.from(this.apiStats.values()).find(stats => stats.userId === userId);
  }

  async updateApiStats(userId: number, data: Partial<ApiStats>): Promise<void> {
    let stats = Array.from(this.apiStats.values()).find(s => s.userId === userId);
    if (!stats) {
      const id = this.currentApiStatsId++;
      stats = {
        id,
        userId,
        requestsUsed: 0,
        requestsLimit: 1000,
        resetTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        lastUpdated: new Date(),
      };
      this.apiStats.set(id, stats);
    }
    
    Object.assign(stats, data, { lastUpdated: new Date() });
    this.apiStats.set(stats.id, stats);
  }

  async getJobStats(userId: number): Promise<{
    totalProfiles: number;
    successfulProfiles: number;
    failedProfiles: number;
    successRate: string;
  }> {
    const userJobs = await this.getJobsByUser(userId);
    
    const totalProfiles = userJobs.reduce((sum, job) => sum + job.totalProfiles, 0);
    const successfulProfiles = userJobs.reduce((sum, job) => sum + (job.successfulProfiles || 0), 0);
    const failedProfiles = userJobs.reduce((sum, job) => sum + (job.failedProfiles || 0), 0);
    
    const successRate = totalProfiles > 0 
      ? ((successfulProfiles / totalProfiles) * 100).toFixed(1) + '%'
      : '0%';

    return {
      totalProfiles,
      successfulProfiles,
      failedProfiles,
      successRate,
    };
  }

  async getErrorBreakdown(userId: number): Promise<{
    captchaBlocked: number;
    profileNotFound: number;
    accessRestricted: number;
  }> {
    const userJobs = await this.getJobsByUser(userId);
    const jobIds = userJobs.map(job => job.id);
    
    const allProfiles = Array.from(this.profiles.values())
      .filter(profile => jobIds.includes(profile.jobId) && profile.status === 'failed');

    return {
      captchaBlocked: allProfiles.filter(p => p.errorType === 'captcha').length,
      profileNotFound: allProfiles.filter(p => p.errorType === 'not_found').length,
      accessRestricted: allProfiles.filter(p => p.errorType === 'access_restricted').length,
    };
  }

  async createAiAnalysis(insertAnalysis: InsertAiAnalysis): Promise<AiAnalysis> {
    const id = Math.floor(Math.random() * 100000); // Simple ID for in-memory storage
    const analysis: AiAnalysis = {
      ...insertAnalysis,
      id,
      profileId: insertAnalysis.profileId || null,
      createdAt: new Date(),
    };
    return analysis;
  }

  async getAiAnalysisByJob(jobId: number): Promise<AiAnalysis[]> {
    // For in-memory storage, return empty array since we don't persist AI analyses
    return [];
  }

  async getAiAnalysisByProfile(profileId: number): Promise<AiAnalysis | undefined> {
    // For in-memory storage, return undefined since we don't persist AI analyses
    return undefined;
  }
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserLinkedInTokens(userId: number, accessToken: string, refreshToken: string, expiry: Date): Promise<void> {
    await db
      .update(users)
      .set({
        linkedinAccessToken: accessToken,
        linkedinRefreshToken: refreshToken,
        linkedinTokenExpiry: expiry,
      })
      .where(eq(users.id, userId));
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async updateUserLastLogin(userId: number): Promise<void> {
    await db
      .update(users)
      .set({
        lastLogin: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const [session] = await db
      .insert(sessions)
      .values(insertSession)
      .returning();
    return session;
  }

  async getSessionByRefreshToken(refreshToken: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.refreshToken, refreshToken));
    return session || undefined;
  }

  async deleteSession(refreshToken: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.refreshToken, refreshToken));
  }

  async deleteUserSessions(userId: number): Promise<void> {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const jobData = {
      ...insertJob,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const [job] = await db
      .insert(jobs)
      .values(jobData)
      .returning();
    return job;
  }

  async getJob(id: number): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job || undefined;
  }

  async getJobsByUser(userId: number): Promise<Job[]> {
    return await db
      .select()
      .from(jobs)
      .where(eq(jobs.userId, userId))
      .orderBy(jobs.createdAt);
  }

  async updateJobStatus(id: number, status: string, data?: Partial<Job>): Promise<void> {
    const updateData: any = { status };
    if (data) {
      Object.assign(updateData, data);
    }
    
    await db
      .update(jobs)
      .set(updateData)
      .where(eq(jobs.id, id));
  }

  async getActiveJob(userId: number): Promise<Job | undefined> {
    const [job] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.userId, userId))
      .limit(1);
    
    if (job && (job.status === 'processing' || job.status === 'paused')) {
      return job;
    }
    return undefined;
  }

  async createProfile(insertProfile: InsertProfile): Promise<Profile> {
    const [profile] = await db
      .insert(profiles)
      .values(insertProfile)
      .returning();
    return profile;
  }

  async getProfilesByJob(jobId: number): Promise<Profile[]> {
    return await db
      .select()
      .from(profiles)
      .where(eq(profiles.jobId, jobId));
  }

  async updateProfileStatus(id: number, status: string, data?: Partial<Profile>): Promise<void> {
    const updateData: any = { status };
    if (data) {
      Object.assign(updateData, data);
    }
    
    await db
      .update(profiles)
      .set(updateData)
      .where(eq(profiles.id, id));
  }

  async getFailedProfiles(jobId: number): Promise<Profile[]> {
    return await db
      .select()
      .from(profiles)
      .where(eq(profiles.jobId, jobId));
  }

  async getApiStats(userId: number): Promise<ApiStats | undefined> {
    const [stats] = await db
      .select()
      .from(apiStats)
      .where(eq(apiStats.userId, userId));
    return stats || undefined;
  }

  async updateApiStats(userId: number, data: Partial<ApiStats>): Promise<void> {
    const existing = await this.getApiStats(userId);
    
    if (existing) {
      await db
        .update(apiStats)
        .set({ ...data, lastUpdated: new Date() })
        .where(eq(apiStats.userId, userId));
    } else {
      await db
        .insert(apiStats)
        .values({
          userId,
          requestsUsed: 0,
          requestsLimit: 1000,
          resetTime: new Date(Date.now() + 60 * 60 * 1000),
          ...data,
        });
    }
  }

  async getJobStats(userId: number): Promise<{
    totalProfiles: number;
    successfulProfiles: number;
    failedProfiles: number;
    successRate: string;
  }> {
    const userJobs = await this.getJobsByUser(userId);
    
    const totalProfiles = userJobs.reduce((sum, job) => sum + job.totalProfiles, 0);
    const successfulProfiles = userJobs.reduce((sum, job) => sum + (job.successfulProfiles || 0), 0);
    const failedProfiles = userJobs.reduce((sum, job) => sum + (job.failedProfiles || 0), 0);
    
    const successRate = totalProfiles > 0 
      ? ((successfulProfiles / totalProfiles) * 100).toFixed(1) + '%'
      : '0%';

    return {
      totalProfiles,
      successfulProfiles,
      failedProfiles,
      successRate,
    };
  }

  async getErrorBreakdown(userId: number): Promise<{
    captchaBlocked: number;
    profileNotFound: number;
    accessRestricted: number;
  }> {
    const userJobs = await this.getJobsByUser(userId);
    const jobIds = userJobs.map(job => job.id);
    
    let captchaBlocked = 0;
    let profileNotFound = 0;
    let accessRestricted = 0;

    for (const jobId of jobIds) {
      const jobProfiles = await db
        .select()
        .from(profiles)
        .where(eq(profiles.jobId, jobId));
      
      const failedProfiles = jobProfiles.filter(p => p.status === 'failed');
      
      captchaBlocked += failedProfiles.filter(p => p.errorType === 'captcha').length;
      profileNotFound += failedProfiles.filter(p => p.errorType === 'not_found').length;
      accessRestricted += failedProfiles.filter(p => p.errorType === 'access_restricted').length;
    }

    return {
      captchaBlocked,
      profileNotFound,
      accessRestricted,
    };
  }

  async createAiAnalysis(insertAnalysis: InsertAiAnalysis): Promise<AiAnalysis> {
    const [analysis] = await db
      .insert(aiAnalyses)
      .values(insertAnalysis)
      .returning();
    return analysis;
  }

  async getAiAnalysisByJob(jobId: number): Promise<AiAnalysis[]> {
    return await db
      .select()
      .from(aiAnalyses)
      .where(eq(aiAnalyses.jobId, jobId));
  }

  async getAiAnalysisByProfile(profileId: number): Promise<AiAnalysis | undefined> {
    const [analysis] = await db
      .select()
      .from(aiAnalyses)
      .where(eq(aiAnalyses.profileId, profileId));
    return analysis || undefined;
  }
}

export const storage = new DatabaseStorage();
