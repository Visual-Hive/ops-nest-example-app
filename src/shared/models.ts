// Data models shared between main process and renderer

export interface AppEvent {
  id: string;
  name: string;
  date: string;
  mondayBoardId?: string;
  sheetsSpreadsheetId?: string;
  sheetsRange?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Area {
  id: string;
  eventId: string;
  name: string;
  sheetsRowId?: string;
  mondayItemId?: string;
  status: 'pending' | 'in_progress' | 'complete' | 'blocked';
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Equipment {
  id: string;
  areaId: string;
  name: string;
  quantityNeeded: number;
  quantityConfirmed: number;
  vendorId?: string;
  status: 'not_ordered' | 'ordered' | 'confirmed' | 'delivered';
  sheetsCellRef?: string;
  mondaySubitemId?: string;
  notes?: string;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  mondayContactId?: string;
  lastContactedAt?: string;
  createdAt: string;
}

export type EmailClassification =
  | 'auto_response'
  | 'non_answer'
  | 'substantive'
  | 'needs_attention';

export interface Email {
  id: string;
  outlookMessageId?: string;
  vendorId?: string;
  direction: 'inbound' | 'outbound';
  subject: string;
  bodyPreview: string;
  bodyFull?: string;
  aiClassification?: EmailClassification;
  aiSummary?: string;
  isRead: boolean;
  sentAt: string;
  createdAt: string;
}

export interface DraftEmail {
  id: string;
  vendorId?: string;
  inReplyTo?: string;
  subject: string;
  body: string;
  aiReasoning?: string;
  status: 'pending' | 'approved' | 'sent' | 'rejected';
  approvedAt?: string;
  createdAt: string;
}

export type EscalationType =
  | 'sync_conflict'
  | 'email_needs_review'
  | 'vendor_unresponsive'
  | 'quantity_mismatch';

export interface Escalation {
  id: string;
  type: EscalationType;
  entityType?: string;
  entityId?: string;
  description: string;
  aiRecommendation?: string;
  status: 'open' | 'acknowledged' | 'resolved';
  createdAt: string;
  resolvedAt?: string;
}

export interface SyncStatus {
  isRunning: boolean;
  lastSyncAt?: string;
  nextSyncAt?: string;
  error?: string;
  sheetsConnected: boolean;
  mondayConnected: boolean;
  outlookConnected: boolean;
}

export interface AuthStatus {
  anthropicConfigured: boolean;
  mondayConfigured: boolean;
  googleConfigured: boolean;
  microsoftConfigured: boolean;
  onboardingComplete: boolean;
}

export interface ColumnMapping {
  areaName: string;
  equipmentName: string;
  quantity: string;
  status: string;
  vendor: string;
  notes?: string;
}
