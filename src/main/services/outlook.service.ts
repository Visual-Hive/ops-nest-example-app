import { Client } from '@microsoft/microsoft-graph-client';
import { getStore } from '../store';
import { getCallbackUrl } from '../server';

// Azure AD multi-tenant app configuration
// These are registered during development - user never sees Azure Portal
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || 'YOUR_CLIENT_ID_HERE';
const MICROSOFT_TENANT = 'common'; // Multi-tenant
const MICROSOFT_SCOPES = ['Mail.Read', 'Mail.Send', 'User.Read', 'offline_access'];

let graphClient: Client | null = null;

export function getMicrosoftAuthUrl(): string {
  const redirectUri = getCallbackUrl('microsoft');
  const params = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: MICROSOFT_SCOPES.join(' '),
    response_mode: 'query',
    // PKCE flow - no client secret needed
    code_challenge_method: 'S256',
  });

  return `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/authorize?${params}`;
}

export async function handleMicrosoftCallback(code: string): Promise<void> {
  const redirectUri = getCallbackUrl('microsoft');

  const response = await fetch(
    `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        scope: MICROSOFT_SCOPES.join(' '),
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const tokens = await response.json();
  const store = getStore();
  store.set('microsoftAccessToken', tokens.access_token);
  store.set('microsoftRefreshToken', tokens.refresh_token);
  store.set('microsoftTokenExpiry', Date.now() + tokens.expires_in * 1000);

  graphClient = null; // Reset client to pick up new token
}

async function refreshMicrosoftToken(): Promise<string> {
  const store = getStore();
  const refreshToken = store.get('microsoftRefreshToken');
  if (!refreshToken) {
    throw new Error('No refresh token available. Please sign in again.');
  }

  const response = await fetch(
    `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: MICROSOFT_SCOPES.join(' '),
      }),
    }
  );

  if (!response.ok) {
    throw new Error('Token refresh failed. Please sign in again.');
  }

  const tokens = await response.json();
  store.set('microsoftAccessToken', tokens.access_token);
  store.set('microsoftRefreshToken', tokens.refresh_token);
  store.set('microsoftTokenExpiry', Date.now() + tokens.expires_in * 1000);

  graphClient = null;
  return tokens.access_token;
}

async function getAccessToken(): Promise<string> {
  const store = getStore();
  const token = store.get('microsoftAccessToken');
  const expiry = store.get('microsoftTokenExpiry') || 0;

  if (!token || Date.now() >= expiry - 60000) {
    return refreshMicrosoftToken();
  }
  return token;
}

async function getGraphClient(): Promise<Client> {
  if (graphClient) return graphClient;

  const token = await getAccessToken();
  graphClient = Client.init({
    authProvider: (done) => done(null, token),
  });
  return graphClient;
}

export async function testMicrosoftConnection(): Promise<{ displayName: string; mail: string }> {
  const client = await getGraphClient();
  const user = await client.api('/me').select('displayName,mail').get();
  return { displayName: user.displayName, mail: user.mail };
}

export async function fetchRecentEmails(
  sinceDate?: string
): Promise<
  Array<{
    id: string;
    subject: string;
    bodyPreview: string;
    body: string;
    from: string;
    receivedAt: string;
    isRead: boolean;
  }>
> {
  const client = await getGraphClient();
  let query = client
    .api('/me/messages')
    .select('id,subject,bodyPreview,body,from,receivedDateTime,isRead')
    .top(50)
    .orderby('receivedDateTime desc');

  if (sinceDate) {
    query = query.filter(`receivedDateTime ge ${sinceDate}`);
  }

  const result = await query.get();
  return (result.value || []).map((msg: Record<string, unknown>) => ({
    id: msg.id as string,
    subject: msg.subject as string,
    bodyPreview: msg.bodyPreview as string,
    body: (msg.body as { content: string })?.content || '',
    from: (msg.from as { emailAddress: { address: string } })?.emailAddress?.address || '',
    receivedAt: msg.receivedDateTime as string,
    isRead: msg.isRead as boolean,
  }));
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  inReplyTo?: string
): Promise<void> {
  const client = await getGraphClient();

  const message: Record<string, unknown> = {
    subject,
    body: { contentType: 'Text', content: body },
    toRecipients: [{ emailAddress: { address: to } }],
  };

  if (inReplyTo) {
    // Reply to existing message
    await client.api(`/me/messages/${inReplyTo}/reply`).post({
      message: { body: { contentType: 'Text', content: body } },
    });
  } else {
    await client.api('/me/sendMail').post({ message });
  }
}

export function isMicrosoftConfigured(): boolean {
  const store = getStore();
  return !!store.get('microsoftAccessToken');
}
