import React, { useState, useEffect, useCallback } from 'react';
import type { Email } from '../../../shared/models';
import { DraftComposer } from './DraftComposer';

interface EmailInboxProps {
  onRefresh?: () => void;
}

export function EmailInbox({ onRefresh }: EmailInboxProps) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [showDraftFor, setShowDraftFor] = useState<Email | null>(null);
  const [thread, setThread] = useState<Email[]>([]);

  const loadEmails = useCallback(async () => {
    if (!window.opsnest) return;
    setLoading(true);
    try {
      const result = await window.opsnest.getInbox();
      setEmails(result.emails || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  const handleSelectEmail = async (email: Email) => {
    setSelectedEmail(email);
    setShowDraftFor(null);
    if (window.opsnest) {
      const result = await window.opsnest.getThread(email.id);
      setThread(result.thread || [email]);
    }
  };

  const handleDraftReply = (email: Email) => {
    setShowDraftFor(email);
  };

  const handleDraftSent = () => {
    setShowDraftFor(null);
    loadEmails();
    onRefresh?.();
  };

  const classificationColor = (c?: string) => {
    switch (c) {
      case 'substantive':
        return { bg: '#ecfdf5', color: '#059669' };
      case 'needs_attention':
        return { bg: '#fef2f2', color: '#dc2626' };
      case 'non_answer':
        return { bg: '#fffbeb', color: '#d97706' };
      case 'auto_response':
        return { bg: '#f1f5f9', color: '#64748b' };
      default:
        return { bg: '#f1f5f9', color: '#94a3b8' };
    }
  };

  const classificationLabel = (c?: string) => {
    if (!c) return 'Unclassified';
    return c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (showDraftFor) {
    return (
      <DraftComposer
        email={showDraftFor}
        onSent={handleDraftSent}
        onCancel={() => setShowDraftFor(null)}
      />
    );
  }

  return (
    <div style={styles.container}>
      {/* Email List */}
      <div style={styles.list}>
        <div style={styles.listHeader}>
          <h3 style={styles.listTitle}>Inbox</h3>
          <button style={styles.refreshBtn} onClick={loadEmails} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {emails.length === 0 && !loading && (
          <div style={styles.empty}>
            No emails yet. Connect Outlook and sync to fetch vendor emails.
          </div>
        )}

        {emails.map((email) => {
          const cls = classificationColor(email.aiClassification);
          return (
            <div
              key={email.id}
              style={{
                ...styles.emailRow,
                ...(selectedEmail?.id === email.id ? styles.emailRowSelected : {}),
                ...(email.isRead ? {} : styles.emailRowUnread),
              }}
              onClick={() => handleSelectEmail(email)}
            >
              <div style={styles.emailTop}>
                <span style={styles.emailSubject}>
                  {email.direction === 'outbound' ? '[Sent] ' : ''}
                  {email.subject || '(No subject)'}
                </span>
                <span
                  style={{
                    ...styles.badge,
                    background: cls.bg,
                    color: cls.color,
                  }}
                >
                  {classificationLabel(email.aiClassification)}
                </span>
              </div>
              <div style={styles.emailPreview}>{email.aiSummary || email.bodyPreview}</div>
              <div style={styles.emailMeta}>
                {email.sentAt && new Date(email.sentAt).toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Email Detail / Thread */}
      {selectedEmail && (
        <div style={styles.detail}>
          <div style={styles.detailHeader}>
            <h3 style={styles.detailSubject}>{selectedEmail.subject}</h3>
            <button
              style={styles.draftBtn}
              onClick={() => handleDraftReply(selectedEmail)}
            >
              Draft Reply
            </button>
          </div>

          <div style={styles.threadList}>
            {thread.map((email, i) => (
              <div key={email.id} style={styles.threadItem}>
                <div style={styles.threadDirection}>
                  {email.direction === 'inbound' ? 'Received' : 'Sent'}
                  <span style={styles.threadTime}>
                    {email.sentAt && new Date(email.sentAt).toLocaleString()}
                  </span>
                </div>
                <div style={styles.threadBody}>
                  {email.bodyPreview || email.bodyFull || '(No content)'}
                </div>
                {email.aiSummary && (
                  <div style={styles.aiSummary}>
                    AI Summary: {email.aiSummary}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100%',
    overflow: 'hidden',
  },
  list: {
    flex: '0 0 45%',
    borderRight: '1px solid #e2e8f0',
    overflow: 'auto',
  },
  listHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #f1f5f9',
    position: 'sticky',
    top: 0,
    background: 'white',
    zIndex: 1,
  },
  listTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1e293b',
  },
  refreshBtn: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    background: 'white',
    fontSize: '12px',
    cursor: 'pointer',
    color: '#64748b',
  },
  empty: {
    padding: '32px 16px',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '13px',
  },
  emailRow: {
    padding: '12px 16px',
    borderBottom: '1px solid #f8fafc',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  emailRowSelected: {
    background: '#eef2ff',
  },
  emailRowUnread: {
    borderLeft: '3px solid #6366f1',
  },
  emailTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '4px',
  },
  emailSubject: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1e293b',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  badge: {
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '10px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  emailPreview: {
    fontSize: '12px',
    color: '#64748b',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  emailMeta: {
    fontSize: '11px',
    color: '#94a3b8',
    marginTop: '4px',
  },
  detail: {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  detailHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    borderBottom: '1px solid #f1f5f9',
    background: 'white',
    position: 'sticky',
    top: 0,
  },
  detailSubject: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1e293b',
  },
  draftBtn: {
    padding: '6px 14px',
    borderRadius: '6px',
    border: 'none',
    background: '#6366f1',
    color: 'white',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  threadList: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  threadItem: {
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: '#fafbfc',
  },
  threadDirection: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#6366f1',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
  },
  threadTime: {
    fontWeight: 400,
    color: '#94a3b8',
    textTransform: 'none',
    letterSpacing: 'normal',
  },
  threadBody: {
    fontSize: '13px',
    color: '#374151',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  aiSummary: {
    marginTop: '8px',
    padding: '8px 10px',
    borderRadius: '6px',
    background: '#eef2ff',
    fontSize: '12px',
    color: '#4f46e5',
    fontStyle: 'italic',
  },
};
