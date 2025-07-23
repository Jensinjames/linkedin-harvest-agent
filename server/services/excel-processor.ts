import fs from 'fs';
import path from 'path';
import { storage } from '../storage';
import type { LinkedInUrl, ProcessedProfile } from '@shared/schema';

class ExcelProcessor {
  async parseLinkedInUrls(filePath: string): Promise<LinkedInUrl[]> {
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.default.readFile(filePath);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.default.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      const linkedinUrls: LinkedInUrl[] = [];
      const linkedinPattern = /linkedin\.com\/(in|pub)\//i;

      // Find columns that contain LinkedIn URLs
      for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
        const row = data[rowIndex];
        
        for (let colIndex = 0; colIndex < row.length; colIndex++) {
          const cellValue = row[colIndex];
          
          if (typeof cellValue === 'string' && linkedinPattern.test(cellValue)) {
            // Extract additional data from the same row
            const additionalData: Record<string, any> = {};
            row.forEach((cell, idx) => {
              if (idx !== colIndex && cell) {
                additionalData[`column_${idx}`] = cell;
              }
            });

            linkedinUrls.push({
              url: cellValue.trim(),
              rowIndex,
              additionalData,
            });
          }
        }
      }

      return linkedinUrls;
    } catch (error) {
      throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

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
        // 'all' includes everything
      }

      // Prepare data for Excel export
      const excelData = profiles.map(profile => {
        const baseData = {
          'LinkedIn URL': profile.linkedinUrl,
          'Status': profile.status,
          'Extraction Date': profile.extractedAt?.toISOString().split('T')[0] || '',
          'Error Type': profile.errorType || '',
          'Error Message': profile.errorMessage || '',
          'Retry Count': profile.retryCount || 0,
        };

        // Add profile data if available
        if (profile.profileData) {
          const data = typeof profile.profileData === 'string' 
            ? JSON.parse(profile.profileData) 
            : profile.profileData;

          return {
            ...baseData,
            'First Name': data.firstName || '',
            'Last Name': data.lastName || '',
            'Headline': data.headline || '',
            'Summary': data.summary || '',
            'Industry': data.industry || '',
            'Location': data.location || '',
            'Current Position': data.positions?.[0]?.title || '',
            'Current Company': data.positions?.[0]?.company || '',
            'Education': data.education?.[0]?.school || '',
            'Degree': data.education?.[0]?.degree || '',
          };
        }

        return baseData;
      });

      // Create workbook
      const XLSX = await import('xlsx');
      const workbook = XLSX.default.utils.book_new();
      const worksheet = XLSX.default.utils.json_to_sheet(excelData);

      // Auto-size columns
      const colWidths = Object.keys(excelData[0] || {}).map(key => ({
        wch: Math.max(key.length, 15)
      }));
      worksheet['!cols'] = colWidths;

      XLSX.default.utils.book_append_sheet(workbook, worksheet, 'LinkedIn Data');

      // Generate buffer
      const buffer = XLSX.default.write(workbook, { 
        type: 'buffer', 
        bookType: 'xlsx',
        compression: true 
      });

      return buffer;
    } catch (error) {
      throw new Error(`Failed to export results: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async saveJobResults(jobId: number, profiles: ProcessedProfile[]): Promise<string> {
    try {
      const job = await storage.getJob(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      // Prepare data for Excel export
      const excelData = profiles.map(profile => ({
        'LinkedIn URL': profile.url,
        'Status': profile.status,
        'First Name': profile.data?.firstName || '',
        'Last Name': profile.data?.lastName || '',
        'Headline': profile.data?.headline || '',
        'Summary': profile.data?.summary || '',
        'Industry': profile.data?.industry || '',
        'Location': profile.data?.location || '',
        'Current Position': profile.data?.positions?.[0]?.title || '',
        'Current Company': profile.data?.positions?.[0]?.company || '',
        'Education': profile.data?.education?.[0]?.school || '',
        'Degree': profile.data?.education?.[0]?.degree || '',
        'Error Type': profile.errorType || '',
        'Error Message': profile.error || '',
      }));

      // Create workbook
      const XLSX = await import('xlsx');
      const workbook = XLSX.default.utils.book_new();
      const worksheet = XLSX.default.utils.json_to_sheet(excelData);

      // Auto-size columns
      const colWidths = Object.keys(excelData[0] || {}).map(key => ({
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
      throw new Error(`Failed to save job results: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async validateExcelFile(filePath: string): Promise<{ valid: boolean; error?: string }> {
    try {
      if (!fs.existsSync(filePath)) {
        return { valid: false, error: 'File does not exist' };
      }

      const stats = fs.statSync(filePath);
      const maxSize = 50 * 1024 * 1024; // 50MB
      
      if (stats.size > maxSize) {
        return { valid: false, error: 'File size exceeds 50MB limit' };
      }

      // Try to read the file
      const XLSX = await import('xlsx');
      const workbook = XLSX.default.readFile(filePath);
      if (!workbook.SheetNames.length) {
        return { valid: false, error: 'No worksheets found in file' };
      }

      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: `Invalid Excel file: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
}

export const excelProcessor = new ExcelProcessor();
