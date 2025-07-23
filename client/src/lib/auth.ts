export interface LinkedInAuthConfig {
  clientId: string;
  redirectUri: string;
  scope: string[];
}

export function getLinkedInAuthUrl(config: LinkedInAuthConfig): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope.join(' '),
    state: generateRandomState(),
  });

  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

export function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

export function parseAuthCallback(url: string): { code?: string; error?: string; state?: string } {
  const urlParams = new URLSearchParams(new URL(url).search);
  return {
    code: urlParams.get('code') || undefined,
    error: urlParams.get('error') || undefined,
    state: urlParams.get('state') || undefined,
  };
}
