import type { IpcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { getDb } from '../db';
import { v4 as uuid } from 'uuid';
import {
  fetchRecentEmails,
  sendEmail as outlookSend,
  isMicrosoftConfigured,
} from '../services/outlook.service';
import {
  classifyEmail as aiClassify,
  composeEmailDraft,
  isAnthropicConfigured,
} from '../services/claude.service';
import type { Email, DraftEmail, Equipment } from '../../shared/models';

export function registerEmailHandlers(ipcMain: IpcMain): void {
  // Get inbox: fetch from Outlook, classify new ones, return from DB
  ipcMain.handle(IPC.EMAIL_GET_INBOX, async () => {
    const db = getDb();

    // If Outlook is configured, fetch new emails and store them
    if (isMicrosoftConfigured()) {
      try {
        // Get the most recent email date from DB to only fetch new ones
        const lastEmail = db
          .prepare('SELECT sent_at FROM emails WHERE direction = ? ORDER BY sent_at DESC LIMIT 1')
          .get('inbound') as { sent_at: string } | undefined;

        const sinceDate = lastEmail?.sent_at || undefined;
        const outlookEmails = await fetchRecentEmails(sinceDate);

        const insertEmail = db.prepare(
          `INSERT OR IGNORE INTO emails (id, outlook_message_id, vendor_id, direction, subject, body_preview, body_full, is_read, sent_at)
           VALUES (?, ?, ?, 'inbound', ?, ?, ?, ?, ?)`
        );

        const findVendorByEmail = db.prepare(
          'SELECT id FROM vendors WHERE email = ?'
        );

        for (const msg of outlookEmails) {
          // Check if already stored
          const exists = db
            .prepare('SELECT id FROM emails WHERE outlook_message_id = ?')
            .get(msg.id);
          if (exists) continue;

          // Try to link to vendor by sender email
          const vendor = findVendorByEmail.get(msg.from) as { id: string } | undefined;

          const emailId = uuid();
          insertEmail.run(
            emailId,
            msg.id,
            vendor?.id || null,
            msg.subject,
            msg.bodyPreview,
            msg.body,
            msg.isRead ? 1 : 0,
            msg.receivedAt
          );

          // Auto-classify with Claude if available
          if (isAnthropicConfigured()) {
            try {
              const vendorName = vendor
                ? (db.prepare('SELECT name FROM vendors WHERE id = ?').get(vendor.id) as any)?.name
                : undefined;
              const result = await aiClassify(msg.subject, msg.bodyPreview, vendorName);
              db.prepare(
                'UPDATE emails SET ai_classification = ?, ai_summary = ? WHERE id = ?'
              ).run(result.classification, result.summary, emailId);
            } catch {
              // Classification failed - email still stored unclassified
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch emails from Outlook:', err);
      }
    }

    // Return all emails from DB
    const rows = db
      .prepare('SELECT * FROM emails ORDER BY sent_at DESC LIMIT 100')
      .all();
    return { emails: rows.map(rowToEmail) };
  });

  // Get email thread for a specific email (all emails with same vendor)
  ipcMain.handle(IPC.EMAIL_GET_THREAD, async (_event, emailId: string) => {
    const db = getDb();
    const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(emailId) as any;
    if (!email) return { thread: [] };

    let thread: any[];
    if (email.vendor_id) {
      // Get all emails with this vendor
      thread = db
        .prepare('SELECT * FROM emails WHERE vendor_id = ? ORDER BY sent_at ASC')
        .all(email.vendor_id);
    } else {
      // No vendor linked - just return this email
      thread = [email];
    }

    return { thread: thread.map(rowToEmail) };
  });

  // Draft a reply using AI
  ipcMain.handle(
    IPC.EMAIL_DRAFT_REPLY,
    async (_event, emailId: string, intent: string) => {
      const db = getDb();
      const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(emailId) as any;
      if (!email) return { draft: null, message: 'Email not found' };

      if (!isAnthropicConfigured()) {
        return { draft: null, message: 'Anthropic API not configured' };
      }

      // Get vendor info
      let vendorName = 'Vendor';
      let vendorEmail = '';
      if (email.vendor_id) {
        const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(email.vendor_id) as any;
        if (vendor) {
          vendorName = vendor.name;
          vendorEmail = vendor.email || '';
        }
      }

      // Get thread history
      const threadRows = email.vendor_id
        ? db
            .prepare('SELECT * FROM emails WHERE vendor_id = ? ORDER BY sent_at ASC')
            .all(email.vendor_id)
        : [email];

      const threadHistory = (threadRows as any[]).map((e) => ({
        direction: e.direction,
        subject: e.subject,
        bodyPreview: e.body_preview,
      }));

      // Get relevant equipment (linked to this vendor)
      const equipmentRows = email.vendor_id
        ? db
            .prepare('SELECT * FROM equipment WHERE vendor_id = ?')
            .all(email.vendor_id)
        : [];
      const equipment: Equipment[] = (equipmentRows as any[]).map((e) => ({
        id: e.id,
        areaId: e.area_id,
        name: e.name,
        quantityNeeded: e.quantity_needed,
        quantityConfirmed: e.quantity_confirmed,
        vendorId: e.vendor_id,
        status: e.status,
        notes: e.notes,
        createdAt: e.created_at,
        updatedAt: e.updated_at,
      }));

      try {
        const result = await composeEmailDraft(
          vendorName,
          vendorEmail,
          threadHistory,
          equipment,
          intent
        );

        // Save draft
        const draftId = uuid();
        db.prepare(
          `INSERT INTO draft_emails (id, vendor_id, in_reply_to, subject, body, ai_reasoning, status)
           VALUES (?, ?, ?, ?, ?, ?, 'pending')`
        ).run(
          draftId,
          email.vendor_id,
          emailId,
          result.subject,
          result.body,
          result.reasoning
        );

        const draft: DraftEmail = {
          id: draftId,
          vendorId: email.vendor_id,
          inReplyTo: emailId,
          subject: result.subject,
          body: result.body,
          aiReasoning: result.reasoning,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };

        return { draft };
      } catch (err) {
        return { draft: null, message: err instanceof Error ? err.message : 'Draft failed' };
      }
    }
  );

  // Send an email (from a draft)
  ipcMain.handle(IPC.EMAIL_SEND, async (_event, draftId: string) => {
    const db = getDb();
    const draft = db.prepare('SELECT * FROM draft_emails WHERE id = ?').get(draftId) as any;
    if (!draft) return { success: false, message: 'Draft not found' };

    if (!isMicrosoftConfigured()) {
      return { success: false, message: 'Microsoft not configured' };
    }

    // Get vendor email
    let recipientEmail = '';
    if (draft.vendor_id) {
      const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(draft.vendor_id) as any;
      recipientEmail = vendor?.email || '';
    }

    if (!recipientEmail) {
      return { success: false, message: 'No recipient email address' };
    }

    try {
      // Get the original email's Outlook message ID for threading
      let outlookMessageId: string | undefined;
      if (draft.in_reply_to) {
        const originalEmail = db
          .prepare('SELECT outlook_message_id FROM emails WHERE id = ?')
          .get(draft.in_reply_to) as any;
        outlookMessageId = originalEmail?.outlook_message_id;
      }

      await outlookSend(recipientEmail, draft.subject, draft.body, outlookMessageId);

      // Mark draft as sent
      db.prepare(
        "UPDATE draft_emails SET status = 'sent', approved_at = datetime('now') WHERE id = ?"
      ).run(draftId);

      // Create outbound email record
      const outboundId = uuid();
      db.prepare(
        `INSERT INTO emails (id, vendor_id, direction, subject, body_preview, body_full, is_read, sent_at)
         VALUES (?, ?, 'outbound', ?, ?, ?, 1, datetime('now'))`
      ).run(outboundId, draft.vendor_id, draft.subject, draft.body.slice(0, 200), draft.body);

      // Update vendor's last contacted
      if (draft.vendor_id) {
        db.prepare(
          "UPDATE vendors SET last_contacted_at = datetime('now') WHERE id = ?"
        ).run(draft.vendor_id);
      }

      return { success: true };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Send failed' };
    }
  });

  // Get all drafts
  ipcMain.handle(IPC.EMAIL_GET_DRAFTS, async () => {
    const db = getDb();
    const rows = db
      .prepare("SELECT * FROM draft_emails WHERE status IN ('pending', 'approved') ORDER BY created_at DESC")
      .all();
    return { drafts: rows.map(rowToDraft) };
  });
}

function rowToEmail(row: any): Email {
  return {
    id: row.id,
    outlookMessageId: row.outlook_message_id,
    vendorId: row.vendor_id,
    direction: row.direction,
    subject: row.subject,
    bodyPreview: row.body_preview,
    bodyFull: row.body_full,
    aiClassification: row.ai_classification,
    aiSummary: row.ai_summary,
    isRead: !!row.is_read,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}

function rowToDraft(row: any): DraftEmail {
  return {
    id: row.id,
    vendorId: row.vendor_id,
    inReplyTo: row.in_reply_to,
    subject: row.subject,
    body: row.body,
    aiReasoning: row.ai_reasoning,
    status: row.status,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
  };
}
