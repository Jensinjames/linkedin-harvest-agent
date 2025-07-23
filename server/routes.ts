import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { storage } from "./storage";
import { linkedInService } from "./services/linkedin-api";
import { excelProcessor } from "./services/excel-processor";
import { container } from "./services/dependency-container";
import { aiAssistant } from "./services/ai-assistant";
import { jobSimulator } from "./services/job-simulator";
import { insertJobSchema, loginSchema, insertUserSchema, type LinkedInUrl } from "@shared/schema";
import { hashPassword, verifyPassword, generateAccessToken, generateRefreshToken, verifyRefreshToken, getRefreshTokenExpiry } from "./auth";
import { authenticateToken, optionalAuth, globalRateLimit, authRateLimit, uploadRateLimit, securityHeaders, validateOrigin } from "./middleware";

// Create sample data for demo
async function createSampleData(userId: number) {
  try {
    // Create a completed job with sample data
    const completedJob = await storage.createJob({
      userId: userId,
      fileName: "sample_linkedin_profiles.xlsx",
      totalProfiles: 8,
      batchSize: 50,
      filePath: "uploads/sample.xlsx",
    });

    await storage.updateJobStatus(completedJob.id, 'completed', {
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      processedProfiles: 8,
      successfulProfiles: 6,
      failedProfiles: 2,
      processingRate: "4.2 profiles/min",
    });

    // Create sample profiles
    const sampleUrls = [
      "https://linkedin.com/in/alice-johnson",
      "https://linkedin.com/in/bob-martin", 
      "https://linkedin.com/in/carol-davis",
      "https://linkedin.com/in/dan-wilson",
      "https://linkedin.com/in/eve-garcia",
      "https://linkedin.com/in/frank-lee",
      "https://linkedin.com/in/grace-taylor",
      "https://linkedin.com/in/henry-clark"
    ];

    for (let i = 0; i < sampleUrls.length; i++) {
      const profile = await storage.createProfile({
        jobId: completedJob.id,
        linkedinUrl: sampleUrls[i],
        status: i < 6 ? 'success' : 'failed',
      });

      if (i < 6) {
        // Successful profiles
        const mockData = {
          firstName: ['Alice', 'Bob', 'Carol', 'Dan', 'Eve', 'Frank'][i],
          lastName: ['Johnson', 'Martin', 'Davis', 'Wilson', 'Garcia', 'Lee'][i],
          headline: ['Senior Product Manager', 'Software Engineer', 'Marketing Director', 'Data Scientist', 'UX Designer', 'Sales Manager'][i],
          summary: 'Experienced professional with proven track record in innovation and leadership.',
          industry: ['Technology', 'Software', 'Marketing', 'Data Analytics', 'Design', 'Sales'][i],
          location: ['San Francisco, CA', 'Seattle, WA', 'New York, NY', 'Austin, TX', 'Chicago, IL', 'Boston, MA'][i],
          positions: [{
            title: ['Senior Product Manager', 'Software Engineer', 'Marketing Director', 'Data Scientist', 'UX Designer', 'Sales Manager'][i],
            company: ['TechCorp', 'DataSoft', 'MarketPro', 'Analytics Inc', 'Design Studio', 'SalesForce'][i],
            startDate: '2022-01',
            description: 'Leading innovative projects and driving business growth.'
          }]
        };

        await storage.updateProfileStatus(profile.id, 'success', {
          profileData: mockData,
          extractedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        });
      } else {
        // Failed profiles
        const errorTypes = ['captcha', 'access_restricted'];
        await storage.updateProfileStatus(profile.id, 'failed', {
          errorType: errorTypes[i - 6],
          errorMessage: `Failed to extract: ${errorTypes[i - 6]}`,
          lastAttempt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        });
      }
    }

    // Update API stats
    await storage.updateApiStats(userId, {
      requestsUsed: 156,
      requestsLimit: 1000,
      resetTime: new Date(Date.now() + 45 * 60 * 1000), // 45 minutes from now
    });

  } catch (error) {
    console.error('Failed to create sample data:', error);
  }
}

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// Helper function to create auth tokens response
function createAuthResponse(user: any, accessToken: string, refreshToken: string) {
  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      linkedinConnected: !!user.linkedinAccessToken,
    },
    accessToken,
    refreshToken,
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply security middleware
  app.use(securityHeaders());
  app.use(globalRateLimit);
  
  // Auth routes with rate limiting
  app.post("/api/auth/register", authRateLimit, async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }
      
      const existingEmail = await storage.getUserByEmail(validatedData.email);
      if (existingEmail) {
        return res.status(400).json({ error: "Email already exists" });
      }
      
      // Hash password and create user
      const hashedPassword = await hashPassword(validatedData.password);
      const user = await storage.createUser({
        ...validatedData,
        password: hashedPassword,
      });
      
      // Generate tokens
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);
      
      // Store refresh token
      await storage.createSession({
        userId: user.id,
        refreshToken,
        expiresAt: getRefreshTokenExpiry(),
      });
      
      // Update last login
      await storage.updateUserLastLogin(user.id);
      
      res.json(createAuthResponse(user, accessToken, refreshToken));
    } catch (error: any) {
      if (error.issues) {
        return res.status(400).json({ error: "Validation error", details: error.issues });
      }
      console.error("Registration error:", error);
      res.status(500).json({ error: "Failed to register user" });
    }
  });
  
  app.post("/api/auth/login", authRateLimit, async (req, res) => {
    try {
      const validatedData = loginSchema.parse(req.body);
      
      // Find user
      const user = await storage.getUserByUsername(validatedData.username);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Verify password
      const isValidPassword = await verifyPassword(validatedData.password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({ error: "Account is disabled" });
      }
      
      // Generate tokens
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);
      
      // Store refresh token
      await storage.createSession({
        userId: user.id,
        refreshToken,
        expiresAt: getRefreshTokenExpiry(),
      });
      
      // Update last login
      await storage.updateUserLastLogin(user.id);
      
      res.json(createAuthResponse(user, accessToken, refreshToken));
    } catch (error: any) {
      if (error.issues) {
        return res.status(400).json({ error: "Validation error", details: error.issues });
      }
      console.error("Login error:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });
  
  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(401).json({ error: "Refresh token required" });
      }
      
      // Verify refresh token
      const tokenData = verifyRefreshToken(refreshToken);
      
      // Check if session exists
      const session = await storage.getSessionByRefreshToken(refreshToken);
      if (!session || session.expiresAt < new Date()) {
        return res.status(401).json({ error: "Invalid or expired refresh token" });
      }
      
      // Get user
      const user = await storage.getUser(tokenData.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({ error: "User not found or inactive" });
      }
      
      // Generate new access token
      const accessToken = generateAccessToken(user);
      
      res.json({ accessToken });
    } catch (error) {
      console.error("Token refresh error:", error);
      res.status(401).json({ error: "Invalid refresh token" });
    }
  });
  
  app.post("/api/auth/logout", authenticateToken, async (req, res) => {
    try {
      const { refreshToken } = req.body;
      
      if (refreshToken) {
        await storage.deleteSession(refreshToken);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Failed to logout" });
    }
  });
  
  app.get("/api/auth/status", authenticateToken, async (req, res) => {
    const user = await storage.getUser(req.user!.userId);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json({
      isAuthenticated: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        linkedinConnected: !!user.linkedinAccessToken,
      },
    });
  });

  app.get("/api/auth/status-detailed", authenticateToken, async (req, res) => {
    const user = await storage.getUser(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const apiStats = await storage.getApiStats(user.id);
    
    res.json({
      linkedinConnected: !!user?.linkedinAccessToken,
      proxyActive: true, // Mock proxy status
      rateLimitInfo: {
        used: apiStats?.requestsUsed || 0,
        limit: apiStats?.requestsLimit || 1000,
        resetTime: apiStats?.resetTime ? 
          Math.ceil((apiStats.resetTime.getTime() - Date.now()) / (1000 * 60)) + ' minutes' : 
          'Unknown',
      },
    });
  });

  app.post("/api/auth/linkedin", authenticateToken, async (req, res) => {
    try {
      // For demo purposes, simulate successful LinkedIn connection
      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const mockTokenExpiry = new Date(Date.now() + 3600 * 1000); // 1 hour from now
      
      await storage.updateUserLinkedInTokens(
        user.id,
        'mock_access_token_' + Date.now(),
        'mock_refresh_token_' + Date.now(),
        mockTokenExpiry
      );
      
      res.json({ 
        success: true,
        message: "LinkedIn connected successfully (demo mode)" 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to connect LinkedIn" });
    }
  });

  app.post("/api/auth/linkedin/reconnect", async (req, res) => {
    try {
      const authUrl = linkedInService.getAuthUrl();
      res.json({ authUrl });
    } catch (error) {
      res.status(500).json({ error: "Failed to reconnect LinkedIn" });
    }
  });

  app.get("/api/auth/linkedin/callback", async (req, res) => {
    try {
      const { code } = req.query;
      if (!code) {
        return res.status(400).json({ error: "Authorization code required" });
      }

      const tokens = await linkedInService.exchangeCodeForTokens(code as string);
      // Note: This callback needs special handling - it's called by LinkedIn
      // For now, we'll return an error since we can't authenticate from a callback
      return res.status(400).json({ error: "LinkedIn callback authentication not implemented" });
      
      await storage.updateUserLinkedInTokens(
        user.id, 
        tokens.accessToken, 
        tokens.refreshToken, 
        new Date(Date.now() + tokens.expiresIn * 1000)
      );

      res.redirect('/'); // Redirect back to dashboard
    } catch (error) {
      res.status(500).json({ error: "Failed to authenticate with LinkedIn" });
    }
  });

  // File upload routes
  app.post("/api/files/upload", authenticateToken, uploadRateLimit, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Validate file extension
      const allowedExtensions = ['.xlsx', '.xls'];
      const fileExtension = path.extname(req.file.originalname || '').toLowerCase();
      
      if (!allowedExtensions.includes(fileExtension)) {
        return res.status(400).json({ 
          error: "Invalid file format. Only Excel files (.xlsx, .xls) are supported." 
        });
      }

      // Parse LinkedIn URLs from the uploaded Excel file
      let linkedinUrls: LinkedInUrl[] = [];
      try {
        linkedinUrls = await excelProcessor.parseLinkedInUrls(req.file.path);
        
        if (linkedinUrls.length === 0) {
          return res.status(400).json({ 
            error: "No LinkedIn URLs found in the uploaded file. Please ensure your Excel file contains LinkedIn profile URLs." 
          });
        }
      } catch (parseError) {
        console.error('Excel parsing error:', parseError);
        return res.status(400).json({ 
          error: "Failed to parse Excel file. Please ensure it's a valid Excel file with LinkedIn URLs." 
        });
      }

      // Create a job for this upload
      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const job = await storage.createJob({
        userId: user.id,
        fileName: req.file.originalname || 'uploaded_file.xlsx',
        totalProfiles: linkedinUrls.length,
        batchSize: 50,
        filePath: req.file.path,
      });

      // Create profile records with deduplication
      for (const urlData of linkedinUrls) {
        // Check if profile already exists for this job and URL
        const existingProfiles = await storage.getProfilesByJob(job.id);
        const exists = existingProfiles.some(p => p.linkedinUrl === urlData.url);
        
        if (!exists) {
          await storage.createProfile({
            jobId: job.id,
            linkedinUrl: urlData.url,
            status: 'pending',
          });
        }
      }
      
      res.json({
        id: job.id.toString(),
        name: req.file.originalname,
        size: req.file.size,
        profileCount: linkedinUrls.length,
        status: 'uploaded',
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: "Failed to process Excel file" });
    }
  });

  app.get("/api/files/uploaded", authenticateToken, async (req, res) => {
    // Return any recently uploaded files from jobs
    try {
      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const jobs = await storage.getJobsByUser(user.id);
      const uploadedFiles = jobs
        .filter(job => job.status === 'pending' || job.status === 'processing')
        .slice(0, 5)
        .map(job => ({
          id: job.id.toString(),
          name: job.fileName,
          size: 1024 * 1024, // Mock 1MB
          profileCount: job.totalProfiles,
          status: job.status === 'pending' ? 'uploaded' : job.status,
        }));
      
      res.json(uploadedFiles);
    } catch (error) {
      res.status(500).json({ error: "Failed to get uploaded files" });
    }
  });

  app.delete("/api/files/:id", async (req, res) => {
    try {
      // Remove file logic here
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove file" });
    }
  });

  // Job management routes
  app.post("/api/jobs/start", authenticateToken, validateOrigin, async (req, res) => {
    try {
      const { fileId, batchSize } = req.body;
      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get the job by ID
      const job = await storage.getJob(parseInt(fileId));
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Update job status to processing
      await storage.updateJobStatus(job.id, 'processing', {
        startedAt: new Date(),
        batchSize: parseInt(batchSize) || 50,
      });
      
      // Add job to the queue for AI-powered processing
      const jobQueue = container.get('jobQueue');
      await jobQueue.addJob({
        jobId: job.id,
        userId: user.id,
        filePath: job.filePath,
        batchSize: parseInt(batchSize) || 50,
      });

      res.json({ jobId: job.id, status: 'started' });
    } catch (error) {
      console.error('Start job error:', error);
      res.status(500).json({ error: "Failed to start job processing" });
    }
  });

  app.get("/api/jobs/current-status", authenticateToken, async (req, res) => {
    try {
      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const activeJob = await storage.getActiveJob(user.id);
      
      if (!activeJob) {
        return res.json(null);
      }

      const totalProcessed = activeJob.processedProfiles || 0;
      const percentage = Math.round((totalProcessed / activeJob.totalProfiles) * 100);
      const remaining = activeJob.totalProfiles - totalProcessed;
      
      res.json({
        hasActiveJob: true,
        currentJob: {
          id: activeJob.id,
          fileName: activeJob.fileName,
          status: activeJob.status,
          progress: percentage,
          processedProfiles: totalProcessed,
          totalProfiles: activeJob.totalProfiles,
          successful: activeJob.successfulProfiles || 0,
          retrying: activeJob.retryingProfiles || 0,
          failed: activeJob.failedProfiles || 0,
          remaining,
          processingRate: activeJob.processingRate || 'Calculating...',
          estimatedCompletion: activeJob.estimatedCompletion ? 
            Math.ceil((activeJob.estimatedCompletion.getTime() - Date.now()) / (1000 * 60)) + 'm' : 
            'Calculating...',
        },
      });
    } catch (error) {
      console.error('Job status error:', error);
      res.status(500).json({ error: "Failed to get job status" });
    }
  });

  app.get("/api/jobs/recent", authenticateToken, async (req, res) => {
    try {
      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const jobs = await storage.getJobsByUser(user.id);
      
      const recentJobs = jobs.slice(0, 10).map(job => ({
        id: job.id,
        fileName: job.fileName,
        totalProfiles: job.totalProfiles,
        status: job.status,
        progress: job.processedProfiles ? 
          Math.round((job.processedProfiles / job.totalProfiles) * 100) : 0,
        successRate: job.totalProfiles > 0 ? 
          ((job.successfulProfiles || 0) / job.totalProfiles * 100).toFixed(1) + '%' : 
          '0%',
        startedAt: job.startedAt?.toISOString() || job.createdAt?.toISOString() || new Date().toISOString(),
      }));

      res.json(recentJobs);
    } catch (error) {
      res.status(500).json({ error: "Failed to get recent jobs" });
    }
  });

  app.post("/api/jobs/:id/pause", async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      await storage.updateJobStatus(jobId, 'paused');
      const jobQueue = container.get('jobQueue');
      await jobQueue.pauseJob(jobId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to pause job" });
    }
  });

  app.post("/api/jobs/:id/stop", async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      await storage.updateJobStatus(jobId, 'failed');
      const jobQueue = container.get('jobQueue');
      await jobQueue.stopJob(jobId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to stop job" });
    }
  });

  app.post("/api/jobs/:id/cancel", async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      await storage.updateJobStatus(jobId, 'failed');
      const jobQueue = container.get('jobQueue');
      await jobQueue.stopJob(jobId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to cancel job" });
    }
  });

  app.post("/api/jobs/:id/resume", async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      await storage.updateJobStatus(jobId, 'processing');
      const jobQueue = container.get('jobQueue');
      await jobQueue.resumeJob(jobId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to resume job" });
    }
  });

  app.get("/api/jobs/:id/download", async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const job = await storage.getJob(jobId);
      
      if (!job || !job.resultPath) {
        return res.status(404).json({ error: "Results not found" });
      }

      res.download(job.resultPath);
    } catch (error) {
      res.status(500).json({ error: "Failed to download results" });
    }
  });

  app.delete("/api/jobs/:id", async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      // In real implementation, remove job from database
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete job" });
    }
  });

  // Storage routes
  app.get("/api/storage/stats", authenticateToken, async (req, res) => {
    try {
      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const jobs = await storage.getJobsByUser(user.id);
      const stats = await storage.getJobStats(user.id);
      
      res.json({
        totalJobs: jobs.length,
        totalProfiles: stats.totalProfiles,
        successfulProfiles: stats.successfulProfiles,
        failedProfiles: stats.failedProfiles,
        dataSize: "2.3 MB", // Mock data size
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get storage stats" });
    }
  });

  app.get("/api/jobs", authenticateToken, async (req, res) => {
    try {
      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string || "";
      
      const jobs = await storage.getJobsByUser(user.id);
      
      // Filter by search term
      const filteredJobs = search 
        ? jobs.filter(job => job.fileName.toLowerCase().includes(search.toLowerCase()))
        : jobs;
      
      // Paginate
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedJobs = filteredJobs.slice(startIndex, endIndex);
      
      res.json({
        jobs: paginatedJobs,
        total: filteredJobs.length,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get jobs" });
    }
  });

  app.get("/api/jobs/:id/profiles", async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const profiles = await storage.getProfilesByJob(jobId);
      
      res.json({
        profiles: profiles,
        total: profiles.length,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get profiles" });
    }
  });

  // System Health endpoint
  app.get("/api/system/health", authenticateToken, async (req, res) => {
    try {
      const startTime = Date.now();
      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const apiStats = await storage.getApiStats(user.id);
      const responseTime = Date.now() - startTime;
      
      res.json({
        linkedinConnected: !!user?.linkedinAccessToken,
        proxyActive: true, // Mock proxy status
        rateLimitInfo: {
          used: apiStats?.requestsUsed || 0,
          limit: apiStats?.requestsLimit || 1000,
          resetTime: apiStats?.resetTime ? 
            Math.ceil((apiStats.resetTime.getTime() - Date.now()) / (1000 * 60)) + ' minutes' : 
            'Unknown',
        },
        databaseStatus: 'connected',
        apiResponseTime: responseTime,
      });
    } catch (error) {
      console.error('Health check error:', error);
      res.status(500).json({ error: "Failed to get system health" });
    }
  });

  // Statistics routes
  app.get("/api/stats/overview", authenticateToken, async (req, res) => {
    try {
      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const stats = await storage.getJobStats(user.id);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get overview stats" });
    }
  });

  app.get("/api/stats/errors", authenticateToken, async (req, res) => {
    try {
      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const errorBreakdown = await storage.getErrorBreakdown(user.id);
      res.json(errorBreakdown);
    } catch (error) {
      res.status(500).json({ error: "Failed to get error breakdown" });
    }
  });

  app.get("/api/stats/export-counts", authenticateToken, async (req, res) => {
    try {
      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const stats = await storage.getJobStats(user.id);
      res.json({
        successful: stats.successfulProfiles,
        failed: stats.failedProfiles,
        total: stats.totalProfiles,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get export counts" });
    }
  });

  // AI Assistant routes
  app.post("/api/ai/analyze-profile/:profileId", authenticateToken, async (req, res) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const profiles = await storage.getProfilesByJob(profileId);
      const profile = profiles.find(p => p.id === profileId);
      
      if (!profile || !profile.profileData) {
        return res.status(404).json({ error: "Profile not found or no data available" });
      }

      // Convert profile data for AI analysis
      const profileData = profile.profileData as any;
      const profileForAnalysis = {
        id: profile.id,
        name: `${profileData?.firstName || ''} ${profileData?.lastName || ''}`.trim(),
        headline: profileData?.headline || '',
        summary: profileData?.summary || '',
        location: profileData?.location || '',
        experience: profileData?.positions?.map((p: any) => `${p.title} at ${p.company}: ${p.description || ''}`).join('\n') || '',
        education: profileData?.education?.map((e: any) => `${e.degree} in ${e.fieldOfStudy} from ${e.school}`).join('\n') || '',
        skills: '',
        connections: '',
        linkedinUrl: profile.linkedinUrl,
        status: profile.status,
        profileData: profile.profileData,
        jobId: profile.jobId,
        errorType: profile.errorType,
        errorMessage: profile.errorMessage,
        retryCount: profile.retryCount,
        lastAttempt: profile.lastAttempt,
        extractedAt: profile.extractedAt,
      };

      const analysis = await aiAssistant.analyzeProfile(profileForAnalysis);
      
      // Store the analysis in the database
      await storage.createAiAnalysis({
        jobId: profile.jobId,
        profileId: profile.id,
        analysisType: 'profile',
        analysisData: analysis,
      });
      
      res.json(analysis);
    } catch (error) {
      console.error('Error analyzing profile:', error);
      res.status(500).json({ error: "Failed to analyze profile" });
    }
  });

  app.post("/api/ai/analyze-job/:jobId", authenticateToken, async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const profiles = await storage.getProfilesByJob(jobId);
      const successfulProfiles = profiles.filter(p => p.status === 'success' && p.profileData);

      if (successfulProfiles.length === 0) {
        return res.status(400).json({ error: "No successful profiles found for analysis" });
      }

      // Convert profiles for AI analysis
      const profilesForAnalysis = successfulProfiles.map(profile => {
        const profileData = profile.profileData as any;
        return {
          id: profile.id,
          name: `${profileData?.firstName || ''} ${profileData?.lastName || ''}`.trim(),
          headline: profileData?.headline || '',
          summary: profileData?.summary || '',
          location: profileData?.location || '',
          experience: profileData?.positions?.map((p: any) => `${p.title} at ${p.company}: ${p.description || ''}`).join('\n') || '',
          education: profileData?.education?.map((e: any) => `${e.degree} in ${e.fieldOfStudy} from ${e.school}`).join('\n') || '',
          skills: '',
          connections: '',
          linkedinUrl: profile.linkedinUrl,
          status: profile.status,
          profileData: profile.profileData,
          jobId: profile.jobId,
          errorType: profile.errorType,
          errorMessage: profile.errorMessage,
          retryCount: profile.retryCount,
          lastAttempt: profile.lastAttempt,
          extractedAt: profile.extractedAt,
        };
      });

      const analysis = await aiAssistant.analyzeBulkProfiles(profilesForAnalysis);
      
      // Store the analysis in the database
      await storage.createAiAnalysis({
        jobId: jobId,
        profileId: null,
        analysisType: 'bulk',
        analysisData: analysis,
      });
      
      res.json(analysis);
    } catch (error) {
      console.error('Error analyzing job:', error);
      res.status(500).json({ error: "Failed to analyze job profiles" });
    }
  });

  app.post("/api/ai/recruiting-insights/:jobId", authenticateToken, async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const { jobTitle } = req.body;
      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const profiles = await storage.getProfilesByJob(jobId);
      const successfulProfiles = profiles.filter(p => p.status === 'success' && p.profileData);

      if (successfulProfiles.length === 0) {
        return res.status(400).json({ error: "No successful profiles found for analysis" });
      }

      // Convert profiles for AI analysis
      const profilesForAnalysis = successfulProfiles.map(profile => {
        const profileData = profile.profileData as any;
        return {
          id: profile.id,
          name: `${profileData?.firstName || ''} ${profileData?.lastName || ''}`.trim(),
          headline: profileData?.headline || '',
          summary: profileData?.summary || '',
          location: profileData?.location || '',
          experience: profileData?.positions?.map((p: any) => `${p.title} at ${p.company}: ${p.description || ''}`).join('\n') || '',
          education: profileData?.education?.map((e: any) => `${e.degree} in ${e.fieldOfStudy} from ${e.school}`).join('\n') || '',
          skills: '',
          connections: '',
          linkedinUrl: profile.linkedinUrl,
          status: profile.status,
          profileData: profile.profileData,
          jobId: profile.jobId,
          errorType: profile.errorType,
          errorMessage: profile.errorMessage,
          retryCount: profile.retryCount,
          lastAttempt: profile.lastAttempt,
          extractedAt: profile.extractedAt,
        };
      });

      const insights = await aiAssistant.generateRecruitingInsights(profilesForAnalysis, jobTitle);
      
      // Store the analysis in the database
      await storage.createAiAnalysis({
        jobId: jobId,
        profileId: null,
        analysisType: 'recruiting',
        analysisData: { insights, jobTitle },
      });
      
      res.json({ insights });
    } catch (error) {
      console.error('Error generating recruiting insights:', error);
      res.status(500).json({ error: "Failed to generate recruiting insights" });
    }
  });

  app.post("/api/ai/chat", authenticateToken, async (req, res) => {
    try {
      const { message, jobId } = req.body;
      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      let context: any = {};
      
      if (jobId) {
        const job = await storage.getJob(jobId);
        const profiles = await storage.getProfilesByJob(jobId);
        const successfulProfiles = profiles.filter(p => p.status === 'success' && p.profileData);
        
        context = {
          jobId,
          profiles: successfulProfiles.map(profile => {
            const profileData = profile.profileData as any;
            return {
              id: profile.id,
              name: `${profileData?.firstName || ''} ${profileData?.lastName || ''}`.trim(),
              headline: profileData?.headline || '',
              location: profileData?.location || '',
              linkedinUrl: profile.linkedinUrl,
            };
          })
        };
      }
      
      const response = await aiAssistant.chatWithAssistant(message, context);
      res.json({ response });
    } catch (error) {
      console.error('Error in AI chat:', error);
      res.status(500).json({ error: "Failed to process chat message" });
    }
  });

  app.get("/api/ai/analyses/:jobId", async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const analyses = await storage.getAiAnalysisByJob(jobId);
      res.json(analyses);
    } catch (error) {
      console.error('Error getting AI analyses:', error);
      res.status(500).json({ error: "Failed to get AI analyses" });
    }
  });

  // Export routes
  app.post("/api/export/:type", authenticateToken, async (req, res) => {
    try {
      const { type } = req.params;
      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const excelBuffer = await excelProcessor.exportResults(user.id, type as 'successful' | 'failed' | 'all');
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=linkedin_data_${type}_${new Date().toISOString().split('T')[0]}.xlsx`);
      res.send(excelBuffer);
    } catch (error) {
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  // Job profiles route for AI Assistant
  app.get("/api/jobs/:id/profiles", async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const profiles = await storage.getProfilesByJob(jobId);
      res.json(profiles);
    } catch (error) {
      console.error('Error getting job profiles:', error);
      res.status(500).json({ error: "Failed to get job profiles" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
