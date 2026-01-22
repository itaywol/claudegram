/**
 * OAuth flow handler for MCP servers requiring browser authentication
 *
 * For Telegram remote usage, we use a manual code entry flow:
 * 1. User opens OAuth URL in browser (on any device)
 * 2. After authorizing, user copies the code shown on screen
 * 3. User pastes the code back to Telegram bot
 * 4. Bot exchanges code for tokens and stores securely
 *
 * This works because we use redirect_uri that shows the code directly,
 * or for providers that don't support OOB, we use a simple redirect page.
 */

import { randomBytes } from "crypto";
import { storeSecret, getSecret } from "./mcp";
import { oauthLogger as log } from "./logger";

export interface OAuthProviderConfig {
  name: string;
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
  scopes: string[];
  redirectUri: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface PendingOAuthFlow {
  state: string;
  provider: string;
  config: OAuthProviderConfig;
  createdAt: Date;
  userId: number;
}

// Store pending OAuth flows awaiting code entry (keyed by state)
const pendingFlowsByState = new Map<string, PendingOAuthFlow>();
// Also index by userId for lookup
const pendingFlowsByUser = new Map<number, PendingOAuthFlow>();

// Cleanup old pending flows every 10 minutes
setInterval(() => {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  for (const [state, flow] of pendingFlowsByState.entries()) {
    if (flow.createdAt < tenMinutesAgo) {
      pendingFlowsByState.delete(state);
      pendingFlowsByUser.delete(flow.userId);
      log.debug("Cleaned up expired OAuth flow", { state, provider: flow.provider });
    }
  }
}, 10 * 60 * 1000);

// Well-known OAuth configurations for common MCP providers
// Note: redirectUri will be set based on what the provider supports
export const OAUTH_PROVIDERS: Record<string, {
  name: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  supportsOOB: boolean; // Does it support urn:ietf:wg:oauth:2.0:oob redirect?
  codeInUrl?: boolean;  // Does the code appear in the redirect URL fragment?
}> = {
  google: {
    name: "Google",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/calendar"],
    supportsOOB: true, // Google supports OOB - shows code on screen
  },
  github: {
    name: "GitHub",
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scopes: ["repo", "read:user"],
    supportsOOB: false, // GitHub requires a real redirect URI
  },
  slack: {
    name: "Slack",
    authUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    scopes: ["channels:read", "chat:write", "users:read"],
    supportsOOB: false,
  },
  microsoft: {
    name: "Microsoft",
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["offline_access", "User.Read", "Calendars.ReadWrite"],
    supportsOOB: false, // Microsoft requires registered redirect URI
  },
  linear: {
    name: "Linear",
    authUrl: "https://linear.app/oauth/authorize",
    tokenUrl: "https://api.linear.app/oauth/token",
    scopes: ["read", "write"],
    supportsOOB: false,
  },
};

/**
 * Generate a cryptographically secure state parameter
 */
export function generateOAuthState(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Create an OAuth authorization URL for remote/manual code entry
 */
export function createAuthorizationUrl(
  providerKey: string,
  clientId: string,
  state: string,
  customScopes?: string[],
  customRedirectUri?: string
): { url: string; redirectUri: string } {
  const provider = OAUTH_PROVIDERS[providerKey];
  if (!provider) {
    throw new Error(`Unknown OAuth provider: ${providerKey}. Available: ${Object.keys(OAUTH_PROVIDERS).join(", ")}`);
  }

  // Determine redirect URI
  // For OOB-supporting providers, use the special URI that shows code on screen
  // Otherwise, we need to instruct user to copy from URL bar
  let redirectUri: string;
  if (customRedirectUri) {
    redirectUri = customRedirectUri;
  } else if (provider.supportsOOB) {
    redirectUri = "urn:ietf:wg:oauth:2.0:oob";
  } else {
    // Use a placeholder that will show the code in the URL
    // User will need to copy from URL bar after redirect fails
    redirectUri = "http://localhost:9999/oauth/callback";
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: (customScopes || provider.scopes).join(" "),
    state,
  });

  // Google-specific: request offline access for refresh tokens
  if (providerKey === "google") {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
  }

  return {
    url: `${provider.authUrl}?${params.toString()}`,
    redirectUri,
  };
}

/**
 * Start an OAuth flow for a user
 * Returns instructions and URL to send to the user
 */
export interface OAuthFlowStart {
  authUrl: string;
  state: string;
  instructions: string;
  provider: string;
}

export function startOAuthFlow(
  userId: number,
  providerKey: string,
  clientId: string,
  clientSecret?: string,
  customScopes?: string[],
  customRedirectUri?: string
): OAuthFlowStart {
  const provider = OAUTH_PROVIDERS[providerKey];
  if (!provider) {
    throw new Error(`Unknown OAuth provider: ${providerKey}`);
  }

  // Cancel any existing flow for this user
  const existingFlow = pendingFlowsByUser.get(userId);
  if (existingFlow) {
    pendingFlowsByState.delete(existingFlow.state);
    pendingFlowsByUser.delete(userId);
  }

  const state = generateOAuthState();
  const { url, redirectUri } = createAuthorizationUrl(
    providerKey,
    clientId,
    state,
    customScopes,
    customRedirectUri
  );

  // Store the pending flow
  const flow: PendingOAuthFlow = {
    state,
    provider: providerKey,
    config: {
      name: provider.name,
      authUrl: provider.authUrl,
      tokenUrl: provider.tokenUrl,
      clientId,
      clientSecret,
      scopes: customScopes || provider.scopes,
      redirectUri,
    },
    createdAt: new Date(),
    userId,
  };

  pendingFlowsByState.set(state, flow);
  pendingFlowsByUser.set(userId, flow);

  log.info("Started OAuth flow", { userId, provider: providerKey, state });

  // Generate instructions based on provider type
  let instructions: string;
  if (provider.supportsOOB) {
    instructions = `*${provider.name} Authentication*

1. Open this link in your browser:
   (tap to open)

2. Sign in and authorize access

3. You'll see a code on the screen

4. Copy the code and send it here

The code looks like: \`4/0A...\` or similar`;
  } else {
    instructions = `*${provider.name} Authentication*

1. Open this link in your browser:
   (tap to open)

2. Sign in and authorize access

3. You'll be redirected to a page that won't load
   (this is expected!)

4. Copy the *entire URL* from your browser's address bar

5. Send the URL here - I'll extract the code

The URL will contain \`?code=...\``;
  }

  return { authUrl: url, state, instructions, provider: providerKey };
}

/**
 * Check if a user has a pending OAuth flow
 */
export function hasPendingOAuthFlow(userId: number): boolean {
  return pendingFlowsByUser.has(userId);
}

/**
 * Get pending flow for a user
 */
export function getPendingOAuthFlow(userId: number): PendingOAuthFlow | undefined {
  return pendingFlowsByUser.get(userId);
}

/**
 * Cancel a pending OAuth flow
 */
export function cancelOAuthFlow(userId: number): boolean {
  const flow = pendingFlowsByUser.get(userId);
  if (!flow) return false;

  pendingFlowsByState.delete(flow.state);
  pendingFlowsByUser.delete(userId);
  log.info("Cancelled OAuth flow", { userId, provider: flow.provider });
  return true;
}

/**
 * Complete an OAuth flow by exchanging the code for tokens
 * Accepts either a raw code or a full redirect URL containing the code
 */
export async function completeOAuthFlow(
  userId: number,
  codeOrUrl: string
): Promise<{ success: true; tokens: OAuthTokens; provider: string } | { success: false; error: string }> {
  const flow = pendingFlowsByUser.get(userId);
  if (!flow) {
    return { success: false, error: "No pending OAuth flow. Please start authentication again." };
  }

  // Extract code from URL if a full URL was provided
  let code = codeOrUrl.trim();
  if (code.includes("?") || code.includes("code=")) {
    try {
      // Try to parse as URL
      const url = new URL(code.startsWith("http") ? code : `http://localhost${code}`);
      const extractedCode = url.searchParams.get("code");
      if (extractedCode) {
        code = extractedCode;
      }
    } catch {
      // Not a valid URL, try regex extraction
      const match = code.match(/[?&]code=([^&\s]+)/);
      if (match?.[1]) {
        code = match[1];
      }
    }
  }

  // Validate we have something that looks like a code
  if (!code || code.length < 10) {
    return { success: false, error: "Invalid code format. Please copy the complete code or URL." };
  }

  log.info("Completing OAuth flow", { userId, provider: flow.provider, codeLength: code.length });

  try {
    const tokens = await exchangeCodeForTokens(flow.config, code);

    // Store tokens securely
    await storeOAuthTokens(flow.provider, tokens);

    // Clean up the pending flow
    pendingFlowsByState.delete(flow.state);
    pendingFlowsByUser.delete(userId);

    log.info("OAuth flow completed successfully", { userId, provider: flow.provider });

    return { success: true, tokens, provider: flow.provider };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error("OAuth token exchange failed", { userId, provider: flow.provider, error: errorMsg });

    // Don't clean up the flow - let user retry
    return { success: false, error: `Token exchange failed: ${errorMsg}` };
  }
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  config: OAuthProviderConfig,
  code: string
): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
  });

  if (config.clientSecret) {
    body.set("client_secret", config.clientSecret);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };

  // GitHub requires Accept header for JSON response
  if (config.tokenUrl.includes("github.com")) {
    headers["Accept"] = "application/json";
  }

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers,
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (data.error) {
    throw new Error(data.error_description || data.error);
  }

  if (!data.access_token) {
    throw new Error("No access token in response");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
  };
}

