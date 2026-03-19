import React, { useState, useEffect, useCallback } from 'react';
import type { SyncConflict } from '../../../shared/models';

interface ConflictPanelProps {
  onResolved?: () => void;
}

export function ConflictPanel({ onResolved }: ConflictPanelProps) {
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [resolving, setResolving] = useState<string | null>(null);

  const loadConflicts = useCallback(async () => {
    if (!window.opsnest) return;
    const result = await window.opsnest.getConflicts();
    setConflicts(result.conflicts || []);
  }, []);

  useEffect(() => {
    loadConflicts();
  }, [loadConflicts]);

  const handleResolve = async (conflictId: string, chosenSource: string) => {
    if (!window.opsnest) return;
    setResolving(conflictId);
    try {
      await window.opsnest.resolveConflict(conflictId, chosenSource);
      await loadConflicts();
      onResolved?.();
    } finally {
      setResolving(null);
    }
  };

  if (conflicts.length === 0) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.warningIcon}>!</span>
        <span style={styles.headerText}>
          {conflicts.length} sync conflict{conflicts.length > 1 ? 's' : ''} need
          {conflicts.length === 1 ? 's' : ''} your attention
        </span>
      </div>

      {conflicts.map((conflict) => (
        <div key={conflict.id} style={styles.card}>
          <div style={styles.cardTitle}>
            <span style={styles.fieldBadge}>{formatField(conflict.fieldName)}</span>
            <span style={styles.equipName}>
              {conflict.equipmentName || conflict.entityId.slice(0, 8)}
            </span>
          </div>

          <div style={styles.comparison}>
            <div style={styles.side}>
              <div style={styles.sourceLabel}>
                {formatSource(conflict.sourceA.source)}
              </div>
              <div style={styles.value}>{conflict.sourceA.value || '(empty)'}</div>
              <div style={styles.timestamp}>
                {new Date(conflict.sourceA.timestamp).toLocaleTimeString()}
              </div>
              <button
                style={styles.chooseBtn}
                onClick={() => handleResolve(conflict.id, conflict.sourceA.source)}
                disabled={resolving === conflict.id}
              >
                Use this
              </button>
            </div>

            <div style={styles.vs}>VS</div>

            <div style={styles.side}>
              <div style={styles.sourceLabel}>
                {formatSource(conflict.sourceB.source)}
              </div>
              <div style={styles.value}>{conflict.sourceB.value || '(empty)'}</div>
              <div style={styles.timestamp}>
                {new Date(conflict.sourceB.timestamp).toLocaleTimeString()}
              </div>
              <button
                style={styles.chooseBtn}
                onClick={() => handleResolve(conflict.id, conflict.sourceB.source)}
                disabled={resolving === conflict.id}
              >
                Use this
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatField(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSource(source: string): string {
  switch (source) {
    case 'local':
      return 'Your Edit';
    case 'sheets':
      return 'Google Sheets';
    case 'monday':
      return 'Monday.com';
    default:
      return source;
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '8px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    background: '#fffbeb',
    borderRadius: '8px',
    marginBottom: '8px',
  },
  warningIcon: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: '#f59e0b',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 700,
    flexShrink: 0,
  },
  headerText: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#92400e',
  },
  card: {
    border: '1px solid #fde68a',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '8px',
    background: 'white',
  },
  cardTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '10px',
  },
  fieldBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    background: '#fef3c7',
    color: '#92400e',
    fontSize: '11px',
    fontWeight: 600,
  },
  equipName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1e293b',
  },
  comparison: {
    display: 'flex',
    alignItems: 'stretch',
    gap: '8px',
  },
  side: {
    flex: 1,
    padding: '10px',
    borderRadius: '6px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  vs: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '11px',
    fontWeight: 700,
    color: '#94a3b8',
  },
  sourceLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#6366f1',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  value: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1e293b',
    wordBreak: 'break-word',
  },
  timestamp: {
    fontSize: '10px',
    color: '#94a3b8',
  },
  chooseBtn: {
    marginTop: '6px',
    padding: '5px 10px',
    borderRadius: '5px',
    border: '1px solid #e2e8f0',
    background: 'white',
    color: '#374151',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
  },
};
