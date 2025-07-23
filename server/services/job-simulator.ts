import { storage } from '../storage';

interface SimulationConfig {
  minDelay: number;
  maxDelay: number;
  successRate: number;
}

export class JobSimulator {
  private readonly config: SimulationConfig = {
    minDelay: 1000,
    maxDelay: 3000,
    successRate: 0.95 // Increased to 95% for more realistic success rate
  };

  async simulateJobProcessing(jobId: number): Promise<void> {
    const job = await storage.getJob(jobId);
    if (!job) return;

    const profiles = await storage.getProfilesByJob(jobId);
    const totalProfiles = profiles.length;
    let processed = 0;
    let successful = 0;
    let failed = 0;

    // Simulate processing each profile
    for (const profile of profiles) {
      // Random delay between min and max
      const delay = this.config.minDelay + Math.random() * (this.config.maxDelay - this.config.minDelay);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Determine success based on configured rate
      const isSuccess = Math.random() < this.config.successRate;
      
      if (isSuccess) {
        const mockProfileData = this.generateMockProfileData();
        await storage.updateProfileStatus(profile.id, 'success', {
          profileData: mockProfileData,
          extractedAt: new Date(),
        });
        successful++;
      } else {
        const { errorType, errorMessage } = this.generateRandomError();
        await storage.updateProfileStatus(profile.id, 'failed', {
          errorType,
          errorMessage,
          lastAttempt: new Date(),
        });
        failed++;
      }

      processed++;

      // Update job progress
      const processingRate = this.calculateProcessingRate(processed, job.startedAt || new Date());
      const estimatedCompletion = this.calculateETA(totalProfiles - processed, processingRate);

      await storage.updateJobStatus(jobId, 'processing', {
        processedProfiles: processed,
        successfulProfiles: successful,
        failedProfiles: failed,
        processingRate: `${processingRate.toFixed(1)} profiles/min`,
        estimatedCompletion,
        errorBreakdown: await this.getErrorBreakdown(jobId),
      });
    }

    // Mark job as completed
    await storage.updateJobStatus(jobId, 'completed', {
      completedAt: new Date(),
    });
  }

  private generateMockProfileData() {
    const firstNames = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa'];
    const lastNames = ['Doe', 'Smith', 'Johnson', 'Wilson', 'Brown', 'Davis', 'Miller', 'Taylor'];
    const titles = ['Software Engineer', 'Product Manager', 'Marketing Director', 'Data Scientist', 'UX Designer', 'Sales Executive', 'HR Manager', 'Operations Lead'];
    const companies = ['Tech Corp', 'Global Solutions', 'Innovation Labs', 'Digital Ventures', 'Future Systems'];
    const industries = ['Technology', 'Finance', 'Healthcare', 'Education', 'Marketing', 'Retail', 'Manufacturing'];
    const locations = ['San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Austin, TX', 'Chicago, IL', 'Boston, MA', 'Denver, CO'];
    const schools = ['University of Technology', 'State University', 'Tech Institute', 'Business School', 'Engineering College'];
    const degrees = ['Bachelor of Science', 'Master of Science', 'Bachelor of Arts', 'MBA', 'PhD'];
    const fields = ['Computer Science', 'Business Administration', 'Marketing', 'Data Science', 'Engineering'];

    return {
      id: Math.random().toString(36).substr(2, 9),
      firstName: this.randomChoice(firstNames),
      lastName: this.randomChoice(lastNames),
      headline: this.randomChoice(titles),
      summary: 'Experienced professional with a passion for innovation and technology. Proven track record of delivering results in fast-paced environments.',
      industry: this.randomChoice(industries),
      location: this.randomChoice(locations),
      positions: [{
        title: this.randomChoice(titles),
        company: this.randomChoice(companies),
        startDate: '2022-01',
        endDate: null,
        description: 'Leading development of innovative software solutions and managing cross-functional teams.'
      }],
      education: [{
        school: this.randomChoice(schools),
        degree: this.randomChoice(degrees),
        fieldOfStudy: this.randomChoice(fields),
        startDate: '2018-09',
        endDate: '2022-05'
      }],
      skills: this.generateRandomSkills(),
    };
  }

  private generateRandomSkills(): string[] {
    const allSkills = [
      'JavaScript', 'Python', 'Java', 'React', 'Node.js', 'SQL', 'AWS', 'Docker',
      'Machine Learning', 'Data Analysis', 'Project Management', 'Agile', 'Leadership',
      'Communication', 'Problem Solving', 'Strategic Planning', 'Marketing', 'Sales'
    ];
    
    const numSkills = 5 + Math.floor(Math.random() * 5);
    const skills: string[] = [];
    
    for (let i = 0; i < numSkills; i++) {
      const skill = this.randomChoice(allSkills);
      if (!skills.includes(skill)) {
        skills.push(skill);
      }
    }
    
    return skills;
  }

  private generateRandomError(): { errorType: string; errorMessage: string } {
    const errors = [
      { errorType: 'captcha', errorMessage: 'Failed to extract profile: CAPTCHA verification required' },
      { errorType: 'not_found', errorMessage: 'Failed to extract profile: Profile not found or deleted' },
      { errorType: 'access_restricted', errorMessage: 'Failed to extract profile: Access restricted - premium account required' },
      { errorType: 'rate_limit', errorMessage: 'Failed to extract profile: Rate limit exceeded' },
    ];
    
    return this.randomChoice(errors);
  }

  private randomChoice<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  private calculateProcessingRate(processed: number, startTime: Date): number {
    const elapsedMinutes = (Date.now() - startTime.getTime()) / 60000;
    return elapsedMinutes > 0 ? processed / elapsedMinutes : 0;
  }

  private calculateETA(remaining: number, rate: number): Date | null {
    if (remaining <= 0 || rate <= 0) return null;
    const minutesRemaining = remaining / rate;
    return new Date(Date.now() + minutesRemaining * 60000);
  }

  private async getErrorBreakdown(jobId: number): Promise<Record<string, number>> {
    const profiles = await storage.getProfilesByJob(jobId);
    const breakdown: Record<string, number> = {};
    
    profiles.forEach(profile => {
      if (profile.errorType) {
        breakdown[profile.errorType] = (breakdown[profile.errorType] || 0) + 1;
      }
    });
    
    return breakdown;
  }
}

export const jobSimulator = new JobSimulator();