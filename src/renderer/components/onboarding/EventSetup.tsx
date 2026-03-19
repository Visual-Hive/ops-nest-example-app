import React, { useState, useEffect } from 'react';

interface Board {
  id: string;
  name: string;
}

interface EventSetupProps {
  onComplete: () => void;
}

export function EventSetup({ onComplete }: EventSetupProps) {
  const [step, setStep] = useState<'name' | 'sheets' | 'mapping' | 'monday' | 'done'>('name');

  // Event basics
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventId, setEventId] = useState<string | null>(null);

  // Sheets config
  const [sheetUrl, setSheetUrl] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState({
    areaName: '',
    equipmentName: '',
    quantity: '',
    status: '',
    vendor: '',
    notes: '',
  });

  // Monday config
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoard, setSelectedBoard] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const extractSpreadsheetId = (url: string): string | null => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match) return match[1];
    if (/^[a-zA-Z0-9-_]+$/.test(url.trim()) && url.trim().length > 20) return url.trim();
    return null;
  };

  const handleCreateEvent = async () => {
    if (!eventName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await window.opsnest.createEvent(eventName.trim(), eventDate);
      setEventId(result.event.id);
      setStep('sheets');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectSheet = async () => {
    const id = extractSpreadsheetId(sheetUrl);
    if (!id) { setError('Invalid sheet URL'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await window.opsnest.checkSheetsAccess(id);
      if (result.success) {
        setSpreadsheetId(id);
        setSheetNames(result.sheets || []);
        if (result.sheets?.length === 1) {
          setSelectedSheet(result.sheets[0]);
        }
      } else {
        setError(result.message || 'Cannot access sheet');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadHeaders = async () => {
    if (!selectedSheet) return;
    setLoading(true);
    setError('');
    try {
      const result = await window.opsnest.getSheetHeaders(spreadsheetId, selectedSheet);
      if (result.success) {
        setHeaders(result.headers);
        setStep('mapping');
      } else {
        setError(result.message || 'Failed to read headers');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMapping = async () => {
    if (!mapping.areaName || !mapping.equipmentName || !mapping.quantity) {
      setError('Please map at least Area, Equipment, and Quantity columns');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const range = `${selectedSheet}!A:Z`;
      await window.opsnest.updateEvent(eventId!, {
        sheetsSpreadsheetId: spreadsheetId,
        sheetsRange: range,
        columnMapping: JSON.stringify(mapping),
      });
      // Trigger initial import
      const importResult = await window.opsnest.importFromSheets(eventId!);
      if (importResult.success) {
        setStep('monday');
      } else {
        setError(importResult.message || 'Import failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadBoards = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await window.opsnest.getMondayBoards();
      if (result.success) {
        setBoards(result.boards);
      } else {
        setError(result.message || 'Failed to load boards');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step === 'monday') {
      handleLoadBoards();
    }
  }, [step]);

  const handleSaveBoard = async () => {
    if (!selectedBoard) {
      setStep('done');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await window.opsnest.updateEvent(eventId!, { mondayBoardId: selectedBoard });
      const importResult = await window.opsnest.importFromMonday(eventId!);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step === 'done') {
      onComplete();
    }
  }, [step, onComplete]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>
          {step === 'name' && 'Create Your Event'}
          {step === 'sheets' && 'Connect Google Sheet'}
          {step === 'mapping' && 'Map Your Columns'}
          {step === 'monday' && 'Connect Monday Board'}
        </h2>

        {error && <div style={styles.error}>{error}</div>}

        {step === 'name' && (
          <div style={styles.form}>
            <label style={styles.label}>Event Name</label>
            <input
              style={styles.input}
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g., Tech Trade Show 2026"
            />
            <label style={styles.label}>Event Date</label>
            <input
              style={styles.input}
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
            <button style={styles.btn} onClick={handleCreateEvent} disabled={loading || !eventName.trim()}>
              {loading ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        )}

        {step === 'sheets' && (
          <div style={styles.form}>
            <label style={styles.label}>Google Sheet URL</label>
            <input
              style={styles.input}
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
            />
            {!spreadsheetId ? (
              <button style={styles.btn} onClick={handleConnectSheet} disabled={loading || !sheetUrl.trim()}>
                {loading ? 'Connecting...' : 'Connect Sheet'}
              </button>
            ) : (
              <>
                <label style={styles.label}>Select Tab</label>
                <select
                  style={styles.input}
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                >
                  <option value="">Choose a tab...</option>
                  {sheetNames.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button style={styles.btn} onClick={handleLoadHeaders} disabled={loading || !selectedSheet}>
                  {loading ? 'Loading...' : 'Load Columns'}
                </button>
              </>
            )}
            <button style={styles.btnSecondary} onClick={() => setStep('monday')}>
              Skip Google Sheets
            </button>
          </div>
        )}

        {step === 'mapping' && (
          <div style={styles.form}>
            <p style={styles.hint}>
              Map your spreadsheet columns to the fields below. We found these column headers:
            </p>
            {(['areaName', 'equipmentName', 'quantity', 'status', 'vendor', 'notes'] as const).map((field) => (
              <div key={field} style={styles.mappingRow}>
                <label style={styles.mappingLabel}>
                  {field === 'areaName' ? 'Area / Location *' :
                   field === 'equipmentName' ? 'Equipment Name *' :
                   field === 'quantity' ? 'Quantity Needed *' :
                   field === 'status' ? 'Status' :
                   field === 'vendor' ? 'Vendor / Supplier' :
                   'Notes'}
                </label>
                <select
                  style={styles.mappingSelect}
                  value={mapping[field]}
                  onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                >
                  <option value="">-- Select column --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
            <button style={styles.btn} onClick={handleSaveMapping} disabled={loading}>
              {loading ? 'Importing...' : 'Save Mapping & Import'}
            </button>
          </div>
        )}

        {step === 'monday' && (
          <div style={styles.form}>
            <p style={styles.hint}>
              Select the Monday.com board that tracks tasks for this event.
            </p>
            <select
              style={styles.input}
              value={selectedBoard}
              onChange={(e) => setSelectedBoard(e.target.value)}
            >
              <option value="">Choose a board...</option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <button style={styles.btn} onClick={handleSaveBoard} disabled={loading}>
              {loading ? 'Importing...' : selectedBoard ? 'Connect Board & Import' : 'Skip Monday'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '24px',
    background: '#f8fafc',
  },
  card: {
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    width: '100%',
    maxWidth: '560px',
    padding: '40px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: '24px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#475569',
    marginTop: '4px',
  },
  input: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '2px solid #e2e8f0',
    fontSize: '14px',
    outline: 'none',
  },
  btn: {
    marginTop: '8px',
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    background: '#6366f1',
    color: 'white',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
  },
  btnSecondary: {
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: 'white',
    color: '#64748b',
    fontWeight: 500,
    fontSize: '13px',
    cursor: 'pointer',
  },
  hint: {
    fontSize: '14px',
    color: '#64748b',
    lineHeight: 1.5,
    marginBottom: '8px',
  },
  error: {
    padding: '10px 14px',
    borderRadius: '8px',
    background: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca',
    fontSize: '13px',
    marginBottom: '12px',
  },
  mappingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  mappingLabel: {
    flex: '0 0 160px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#374151',
  },
  mappingSelect: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '8px',
    border: '2px solid #e2e8f0',
    fontSize: '14px',
    outline: 'none',
  },
};
