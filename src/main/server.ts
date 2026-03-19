import express from 'express';
import type { Server } from 'http';
import { handleGoogleCallback } from './services/sheets.service';
import { handleMicrosoftCallback } from './services/outlook.service';

const PORT = 19876;
let server: Server | null = null;

export async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json());

  // OAuth callback routes
  app.get('/auth/google/callback', async (req, res) => {
    try {
      const code = req.query.code as string;
      if (!code) {
        res.status(400).send('Missing authorization code');
        return;
      }
      await handleGoogleCallback(code);
      res.send(`
        <html>
          <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0fdf4;">
            <div style="text-align: center;">
              <h1 style="color: #16a34a;">Connected!</h1>
              <p>Google Sheets connected successfully. You can close this tab.</p>
            </div>
          </body>
        </html>
      `);
    } catch (err) {
      console.error('Google OAuth callback error:', err);
      res.status(500).send('Authentication failed. Please try again in the app.');
    }
  });

  app.get('/auth/microsoft/callback', async (req, res) => {
    try {
      const code = req.query.code as string;
      if (!code) {
        res.status(400).send('Missing authorization code');
        return;
      }
      await handleMicrosoftCallback(code);
      res.send(`
        <html>
          <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0fdf4;">
            <div style="text-align: center;">
              <h1 style="color: #16a34a;">Connected!</h1>
              <p>Microsoft 365 connected successfully. You can close this tab.</p>
            </div>
          </body>
        </html>
      `);
    } catch (err) {
      console.error('Microsoft OAuth callback error:', err);
      res.status(500).send('Authentication failed. Please try again in the app.');
    }
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return new Promise<void>((resolve) => {
    server = app.listen(PORT, '127.0.0.1', () => {
      console.log(`OAuth callback server running on http://127.0.0.1:${PORT}`);
      resolve();
    });
  });
}

export async function stopServer(): Promise<void> {
  if (server) {
    return new Promise<void>((resolve) => {
      server!.close(() => resolve());
      server = null;
    });
  }
}

export function getCallbackUrl(provider: 'google' | 'microsoft'): string {
  return `http://127.0.0.1:${PORT}/auth/${provider}/callback`;
}
