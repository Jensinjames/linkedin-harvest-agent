import fs from 'fs';
import path from 'path';
import { storage } from '../../storage';
import type { ProcessedProfile } from '@shared/schema';
import { AppError } from '../../types/errors';

export class ExcelExporter {
  async exportResults(userId: number, type: 'successful' | 'failed' | 'all'): Promise<Buffer> {
    try {
      const jobs = await storage.getJobsByUser(userId);
      let profiles: any[] = [];

      for (const job of jobs) {
        const jobProfiles = await storage.getProfilesByJob(job.id);
        profiles.push(...jobProfiles);
      }

      // Filter based on type
      switch (type) {
        case 'successful':
          profiles = profiles.filter(p => p.status === 'success');
          break;
        case 'failed':
          profiles = profiles.filter(p => p.status === 'failed');
          break;
      }

      const XLSX = await import('xlsx');
      const worksheet = XLSX.default.utils.json_to_sheet(
        profiles.map(p => ({
          'LinkedIn URL': p.linkedinUrl,
          'Status': p.status,
          'First Name': p.profileData?.firstName || '',
          'Last Name': p.profileData?.lastName || '',
          'Headline': p.profileData?.headline || '',
          'Location': p.profileData?.location || '',
          'Industry': p.profileData?.industry || '',
          'Error Type': p.errorType || '',
          'Error Message': p.errorMessage || '',
          'Retry Count': p.retryCount || 0,
          'Last Attempt': p.lastAttempt || '',
          'Extracted At': p.extractedAt || '',
        }))
      );

      const workbook = XLSX.default.utils.book_new();
      XLSX.default.utils.book_append_sheet(workbook, worksheet, 'Profiles');

      return XLSX.default.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    } catch (error) {
      throw new AppError(`Failed to export results: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async saveJobResults(jobId: number, processedProfiles: ProcessedProfile[]): Promise<string> {
    try {
      const job = await storage.getJob(jobId);
      if (!job) {
        throw new AppError('Job not found', 404);
      }

      const XLSX = await import('xlsx');
      
      // Transform profiles to spreadsheet format
      const data = processedProfiles.map((profile, index) => {
        const row: any = {
          'Row #': index + 1,
          'LinkedIn URL': profile.url,
          'Status': profile.status,
        };

        if (profile.status === 'success' && profile.data) {
          row['First Name'] = profile.data.firstName || '';
          row['Last Name'] = profile.data.lastName || '';
          row['Headline'] = profile.data.headline || '';
          row['Location'] = profile.data.location || '';
          row['Industry'] = profile.data.industry || '';
          row['Current Position'] = profile.data.currentPosition || '';
          row['Current Company'] = profile.data.currentCompany || '';
          row['Summary'] = profile.data.summary || '';
          
          // Skills as comma-separated list
          if (profile.data.skills && Array.isArray(profile.data.skills)) {
            row['Skills'] = profile.data.skills.join(', ');
          }
          
          // Experience summary
          if (profile.data.experience && profile.data.experience.length > 0) {
            row['Years of Experience'] = profile.data.experience.length;
            row['Latest Position'] = profile.data.experience[0]?.title || '';
            row['Latest Company'] = profile.data.experience[0]?.company || '';
          }
          
          // Education summary
          if (profile.data.education && profile.data.education.length > 0) {
            row['Highest Education'] = profile.data.education[0]?.degree || '';
            row['School'] = profile.data.education[0]?.school || '';
            row['Field of Study'] = profile.data.education[0]?.field || '';
          }
        } else if (profile.status === 'failed' || profile.status === 'retrying') {
          row['Error Type'] = profile.errorType || 'Unknown';
          row['Error Message'] = profile.error || 'Failed to extract profile';
          row['Retry Count'] = profile.retryCount || 0;
          row['Status'] = profile.status;
        }

        return row;
      });

      // Create worksheet and workbook
      const worksheet = XLSX.default.utils.json_to_sheet(data);
      const workbook = XLSX.default.utils.book_new();
      
      // Auto-size columns
      const keys = Object.keys(data[0] || {});
      const colWidths = keys.map(key => ({
        wch: Math.max(key.length, 15)
      }));
      worksheet['!cols'] = colWidths;

      XLSX.default.utils.book_append_sheet(workbook, worksheet, 'Results');

      // Save to file
      const resultsDir = 'results';
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }

      const resultPath = path.join(resultsDir, `job_${jobId}_results.xlsx`);
      XLSX.default.writeFile(workbook, resultPath);

      return resultPath;
    } catch (error) {
      throw new AppError(`Failed to save job results: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}