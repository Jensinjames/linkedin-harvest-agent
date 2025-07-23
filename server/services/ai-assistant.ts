import OpenAI from 'openai';
import type { Profile } from '@shared/schema';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ProfileAnalysis {
  summary: string;
  keySkills: string[];
  experienceLevel: 'Entry' | 'Mid' | 'Senior' | 'Executive';
  industryFocus: string;
  strengths: string[];
  potentialRoles: string[];
  networkingScore: number; // 1-10
  recommendations: string[];
}

export interface BulkAnalysis {
  totalProfiles: number;
  industryBreakdown: Record<string, number>;
  skillsFrequency: Record<string, number>;
  experienceDistribution: Record<string, number>;
  topTalent: Array<{ name: string; reason: string; linkedinUrl: string }>;
  insights: string[];
  recommendations: string[];
}

export class AIAssistantService {
  /**
   * Analyze a single LinkedIn profile using AI
   */
  async analyzeProfile(profile: Profile): Promise<ProfileAnalysis> {
    try {
      const prompt = `
Analyze this LinkedIn profile data and provide structured insights:

Name: ${profile.name || 'Not available'}
Headline: ${profile.headline || 'Not available'}
Location: ${profile.location || 'Not available'}
Summary: ${profile.summary || 'Not available'}
Experience: ${profile.experience || 'Not available'}
Education: ${profile.education || 'Not available'}
Skills: ${profile.skills || 'Not available'}
Connections: ${profile.connections || 'Not available'}

Please provide a comprehensive analysis in this exact JSON format:
{
  "summary": "2-3 sentence professional summary",
  "keySkills": ["skill1", "skill2", "skill3"],
  "experienceLevel": "Entry|Mid|Senior|Executive",
  "industryFocus": "primary industry",
  "strengths": ["strength1", "strength2", "strength3"],
  "potentialRoles": ["role1", "role2", "role3"],
  "networkingScore": 1-10,
  "recommendations": ["recommendation1", "recommendation2"]
}
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are an expert HR consultant and talent analyst. Provide professional, actionable insights about LinkedIn profiles. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 800,
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('No response from AI');
      }

      // Parse the JSON response
      const analysis = JSON.parse(response) as ProfileAnalysis;
      return analysis;
    } catch (error) {
      console.error('Error analyzing profile:', error);
      // Return a fallback analysis
      return {
        summary: 'Unable to analyze this profile at the moment.',
        keySkills: [],
        experienceLevel: 'Mid',
        industryFocus: 'Unknown',
        strengths: [],
        potentialRoles: [],
        networkingScore: 5,
        recommendations: ['Review profile data and try analysis again.']
      };
    }
  }

  /**
   * Analyze multiple profiles to provide bulk insights
   */
  async analyzeBulkProfiles(profiles: Profile[]): Promise<BulkAnalysis> {
    try {
      // Prepare data summary for AI analysis
      const profileSummaries = profiles.map(p => ({
        name: p.name,
        headline: p.headline,
        location: p.location,
        experience: p.experience,
        skills: p.skills,
        connections: p.connections
      }));

      const prompt = `
Analyze this collection of ${profiles.length} LinkedIn profiles and provide strategic insights:

${JSON.stringify(profileSummaries, null, 2)}

Provide comprehensive analysis in this exact JSON format:
{
  "totalProfiles": ${profiles.length},
  "industryBreakdown": {"industry1": count, "industry2": count},
  "skillsFrequency": {"skill1": count, "skill2": count},
  "experienceDistribution": {"Entry": count, "Mid": count, "Senior": count, "Executive": count},
  "topTalent": [{"name": "Name", "reason": "Why they stand out", "linkedinUrl": "url"}],
  "insights": ["insight1", "insight2", "insight3"],
  "recommendations": ["recommendation1", "recommendation2"]
}
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a senior talent analytics consultant. Analyze groups of LinkedIn profiles to identify patterns, top talent, and strategic recommendations. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1200,
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('No response from AI');
      }

      const analysis = JSON.parse(response) as BulkAnalysis;
      return analysis;
    } catch (error) {
      console.error('Error analyzing bulk profiles:', error);
      // Return fallback analysis
      return {
        totalProfiles: profiles.length,
        industryBreakdown: { 'Unknown': profiles.length },
        skillsFrequency: {},
        experienceDistribution: { 'Mid': profiles.length },
        topTalent: [],
        insights: ['Unable to analyze profiles at the moment.'],
        recommendations: ['Check profile data and retry analysis.']
      };
    }
  }

  /**
   * Generate actionable insights for recruiting strategy
   */
  async generateRecruitingInsights(profiles: Profile[], jobTitle?: string): Promise<string[]> {
    try {
      const context = jobTitle ? `for the role of ${jobTitle}` : 'for general recruiting purposes';
      
      const prompt = `
Based on these LinkedIn profiles, provide 5-7 specific recruiting insights ${context}:

Profiles summary:
${profiles.map(p => `${p.name}: ${p.headline} | ${p.location} | ${p.experience?.substring(0, 200)}`).join('\n')}

Provide actionable recruiting insights as a JSON array of strings:
["insight1", "insight2", "insight3", "insight4", "insight5"]
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a recruiting strategist. Provide specific, actionable insights for talent acquisition. Focus on practical recruiting strategies and candidate assessment. Always respond with valid JSON array only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.4,
        max_tokens: 600,
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('No response from AI');
      }

      return JSON.parse(response) as string[];
    } catch (error) {
      console.error('Error generating recruiting insights:', error);
      return [
        'Review candidate profiles for relevant experience',
        'Consider geographic distribution of candidates',
        'Assess skill alignment with role requirements',
        'Evaluate career progression patterns'
      ];
    }
  }

  /**
   * Chat with AI Assistant about profile data
   */
  async chatWithAssistant(message: string, context?: { profiles?: Profile[]; jobId?: number }): Promise<string> {
    try {
      let systemContext = "You are an AI assistant specializing in LinkedIn profile analysis and recruiting insights. Provide helpful, professional responses.";
      
      if (context?.profiles && context.profiles.length > 0) {
        const profileSummary = context.profiles.map(p => 
          `${p.name}: ${p.headline} (${p.location})`
        ).join(', ');
        systemContext += ` You currently have access to ${context.profiles.length} LinkedIn profiles: ${profileSummary}`;
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: systemContext
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.6,
        max_tokens: 800,
      });

      return completion.choices[0].message.content || 'I apologize, but I cannot provide a response at the moment.';
    } catch (error) {
      console.error('Error in chat with assistant:', error);
      return 'I apologize, but I encountered an error processing your request. Please try again.';
    }
  }
}

export const aiAssistant = new AIAssistantService();