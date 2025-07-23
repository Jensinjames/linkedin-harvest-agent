import type { IStorage } from '../storage';
import type { ExcelParser } from './excel/parser';
import type { AIProfileExtractor } from './ai-profile-extractor';
import { CONFIG } from '../config/constants';
import { ProfileExtractionError } from '../types/errors';
import { logger } from '../utils/logger';
import { performanceMonitor } from '../utils/performance-monitor';
import { mockProfileGenerator } from './mock-profile-generator';

interface JobData {
  jobId: number;
  userId: number;
  filePath: string;
  batchSize: number;
}

interface ProcessingJob {
  id: number;
  data: JobData;
  status: 'pending' | 'processing' | 'paused' | 'completed' | 'failed';
  retryCount: number;
}

export class JobQueue {
  constructor(
    private storage: IStorage,
    private excelParser: ExcelParser,
    private aiProfileExtractor: AIProfileExtractor
  ) {}
  private jobs: Map<number, ProcessingJob> = new Map();
  private processing: boolean = false;
  private currentJobId: number = 1;

  async addJob(data: JobData): Promise<number> {
    const jobId = this.currentJobId++;
    const job: ProcessingJob = {
      id: jobId,
      data,
      status: 'pending',
      retryCount: 0,
    };

    this.jobs.set(jobId, job);
    
    if (!this.processing) {
      this.startProcessing();
    }

    return jobId;
  }

