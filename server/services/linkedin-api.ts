interface LinkedInTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  headline: string;
  summary: string;
  industry: string;
  location: string;
  profilePictureUrl: string;
  publicProfileUrl: string;
  positions: Array<{
    title: string;
    company: string;
    startDate: string;
    endDate?: string;
    description: string;
  }>;
  education: Array<{
    school: string;
    degree: string;
    fieldOfStudy: string;
    startDate: string;
    endDate?: string;
  }>;
}

export class LinkedInService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.LINKEDIN_CLIENT_ID || process.env.VITE_LINKEDIN_CLIENT_ID || "default_client_id";
    this.clientSecret = process.env.LINKEDIN_CLIENT_SECRET || "default_client_secret";
    this.redirectUri = process.env.LINKEDIN_REDIRECT_URI || `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000'}/api/auth/linkedin/callback`;
  }

  getAuthUrl(): string {
    const scopes = [
      'r_liteprofile',
      'r_emailaddress',
      'w_member_social'
    ].join(' ');

    const state = this.generateRandomState();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: scopes,
      state,
    });

    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<LinkedInTokens> {
    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`LinkedIn token exchange failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || '',
      expiresIn: data.expires_in,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<LinkedInTokens> {
    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`LinkedIn token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in,
    };
  }

  async getProfile(accessToken: string, profileUrl: string): Promise<LinkedInProfile> {
    // Extract LinkedIn ID from URL
    const linkedinId = this.extractLinkedInId(profileUrl);
    if (!linkedinId) {
      throw new Error('profile_url_invalid');
    }

    try {
      console.log(`Fetching LinkedIn profile for ID: ${linkedinId}`);
      
      // Get basic profile information
      const profileResponse = await fetch('https://api.linkedin.com/v2/people/(id:' + linkedinId + ')', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Connection': 'Keep-Alive',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      if (!profileResponse.ok) {
        console.error(`LinkedIn API error: ${profileResponse.status} - ${profileResponse.statusText}`);
        if (profileResponse.status === 403) {
          throw new Error('access_restricted');
        } else if (profileResponse.status === 404) {
          throw new Error('profile_not_found');
        } else if (profileResponse.status === 429) {
          throw new Error('rate_limit_exceeded');
        } else if (profileResponse.status === 401) {
          throw new Error('unauthorized_token_expired');
        }
        throw new Error(`linkedin_api_error_${profileResponse.status}`);
      }

      const profileData = await profileResponse.json();

      // Get positions
      const positionsResponse = await fetch(`https://api.linkedin.com/v2/positions?person=(id:${linkedinId})`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      let positions = [];
      if (positionsResponse.ok) {
        const positionsData = await positionsResponse.json();
        positions = positionsData.elements || [];
      }

      // Get education
      const educationResponse = await fetch(`https://api.linkedin.com/v2/educations?person=(id:${linkedinId})`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      let education = [];
      if (educationResponse.ok) {
        const educationData = await educationResponse.json();
        education = educationData.elements || [];
      }

      return {
        id: profileData.id,
        firstName: profileData.firstName?.localized?.en_US || '',
        lastName: profileData.lastName?.localized?.en_US || '',
        headline: profileData.headline?.localized?.en_US || '',
        summary: profileData.summary?.localized?.en_US || '',
        industry: profileData.industry || '',
        location: profileData.location?.name || '',
        profilePictureUrl: profileData.profilePicture?.['displayImage~']?.elements?.[0]?.identifiers?.[0]?.identifier || '',
        publicProfileUrl: profileUrl,
        positions: positions.map((pos: any) => ({
          title: pos.title?.localized?.en_US || '',
          company: pos.companyName?.localized?.en_US || '',
          startDate: pos.dateRange?.start ? `${pos.dateRange.start.year}-${pos.dateRange.start.month || 1}` : '',
          endDate: pos.dateRange?.end ? `${pos.dateRange.end.year}-${pos.dateRange.end.month || 1}` : undefined,
          description: pos.description?.localized?.en_US || '',
        })),
        education: education.map((edu: any) => ({
          school: edu.schoolName?.localized?.en_US || '',
          degree: edu.degreeName?.localized?.en_US || '',
          fieldOfStudy: edu.fieldOfStudy?.localized?.en_US || '',
          startDate: edu.dateRange?.start ? `${edu.dateRange.start.year}-${edu.dateRange.start.month || 1}` : '',
          endDate: edu.dateRange?.end ? `${edu.dateRange.end.year}-${edu.dateRange.end.month || 1}` : undefined,
        })),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred while fetching profile');
    }
  }

  private extractLinkedInId(profileUrl: string): string | null {
    // Extract LinkedIn ID from various URL formats
    const patterns = [
      /linkedin\.com\/in\/([^\/\?]+)/,
      /linkedin\.com\/pub\/[^\/]+\/[^\/]+\/[^\/]+\/([^\/\?]+)/,
    ];

    for (const pattern of patterns) {
      const match = profileUrl.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  private generateRandomState(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  async withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    const maxRetries = 3;
    let retryCount = 0;
    let delay = 1000; // Start with 1 second

    while (retryCount < maxRetries) {
      try {
        return await fn();
      } catch (error) {
        if (error instanceof Error && error.message === 'rate_limit') {
          retryCount++;
          if (retryCount >= maxRetries) {
            throw new Error('Rate limit exceeded, max retries reached');
          }
          
          // Exponential backoff
          await this.delay(delay);
          delay *= 2;
        } else {
          throw error;
        }
      }
    }

    throw new Error('Unexpected error in rate limit handler');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const linkedInService = new LinkedInService();