/**
 * Refresh an access token using a refresh token
 */
export async function refreshAccessToken(
  providerKey: string,
  clientId: string,
  clientSecret?: string
): Promise<OAuthTokens | null> {
  const provider = OAUTH_PROVIDERS[providerKey];
  if (!provider) return null;

  const existingTokens = await getStoredOAuthTokens(providerKey);
  if (!existingTokens?.refreshToken) return null;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: existingTokens.refreshToken,
    client_id: clientId,
  });

  if (clientSecret) {
    body.set("client_secret", clientSecret);
  }

  try {
    const response = await fetch(provider.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      log.error("Token refresh failed", { provider: providerKey, status: response.status });
      return null;
    }

    const data = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!data.access_token) return null;

    const tokens: OAuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || existingTokens.refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };

    await storeOAuthTokens(providerKey, tokens);
    log.info("Token refreshed successfully", { provider: providerKey });

    return tokens;
  } catch (error) {
    log.error("Token refresh error", { provider: providerKey, error: String(error) });
    return null;
  }
}

/**
 * Store OAuth tokens securely
 */
export async function storeOAuthTokens(
  providerName: string,
  tokens: OAuthTokens
): Promise<void> {
  const tokenData = JSON.stringify({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt?.toISOString(),
  });

  await storeSecret(`oauth_${providerName}`, tokenData);
  log.debug("Stored OAuth tokens", { provider: providerName });
}

