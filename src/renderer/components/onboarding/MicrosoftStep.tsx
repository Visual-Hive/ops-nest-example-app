import React, { useState, useEffect } from 'react';

export function MicrosoftStep() {
  const [connecting, setConnecting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [polling, setPolling] = useState(false);

  // After user clicks "Sign in", we poll to check if auth completed
  useEffect(() => {
    if (!polling || !window.opsnest) return;

    const interval = setInterval(async () => {
      try {
        const testResult = await window.opsnest.testConnection('microsoft');
        if (testResult.success) {
          setResult(testResult);
          setPolling(false);
          setConnecting(false);
        }
      } catch {
        // Still waiting for auth to complete
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [polling]);

  const handleSignIn = async () => {
    if (!window.opsnest) return;
    setConnecting(true);
    setResult(null);

    try {
      await window.opsnest.startMicrosoftAuth();
      // Start polling for completion (OAuth happens in browser)
      setPolling(true);
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to start sign-in',
      });
      setConnecting(false);
    }
  };

  const handleTestConnection = async () => {
    if (!window.opsnest) return;
    setConnecting(true);
    try {
      const testResult = await window.opsnest.testConnection('microsoft');
      setResult(testResult);
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
      });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div>
      <h2 style={styles.title}>Microsoft 365 Sign-in</h2>
      <p style={styles.desc}>
        Connect your Outlook email to sync vendor communications. You'll sign in with your normal Microsoft work account - just like any "Sign in with Microsoft" button you've used before.
      </p>

      <div style={styles.features}>
        <div style={styles.feature}>
          <span style={styles.featureIcon}>📧</span>
          <span>Read vendor emails automatically</span>
        </div>
        <div style={styles.feature}>
          <span style={styles.featureIcon}>✍️</span>
          <span>Send AI-drafted replies (with your approval)</span>
        </div>
        <div style={styles.feature}>
          <span style={styles.featureIcon}>🔔</span>
          <span>Get alerts for unresponsive vendors</span>
        </div>
      </div>

      <button
        style={{
          ...styles.signInBtn,
          ...(connecting ? styles.signInBtnDisabled : {}),
        }}
        onClick={handleSignIn}
        disabled={connecting}
      >
        <svg width="20" height="20" viewBox="0 0 21 21" fill="none" style={{ marginRight: '10px' }}>
          <rect x="1" y="1" width="9" height="9" fill="#f25022" />
          <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
          <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
          <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
        </svg>
        {connecting ? 'Waiting for sign-in...' : 'Sign in with Microsoft'}
      </button>

      {polling && (
        <p style={styles.pollingText}>
          A browser window has opened. Sign in with your Microsoft account and accept the permissions.
          This will update automatically once you're done.
        </p>
      )}

      {result && !polling && (
        <div
          style={{
            ...styles.result,
            ...(result.success ? styles.resultSuccess : styles.resultError),
          }}
        >
          {result.success ? '✓' : '✗'} {result.message}
        </div>
      )}

      {result?.success && (
        <button style={styles.retestBtn} onClick={handleTestConnection}>
          Test Connection Again
        </button>
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
  features: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    marginBottom: '24px',
    padding: '16px',
    background: '#f8fafc',
    borderRadius: '10px',
  },
  feature: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#475569',
  },
  featureIcon: {
    fontSize: '16px',
  },
  signInBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '14px',
    borderRadius: '8px',
    border: '2px solid #e2e8f0',
    background: 'white',
    fontSize: '15px',
    fontWeight: 600,
    color: '#1e293b',
    cursor: 'pointer',
    marginBottom: '16px',
  },
  signInBtnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  pollingText: {
    fontSize: '13px',
    color: '#6366f1',
    textAlign: 'center' as const,
    lineHeight: 1.5,
    padding: '8px',
  },
  result: {
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
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
  retestBtn: {
    marginTop: '12px',
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: 'white',
    color: '#64748b',
    fontSize: '13px',
    cursor: 'pointer',
  },
};
