import fs from 'fs';
import type { LinkedInUrl } from '@shared/schema';
import { CONFIG } from '../../config/constants';

export class ExcelParser {
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

  async validateExcelFile(filePath: string): Promise<{ valid: boolean; error?: string }> {
    try {
      if (!fs.existsSync(filePath)) {
        return { valid: false, error: 'File does not exist' };
      }

      const stats = fs.statSync(filePath);
      
      if (stats.size > CONFIG.FILE_UPLOAD.MAX_SIZE) {
        return { valid: false, error: `File size exceeds ${CONFIG.FILE_UPLOAD.MAX_SIZE / 1024 / 1024}MB limit` };
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