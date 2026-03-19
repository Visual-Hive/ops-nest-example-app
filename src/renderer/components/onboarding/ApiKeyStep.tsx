import React, { useState, useEffect } from 'react';

interface ApiKeyStepProps {
  service: 'anthropic' | 'monday';
  title: string;
  description: string;
  helpUrl: string;
  helpText: string;
  placeholder: string;
}

export function ApiKeyStep({ service, title, description, helpUrl, helpText, placeholder }: ApiKeyStepProps) {
  const [key, setKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Check if key is already configured
    async function check() {
      if (!window.opsnest) return;
      const existing = await window.opsnest.getKey(service);
      if (existing.configured) {
        setSaved(true);
        setResult({ success: true, message: `Already configured (${existing.masked})` });
      }
    }
    check();
  }, [service]);

  const handleSaveAndTest = async () => {
    if (!key.trim() || !window.opsnest) return;

    setTesting(true);
    setResult(null);

    try {
      await window.opsnest.saveKey(service, key.trim());
      const testResult = await window.opsnest.testConnection(service);
      setResult(testResult);
      if (testResult.success) {
        setSaved(true);
      }
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <h2 style={styles.title}>{title}</h2>
      <p style={styles.desc}>{description}</p>

      <a href={helpUrl} target="_blank" rel="noopener noreferrer" style={styles.helpLink}>
        {helpText} →
      </a>

      <div style={styles.inputGroup}>
        <input
          type="password"
          value={key}
          onChange={(e) => { setKey(e.target.value); setSaved(false); setResult(null); }}
          placeholder={placeholder}
          style={styles.input}
          disabled={testing}
        />
        <button
          style={{ ...styles.testBtn, ...(testing ? styles.testBtnDisabled : {}) }}
          onClick={handleSaveAndTest}
          disabled={testing || !key.trim()}
        >
          {testing ? 'Testing...' : saved ? 'Re-test' : 'Save & Test'}
        </button>
      </div>

      {result && (
        <div style={{ ...styles.result, ...(result.success ? styles.resultSuccess : styles.resultError) }}>
          {result.success ? '✓' : '✗'} {result.message}
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
    marginBottom: '16px',
    lineHeight: 1.5,
  },
  helpLink: {
    display: 'inline-block',
    color: '#6366f1',
    fontSize: '13px',
    marginBottom: '20px',
    textDecoration: 'none',
  },
  inputGroup: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: '8px',
    border: '2px solid #e2e8f0',
    fontSize: '14px',
    fontFamily: 'monospace',
    outline: 'none',
  },
  testBtn: {
    padding: '12px 20px',
    borderRadius: '8px',
    border: 'none',
    background: '#6366f1',
    color: 'white',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  testBtnDisabled: {
    background: '#94a3b8',
    cursor: 'not-allowed',
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
};
