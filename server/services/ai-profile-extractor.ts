import OpenAI from "openai";
import { storage } from "../storage";

interface ExtractedProfile {
  firstName: string;
  lastName: string;
  headline: string;
  summary: string;
  industry: string;
  location: string;
  currentPosition?: string;
  currentCompany?: string;
  skills: string[];
  experience: Array<{
    title: string;
    company: string;
    duration: string;
    description: string;
  }>;
  education: Array<{
    school: string;
    degree: string;
    field: string;
    year: string;
  }>;
}

export class AIProfileExtractor {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
  }

  async extractProfileFromURL(linkedinUrl: string): Promise<ExtractedProfile> {
    try {
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a professional LinkedIn profile analyzer. Extract structured profile information from LinkedIn URLs.
            
            Return a JSON object with the following structure:
            {
              "firstName": "string",
              "lastName": "string", 
              "headline": "string (professional title/tagline)",
              "summary": "string (brief professional summary)",
              "industry": "string",
              "location": "string (city, state/country)",
              "currentPosition": "string (current job title)",
              "currentCompany": "string (current employer)",
              "skills": ["array of key skills"],
              "experience": [
                {
                  "title": "string",
                  "company": "string",
                  "duration": "string (e.g., '2020-2023')",
                  "description": "string (brief role description)"
                }
              ],
              "education": [
                {
                  "school": "string",
                  "degree": "string", 
                  "field": "string",
                  "year": "string (graduation year)"
                }
              ]
            }
            
            If you cannot extract certain information from the URL alone, make reasonable inferences based on the LinkedIn ID/username in the URL.
            For example, from "linkedin.com/in/john-smith-engineer", you can infer the name might be John Smith and they might be in engineering.`
          },
          {
            role: "user",
            content: `Extract profile information from this LinkedIn URL: ${linkedinUrl}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 1000
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      
      // Validate and clean the extracted data
      return {
        firstName: result.firstName || "Unknown",
        lastName: result.lastName || "Unknown",
        headline: result.headline || "Professional",
        summary: result.summary || "LinkedIn profile",
        industry: result.industry || "Technology",
        location: result.location || "Unknown",
        currentPosition: result.currentPosition,
        currentCompany: result.currentCompany,
        skills: Array.isArray(result.skills) ? result.skills : [],
        experience: Array.isArray(result.experience) ? result.experience : [],
        education: Array.isArray(result.education) ? result.education : []
      };
    } catch (error) {
      console.error('AI extraction error:', error);
      // Fallback to basic extraction from URL
      return this.basicExtractionFromURL(linkedinUrl);
    }
  }

  private basicExtractionFromURL(linkedinUrl: string): ExtractedProfile {
    // Extract username from URL
    const match = linkedinUrl.match(/linkedin\.com\/in\/([^\/\?]+)/);
    const username = match ? match[1] : "unknown";
    
    // Try to extract name from username
    const nameParts = username.split('-').filter(part => !part.match(/^\d+$/));
    const firstName = nameParts[0] ? this.capitalize(nameParts[0]) : "Unknown";
    const lastName = nameParts[1] ? this.capitalize(nameParts[1]) : "User";
    
    return {
      firstName,
      lastName,
      headline: "LinkedIn Professional",
      summary: `Profile data for ${firstName} ${lastName}`,
      industry: "Professional Services",
      location: "Not specified",
      skills: [],
      experience: [],
      education: []
    };
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  async extractBulkProfiles(linkedinUrls: string[], jobId: number): Promise<Map<string, ExtractedProfile>> {
    const results = new Map<string, ExtractedProfile>();
    const batchSize = 5; // Process 5 at a time to avoid rate limits
    
    for (let i = 0; i < linkedinUrls.length; i += batchSize) {
      const batch = linkedinUrls.slice(i, i + batchSize);
      const batchPromises = batch.map(url => 
        this.extractProfileFromURL(url)
          .then(profile => ({ url, profile }))
          .catch(error => {
            console.error(`Failed to extract ${url}:`, error);
            return { url, profile: this.basicExtractionFromURL(url) };
          })
      );
      
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ url, profile }) => {
        results.set(url, profile);
      });
      
      // Update job progress
      const progress = Math.round(((i + batch.length) / linkedinUrls.length) * 100);
      await storage.updateJobStatus(jobId, 'processing', {
        processedProfiles: i + batch.length,
        processingRate: `${batch.length} profiles/batch`
      });
      
      // Small delay between batches to avoid rate limits
      if (i + batchSize < linkedinUrls.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }
}

export const aiProfileExtractor = new AIProfileExtractor();