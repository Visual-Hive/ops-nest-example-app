import React, { useState, useEffect } from 'react';

export function GoogleSheetsStep() {
  const [serviceEmail, setServiceEmail] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message?: string;
    title?: string;
    sheets?: string[];
  } | null>(null);

  useEffect(() => {
    async function getEmail() {
      if (!window.opsnest) return;
      const res = await window.opsnest.startGoogleAuth();
      setServiceEmail(res.serviceAccountEmail);
    }
    getEmail();
  }, []);

  const extractSpreadsheetId = (url: string): string | null => {
    // Handle both URLs and direct IDs
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match) return match[1];
    // Maybe it's already an ID
    if (/^[a-zA-Z0-9-_]+$/.test(url.trim()) && url.trim().length > 20) {
      return url.trim();
    }
    return null;
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(serviceEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCheckAccess = async () => {
    const id = extractSpreadsheetId(sheetUrl);
    if (!id || !window.opsnest) return;

    setChecking(true);
    setResult(null);

    try {
      const res = await window.opsnest.checkSheetsAccess(id);
      setResult(res);
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Check failed',
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div>
      <h2 style={styles.title}>Google Sheets Connection</h2>
      <p style={styles.desc}>
        To connect your spreadsheet, share it with our service account - just like sharing with a colleague.
      </p>

      {/* Step 1: Copy the email */}
      <div style={styles.step}>
        <div style={styles.stepNum}>1</div>
        <div style={styles.stepContent}>
          <p style={styles.stepLabel}>Copy this email address:</p>
          <div style={styles.emailRow}>
            <code style={styles.email}>{serviceEmail || 'Loading...'}</code>
            <button
              style={styles.copyBtn}
              onClick={handleCopyEmail}
              disabled={!serviceEmail}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      {/* Step 2: Share the sheet */}
      <div style={styles.step}>
        <div style={styles.stepNum}>2</div>
        <div style={styles.stepContent}>
          <p style={styles.stepLabel}>
            Open your Google Sheet, click <strong>Share</strong>, paste the email, and give it <strong>Editor</strong> access.
          </p>
        </div>
      </div>

      {/* Step 3: Enter sheet URL */}
      <div style={styles.step}>
        <div style={styles.stepNum}>3</div>
        <div style={styles.stepContent}>
          <p style={styles.stepLabel}>Paste your Google Sheet URL here:</p>
          <div style={styles.inputGroup}>
            <input
              type="text"
              value={sheetUrl}
              onChange={(e) => { setSheetUrl(e.target.value); setResult(null); }}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              style={styles.input}
              disabled={checking}
            />
            <button
              style={{ ...styles.checkBtn, ...(checking ? styles.checkBtnDisabled : {}) }}
              onClick={handleCheckAccess}
              disabled={checking || !sheetUrl.trim()}
            >
              {checking ? 'Checking...' : 'Check Access'}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div
          style={{
            ...styles.result,
            ...(result.success ? styles.resultSuccess : styles.resultError),
          }}
        >
          {result.success ? (
            <>
              <strong>✓ Connected!</strong> Sheet: "{result.title}"
              {result.sheets && result.sheets.length > 0 && (
                <div style={{ marginTop: '4px', fontSize: '13px' }}>
                  Tabs: {result.sheets.join(', ')}
                </div>
              )}
            </>
          ) : (
            <>✗ {result.message}</>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: '20px',
    fontWeight: 600,
    marginBottom: '8px',
    color: '#1e293b',
  },
  desc: {
    color: '#64748b',
    fontSize: '14px',
    marginBottom: '20px',
    lineHeight: 1.5,
  },
  step: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
  },
  stepNum: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: '#6366f1',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 600,
    flexShrink: 0,
    marginTop: '2px',
  },
  stepContent: {
    flex: 1,
  },
  stepLabel: {
    fontSize: '14px',
    color: '#374151',
    marginBottom: '8px',
    lineHeight: 1.5,
  },
  emailRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  email: {
    flex: 1,
    padding: '10px 14px',
    background: '#f1f5f9',
    borderRadius: '8px',
    fontSize: '13px',
    fontFamily: 'monospace',
    color: '#334155',
    overflowX: 'auto' as const,
  },
  copyBtn: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #6366f1',
    background: 'white',
    color: '#6366f1',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  inputGroup: {
    display: 'flex',
    gap: '8px',
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: '8px',
    border: '2px solid #e2e8f0',
    fontSize: '14px',
    outline: 'none',
  },
  checkBtn: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: 'none',
    background: '#6366f1',
    color: 'white',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  checkBtnDisabled: {
    background: '#94a3b8',
    cursor: 'not-allowed',
  },
  result: {
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    marginTop: '8px',
  },
  resultSuccess: {
    background: '#f0fdf4',
    color: '#16a34a',
    border: '1px solid #bbf7d0',
  },
  resultError: {
    background: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca',
  },
};
