import { google, sheets_v4 } from 'googleapis';
import { getStore } from '../store';

// Service Account credentials will be bundled with the app
// For development, we read from an environment variable or bundled file
let sheetsClient: sheets_v4.Sheets | null = null;

function getServiceAccountCredentials(): object | null {
  // In production, these would be bundled in the app resources
  // For development, use GOOGLE_SERVICE_ACCOUNT_JSON env var
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (json) {
    return JSON.parse(json);
  }
  // TODO: Load from bundled resources in production
  return null;
}

export function getServiceAccountEmail(): string {
  const creds = getServiceAccountCredentials();
  if (creds && 'client_email' in creds) {
    return (creds as { client_email: string }).client_email;
  }
  return 'opsnest-sync@opsnest-project.iam.gserviceaccount.com';
}

async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  if (sheetsClient) return sheetsClient;

  const credentials = getServiceAccountCredentials();
  if (!credentials) {
    throw new Error(
      'Google Service Account credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON environment variable.'
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: credentials as object,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

export async function testSheetsAccess(spreadsheetId: string): Promise<boolean> {
  try {
    const client = await getSheetsClient();
    const response = await client.spreadsheets.get({
      spreadsheetId,
      fields: 'properties.title',
    });
    return !!response.data.properties?.title;
  } catch {
    return false;
  }
}

export async function getSpreadsheetInfo(
  spreadsheetId: string
): Promise<{ title: string; sheets: string[] }> {
  const client = await getSheetsClient();
  const response = await client.spreadsheets.get({ spreadsheetId });
  return {
    title: response.data.properties?.title || 'Untitled',
    sheets:
      response.data.sheets?.map((s) => s.properties?.title || 'Sheet').filter(Boolean) || [],
  };
}

export async function readSheetRange(
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const client = await getSheetsClient();
  const response = await client.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return (response.data.values as string[][]) || [];
}

export async function writeSheetRange(
  spreadsheetId: string,
  range: string,
  values: string[][]
): Promise<void> {
  const client = await getSheetsClient();
  await client.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

export async function createTemplateSheet(): Promise<string> {
  const client = await getSheetsClient();
  const response = await client.spreadsheets.create({
    requestBody: {
      properties: { title: 'OpsNest Conference Template' },
      sheets: [
        {
          properties: { title: 'Equipment Tracker' },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: [
                {
                  values: [
                    { userEnteredValue: { stringValue: 'Area' } },
                    { userEnteredValue: { stringValue: 'Equipment' } },
                    { userEnteredValue: { stringValue: 'Quantity Needed' } },
                    { userEnteredValue: { stringValue: 'Quantity Confirmed' } },
                    { userEnteredValue: { stringValue: 'Vendor' } },
                    { userEnteredValue: { stringValue: 'Status' } },
                    { userEnteredValue: { stringValue: 'Notes' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  });
  return response.data.spreadsheetId || '';
}

// OAuth callback handler (kept for compatibility, but we primarily use Service Account)
export async function handleGoogleCallback(code: string): Promise<void> {
  // For Service Account approach, this isn't the primary auth path
  // But kept in case we add OAuth as a fallback option
  const store = getStore();
  store.set('googleSheetsConnected', true);
  console.log('Google callback received with code:', code.substring(0, 10) + '...');
}
