import React, { useState, useEffect } from 'react';
import type { Email, DraftEmail } from '../../../shared/models';

interface DraftComposerProps {
  email: Email;
  onSent: () => void;
  onCancel: () => void;
}

export function DraftComposer({ email, onSent, onCancel }: DraftComposerProps) {
  const [draft, setDraft] = useState<DraftEmail | null>(null);
  const [intent, setIntent] = useState('');
  const [composing, setComposing] = useState(false);
  const [sending, setSending] = useState(false);
  const [editBody, setEditBody] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [error, setError] = useState('');

  const handleCompose = async () => {
    if (!window.opsnest || !intent.trim()) return;
    setComposing(true);
    setError('');
    try {
      const result = await window.opsnest.draftReply(email.id, intent.trim());
      if (result.draft) {
        setDraft(result.draft);
        setEditBody(result.draft.body);
        setEditSubject(result.draft.subject);
      } else {
        setError(result.message || 'Failed to compose draft');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setComposing(false);
    }
  };

  const handleSend = async () => {
    if (!window.opsnest || !draft) return;
    setSending(true);
    setError('');
    try {
      const result = await window.opsnest.sendEmail(draft.id);
      if (result.success) {
        onSent();
      } else {
        setError(result.message || 'Send failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onCancel}>
          Back
        </button>
        <h3 style={styles.title}>
          Reply to: {email.subject || '(No subject)'}
        </h3>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {!draft ? (
        // Step 1: Describe intent
        <div style={styles.intentSection}>
          <p style={styles.hint}>
            Describe what you want to say and AI will compose a professional
            reply using your equipment data and thread history.
          </p>
          <textarea
            style={styles.textarea}
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            placeholder="e.g., Follow up on our order for 50 chairs. Ask for delivery date confirmation and if they can add 10 more..."
            rows={4}
          />
          <button
            style={styles.composeBtn}
            onClick={handleCompose}
            disabled={composing || !intent.trim()}
          >
            {composing ? 'AI is composing...' : 'Compose with AI'}
          </button>
        </div>
      ) : (
        // Step 2: Review and edit draft
        <div style={styles.draftSection}>
          {draft.aiReasoning && (
            <div style={styles.reasoning}>
              AI reasoning: {draft.aiReasoning}
            </div>
          )}

          <label style={styles.label}>Subject</label>
          <input
            style={styles.input}
            value={editSubject}
            onChange={(e) => setEditSubject(e.target.value)}
          />

          <label style={styles.label}>Body</label>
          <textarea
            style={styles.textareaLarge}
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={10}
          />

          <div style={styles.actions}>
            <button style={styles.sendBtn} onClick={handleSend} disabled={sending}>
              {sending ? 'Sending...' : 'Send Email'}
            </button>
            <button
              style={styles.regenerateBtn}
              onClick={() => {
                setDraft(null);
                setEditBody('');
                setEditSubject('');
              }}
            >
              Regenerate
            </button>
            <button style={styles.cancelBtn} onClick={onCancel}>
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 20px',
    borderBottom: '1px solid #f1f5f9',
    background: 'white',
  },
  backBtn: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    background: 'white',
    fontSize: '12px',
    cursor: 'pointer',
    color: '#64748b',
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1e293b',
  },
  error: {
    margin: '12px 20px 0',
    padding: '10px 14px',
    borderRadius: '8px',
    background: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca',
    fontSize: '13px',
  },
  intentSection: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  hint: {
    fontSize: '13px',
    color: '#64748b',
    lineHeight: 1.5,
  },
  textarea: {
    padding: '12px',
    borderRadius: '8px',
    border: '2px solid #e2e8f0',
    fontSize: '14px',
    resize: 'vertical',
    fontFamily: 'inherit',
    outline: 'none',
  },
  composeBtn: {
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    background: '#6366f1',
    color: 'white',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
  },
  draftSection: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  reasoning: {
    padding: '10px 14px',
    borderRadius: '8px',
    background: '#eef2ff',
    color: '#4f46e5',
    fontSize: '12px',
    fontStyle: 'italic',
    marginBottom: '4px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#475569',
  },
  input: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '2px solid #e2e8f0',
    fontSize: '14px',
    outline: 'none',
  },
  textareaLarge: {
    padding: '12px',
    borderRadius: '8px',
    border: '2px solid #e2e8f0',
    fontSize: '14px',
    resize: 'vertical',
    fontFamily: 'inherit',
    outline: 'none',
    lineHeight: 1.6,
  },
  actions: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
  },
  sendBtn: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    background: '#22c55e',
    color: 'white',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
  },
  regenerateBtn: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: 'white',
    color: '#6366f1',
    fontWeight: 500,
    fontSize: '13px',
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: 'white',
    color: '#64748b',
    fontWeight: 500,
    fontSize: '13px',
    cursor: 'pointer',
  },
};
