import type { IpcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { getDb } from '../db';
import { v4 as uuid } from 'uuid';
import {
  classifyEmail,
  composeEmailDraft,
  runEscalationReview,
  isAnthropicConfigured,
} from '../services/claude.service';
import type { Equipment } from '../../shared/models';

export function registerAiHandlers(ipcMain: IpcMain): void {
  // Classify a single email
  ipcMain.handle(
    IPC.AI_CLASSIFY_EMAIL,
    async (_event, subject: string, body: string) => {
      if (!isAnthropicConfigured()) {
        return { classification: null, message: 'Anthropic API not configured' };
      }

      try {
        const result = await classifyEmail(subject, body);
        return {
          classification: result.classification,
          summary: result.summary,
          actionNeeded: result.actionNeeded,
        };
      } catch (err) {
        return {
          classification: null,
          message: err instanceof Error ? err.message : 'Classification failed',
        };
      }
    }
  );

  // Compose a draft email for a vendor
  ipcMain.handle(
    IPC.AI_COMPOSE_DRAFT,
    async (_event, vendorId: string, intent: string) => {
      if (!isAnthropicConfigured()) {
        return { draft: null, message: 'Anthropic API not configured' };
      }

      const db = getDb();

      // Get vendor info
      const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(vendorId) as any;
      if (!vendor) return { draft: null, message: 'Vendor not found' };

      // Get thread history with this vendor
      const threadRows = db
        .prepare('SELECT * FROM emails WHERE vendor_id = ? ORDER BY sent_at ASC LIMIT 20')
        .all(vendorId) as any[];

      const threadHistory = threadRows.map((e) => ({
        direction: e.direction,
        subject: e.subject,
        bodyPreview: e.body_preview,
      }));

      // Get equipment linked to this vendor
      const equipmentRows = db
        .prepare('SELECT * FROM equipment WHERE vendor_id = ?')
        .all(vendorId) as any[];

      const equipment: Equipment[] = equipmentRows.map((e) => ({
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
          vendor.name,
          vendor.email || '',
          threadHistory,
          equipment,
          intent
        );

        // Save as draft
        const draftId = uuid();
        db.prepare(
          `INSERT INTO draft_emails (id, vendor_id, subject, body, ai_reasoning, status)
           VALUES (?, ?, ?, ?, ?, 'pending')`
        ).run(draftId, vendorId, result.subject, result.body, result.reasoning);

        return {
          draft: {
            id: draftId,
            vendorId,
            subject: result.subject,
            body: result.body,
            aiReasoning: result.reasoning,
            status: 'pending',
            createdAt: new Date().toISOString(),
          },
        };
      } catch (err) {
        return { draft: null, message: err instanceof Error ? err.message : 'Composition failed' };
      }
    }
  );

  // Run AI escalation review across all equipment and recent emails
  ipcMain.handle(IPC.AI_RUN_ESCALATION_REVIEW, async () => {
    if (!isAnthropicConfigured()) {
      return { escalations: [], message: 'Anthropic API not configured' };
    }

    const db = getDb();

    // Get all equipment
    const equipmentRows = db.prepare('SELECT * FROM equipment').all() as any[];
    const equipment: Equipment[] = equipmentRows.map((e) => ({
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

    // Get recent emails with AI summaries (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const emailRows = db
      .prepare(
        `SELECT e.*, v.name as vendor_name FROM emails e
         LEFT JOIN vendors v ON e.vendor_id = v.id
         WHERE e.sent_at > ? AND e.ai_summary IS NOT NULL
         ORDER BY e.sent_at DESC`
      )
      .all(oneDayAgo) as any[];

    const recentEmails = emailRows.map((e) => ({
      vendorName: e.vendor_name || 'Unknown',
      summary: e.ai_summary || e.body_preview || '',
      sentAt: e.sent_at,
    }));

    try {
      const issues = await runEscalationReview(equipment, recentEmails);

      // Create escalation entries for each issue
      const created = [];
      const insertEsc = db.prepare(
        `INSERT INTO escalations (id, type, description, ai_recommendation, status)
         VALUES (?, ?, ?, ?, 'open')`
      );

      for (const issue of issues) {
        const id = uuid();
        insertEsc.run(id, issue.type, issue.description, issue.recommendation);
        created.push({
          id,
          type: issue.type,
          description: issue.description,
          aiRecommendation: issue.recommendation,
          status: 'open',
          createdAt: new Date().toISOString(),
        });
      }

      return { escalations: created };
    } catch (err) {
      return {
        escalations: [],
        message: err instanceof Error ? err.message : 'Review failed',
      };
    }
  });
}