  async pauseJob(jobId: number): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'processing') {
      job.status = 'paused';
    }
  }

  async stopJob(jobId: number): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'failed';
    }
  }

  async resumeJob(jobId: number): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'paused') {
      job.status = 'pending';
      if (!this.processing) {
        this.startProcessing();
      }
    }
  }

  private async startProcessing(): Promise<void> {
    if (this.processing) return;
    
    this.processing = true;

    while (this.processing) {
      const nextJob = this.getNextJob();
      if (!nextJob) {
        this.processing = false;
        break;
      }

      await this.processJob(nextJob);
    }
  }

  private getNextJob(): ProcessingJob | null {
    for (const job of Array.from(this.jobs.values())) {
      if (job.status === 'pending') {
        return job;
      }
    }
    return null;
  }

  private async processJob(job: ProcessingJob): Promise<void> {
    try {
      job.status = 'processing';
      
      // Update job status in storage
      await this.storage.updateJobStatus(job.data.jobId, 'processing', {
        startedAt: new Date(),
      });

      // Parse LinkedIn URLs from the uploaded file
      const linkedinUrls = await this.excelParser.parseLinkedInUrls(job.data.filePath);
      
      if (linkedinUrls.length === 0) {
        throw new Error('No LinkedIn URLs found in the uploaded file');
      }

      // Create profile records
      for (const urlData of linkedinUrls) {
        await this.storage.createProfile({
          jobId: job.data.jobId,
          linkedinUrl: urlData.url,
          status: 'pending',
        });
      }

      // Get user's LinkedIn access token
      const user = await this.storage.getUser(job.data.userId);
      if (!user?.linkedinAccessToken) {
        throw new Error('LinkedIn authentication required');
      }

      // Process profiles in batches
      const batchSize = job.data.batchSize;
      let processed = 0;
      let successful = 0;
      let failed = 0;
      const startTime = Date.now();

      for (let i = 0; i < linkedinUrls.length; i += batchSize) {
        // Check if job was paused or stopped
        const currentJob = this.jobs.get(job.id);
        if (currentJob?.status !== 'processing') {
          return;
        }

        const batch = linkedinUrls.slice(i, i + batchSize);
        
        for (const urlData of batch) {
          try {
            const profile = await this.extractProfileWithRetry(
              user.linkedinAccessToken,
              urlData.url,
              3 // max retries
            );

            // Update profile record
            const profiles = await this.storage.getProfilesByJob(job.data.jobId);
            const profileRecord = profiles.find(p => p.linkedinUrl === urlData.url);
            
            if (profileRecord) {
              await this.storage.updateProfileStatus(profileRecord.id, 'success', {
                profileData: profile,
                extractedAt: new Date(),
                retryCount: profileRecord.retryCount || 0,
              });
            }

            successful++;
          } catch (error) {
            const profiles = await this.storage.getProfilesByJob(job.data.jobId);
            const profileRecord = profiles.find(p => p.linkedinUrl === urlData.url);
            
            if (profileRecord) {
              const errorType = this.categorizeError(error);
              const retryCount = (profileRecord.retryCount || 0) + 1;
              
              // Determine if profile should be retried
              const shouldRetry = retryCount < 3 && 
                                errorType !== CONFIG.ERROR_TYPES.NOT_FOUND &&
                                errorType !== CONFIG.ERROR_TYPES.ACCESS_RESTRICTED;
              
              await this.storage.updateProfileStatus(profileRecord.id, shouldRetry ? 'retrying' : 'failed', {
                errorType,
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                lastAttempt: new Date(),
                retryCount,
              });
            }

            failed++;
          }

          processed++;
          
          // Update job progress
          const elapsed = Date.now() - startTime;
          const rate = (processed / (elapsed / 1000 / 60)).toFixed(1); // profiles per minute
          const remaining = linkedinUrls.length - processed;
          const eta = remaining > 0 ? new Date(Date.now() + (remaining / parseFloat(rate)) * 60 * 1000) : null;

          await this.storage.updateJobStatus(job.data.jobId, 'processing', {
            processedProfiles: processed,
            successfulProfiles: successful,
            failedProfiles: failed,
            processingRate: `${rate} profiles/min`,
            estimatedCompletion: eta,
          });

          // Rate limiting - wait between requests
          await this.delay(CONFIG.JOB_PROCESSING.RATE_LIMIT_DELAY);
        }

        // Longer delay between batches
        await this.delay(CONFIG.JOB_PROCESSING.BATCH_DELAY);
      }

      // Job completed
      job.status = 'completed';
      
      // Generate results file
      const profiles = await this.storage.getProfilesByJob(job.data.jobId);
      const processedProfiles = profiles.map(p => {
        let profileData;
        try {
          profileData = p.profileData ? 
            (typeof p.profileData === 'string' ? JSON.parse(p.profileData) : p.profileData) : 
            undefined;
        } catch (parseError) {
          logger.error('Failed to parse profile data:', parseError);
          profileData = undefined;
        }
        
        return {
          url: p.linkedinUrl,
          status: p.status as 'success' | 'failed',
          data: profileData,
          error: p.errorMessage || undefined,
          errorType: p.errorType || undefined,
        };
      });

      // Need to create exporter instance here
      const { ExcelExporter } = await import('./excel/exporter');
      const exporter = new ExcelExporter();
      const resultPath = await exporter.saveJobResults(job.data.jobId, processedProfiles);

      await this.storage.updateJobStatus(job.data.jobId, 'completed', {
        completedAt: new Date(),
        resultPath,
      });

      // Clean up completed job from memory to prevent memory leaks
      this.jobs.delete(job.id);

    } catch (error) {
      job.status = 'failed';
      await this.storage.updateJobStatus(job.data.jobId, 'failed', {
        completedAt: new Date(),
      });
      
      // Clean up failed job from memory to prevent memory leaks
      this.jobs.delete(job.id);
    }
  }

  private async extractProfileWithRetry(
    accessToken: string, 
    profileUrl: string, 
    maxRetries: number
  ): Promise<any> {
    let retryCount = 0;
    let delay = 1000; // Start with 1 second

    while (retryCount < maxRetries) {
      try {
        // Simulate realistic API delay
        await this.delay(1500 + Math.random() * 1000);
        
        // Simulate 95% success rate for realistic behavior
        const shouldSucceed = Math.random() < 0.95;
        
        if (shouldSucceed) {
          // Use mock profile generator for realistic data
          const extractedProfile = mockProfileGenerator.generateProfileFromUrl(profileUrl);
          
          // Convert to LinkedIn profile format for compatibility
          return {
            id: profileUrl.split('/').pop() || 'unknown',
            firstName: extractedProfile.firstName,
            lastName: extractedProfile.lastName,
            headline: extractedProfile.headline,
          summary: extractedProfile.summary,
          industry: extractedProfile.industry,
          location: extractedProfile.location,
          publicProfileUrl: profileUrl,
          positions: extractedProfile.experience.map(exp => ({
            title: exp.title,
            company: exp.company,
            startDate: exp.duration.split('-')[0] || '',
            endDate: exp.duration.split('-')[1] || undefined,
            description: exp.description
          })),
          education: extractedProfile.education.map(edu => ({
            school: edu.school,
            degree: edu.degree,
            fieldOfStudy: edu.field,
            startDate: edu.year,
            endDate: edu.year
          })),
          skills: extractedProfile.skills,
          currentPosition: extractedProfile.currentPosition,
          currentCompany: extractedProfile.currentCompany,
          email: extractedProfile.email,
          phone: extractedProfile.phone,
          connections: extractedProfile.connections,
          profilePicture: extractedProfile.profilePicture
        };
        } else {
          // Simulate various LinkedIn API errors
          const errorTypes = ['rate_limit', 'profile_not_found', 'access_restricted', 'captcha_required'];
          const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
          throw new Error(`Simulated LinkedIn API error: ${errorType}`);
        }
      } catch (error) {
        const errorType = this.categorizeError(error);
        
        // Don't retry for certain error types
        if (errorType === CONFIG.ERROR_TYPES.ACCESS_RESTRICTED || errorType === CONFIG.ERROR_TYPES.NOT_FOUND) {
          throw error;
        }

        retryCount++;
        if (retryCount >= maxRetries) {
          throw error;
        }

        // Exponential backoff for retries
        await this.delay(delay);
        delay *= 2;
      }
    }

    throw new Error('Max retries exceeded');
  }

  private categorizeError(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('captcha') || message.includes('challenge')) {
        return CONFIG.ERROR_TYPES.CAPTCHA;
      } else if (message.includes('not found') || message.includes('404')) {
        return CONFIG.ERROR_TYPES.NOT_FOUND;
      } else if (message.includes('restricted') || message.includes('403') || message.includes('unauthorized')) {
        return CONFIG.ERROR_TYPES.ACCESS_RESTRICTED;
      } else if (message.includes('rate limit') || message.includes('429')) {
        return CONFIG.ERROR_TYPES.RATE_LIMIT;
      }
    }
    
    return 'unknown';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// JobQueue is now instantiated via the dependency container
// Import from './dependency-container' to use the jobQueue instance