/**
 * Retrieve stored OAuth tokens
 */
export async function getStoredOAuthTokens(providerName: string): Promise<OAuthTokens | null> {
  const tokenData = await getSecret(`oauth_${providerName}`);
  if (!tokenData) return null;

  try {
    const parsed = JSON.parse(tokenData) as {
      accessToken: string;
      refreshToken?: string;
      expiresAt?: string;
    };
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Check if tokens are expired or about to expire (within 5 minutes)
 */
export function areTokensExpired(tokens: OAuthTokens): boolean {
  if (!tokens.expiresAt) return false;
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  return tokens.expiresAt < fiveMinutesFromNow;
}

/**
 * Get a valid access token, refreshing if necessary
 */
export async function getValidAccessToken(
  providerKey: string,
  clientId: string,
  clientSecret?: string
): Promise<string | null> {
  const tokens = await getStoredOAuthTokens(providerKey);
  if (!tokens) return null;

  if (!areTokensExpired(tokens)) {
    return tokens.accessToken;
  }

  // Try to refresh
  const refreshed = await refreshAccessToken(providerKey, clientId, clientSecret);
  return refreshed?.accessToken || null;
}

/**
 * Delete stored OAuth tokens for a provider
 */
export async function deleteOAuthTokens(providerName: string): Promise<void> {
  const { deleteSecret } = await import("./mcp");
  await deleteSecret(`oauth_${providerName}`);
  log.info("Deleted OAuth tokens", { provider: providerName });
}

/**
 * List all providers with stored tokens
 */
export async function listAuthenticatedProviders(): Promise<string[]> {
  const { listSecrets } = await import("./mcp");
  const secrets = await listSecrets();
  return secrets
    .filter((s) => s.startsWith("oauth_"))
    .map((s) => s.replace("oauth_", ""));
}
