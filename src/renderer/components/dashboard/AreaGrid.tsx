import React, { useState, useEffect } from 'react';
import type { Area, Equipment } from '../../../shared/models';

interface AreaGridProps {
  areas: Area[];
  onRefresh: () => void;
}

export function AreaGrid({ areas, onRefresh }: AreaGridProps) {
  const [expandedArea, setExpandedArea] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loadingEquip, setLoadingEquip] = useState(false);

  useEffect(() => {
    if (!expandedArea || !window.opsnest) return;
    setLoadingEquip(true);
    window.opsnest
      .getEquipment(expandedArea)
      .then((result) => setEquipment(result.equipment || []))
      .catch(() => setEquipment([]))
      .finally(() => setLoadingEquip(false));
  }, [expandedArea]);

  const statusColor = (status: string) => {
    switch (status) {
      case 'complete':
      case 'delivered':
        return '#22c55e';
      case 'in_progress':
      case 'ordered':
      case 'confirmed':
        return '#f59e0b';
      case 'blocked':
        return '#ef4444';
      default:
        return '#94a3b8';
    }
  };

  const statusLabel = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  if (areas.length === 0) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>📋</div>
        <h3>No areas synced yet</h3>
        <p>Connect your Google Sheet and Monday.com board to see your event areas here.</p>
      </div>
    );
  }

  return (
    <div style={styles.grid}>
      {areas.map((area) => (
        <div key={area.id}>
          <div
            style={{
              ...styles.areaRow,
              ...(expandedArea === area.id ? styles.areaRowExpanded : {}),
            }}
            onClick={() =>
              setExpandedArea(expandedArea === area.id ? null : area.id)
            }
          >
            <span style={styles.expandIcon}>
              {expandedArea === area.id ? '▼' : '▶'}
            </span>
            <span style={styles.areaName}>{area.name}</span>
            <span
              style={{
                ...styles.statusBadge,
                background: statusColor(area.status) + '20',
                color: statusColor(area.status),
              }}
            >
              {statusLabel(area.status)}
            </span>
            {area.lastSyncedAt && (
              <span style={styles.syncTime}>
                Synced {new Date(area.lastSyncedAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          {expandedArea === area.id && (
            <div style={styles.equipmentList}>
              {loadingEquip ? (
                <div style={styles.loading}>Loading equipment...</div>
              ) : equipment.length === 0 ? (
                <div style={styles.loading}>No equipment items</div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Equipment</th>
                      <th style={styles.th}>Needed</th>
                      <th style={styles.th}>Confirmed</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipment.map((item) => (
                      <tr key={item.id} style={styles.tr}>
                        <td style={styles.td}>{item.name}</td>
                        <td style={styles.tdCenter}>{item.quantityNeeded}</td>
                        <td
                          style={{
                            ...styles.tdCenter,
                            color:
                              item.quantityConfirmed < item.quantityNeeded
                                ? '#ef4444'
                                : '#22c55e',
                            fontWeight: 600,
                          }}
                        >
                          {item.quantityConfirmed}
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.statusBadgeSmall,
                              background: statusColor(item.status) + '20',
                              color: statusColor(item.status),
                            }}
                          >
                            {statusLabel(item.status)}
                          </span>
                        </td>
                        <td style={styles.tdNotes}>{item.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: 'flex',
    flexDirection: 'column',
  },
  areaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 20px',
    cursor: 'pointer',
    borderBottom: '1px solid #f1f5f9',
    transition: 'background 0.1s',
  },
  areaRowExpanded: {
    background: '#f8fafc',
  },
  expandIcon: {
    fontSize: '10px',
    color: '#94a3b8',
    width: '16px',
  },
  areaName: {
    flex: 1,
    fontWeight: 600,
    fontSize: '14px',
    color: '#1e293b',
  },
  statusBadge: {
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 600,
  },
  statusBadgeSmall: {
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: 600,
  },
  syncTime: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  equipmentList: {
    borderBottom: '1px solid #e2e8f0',
    background: 'white',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '8px 16px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #f1f5f9',
    background: '#fafbfc',
  },
  tr: {
    borderBottom: '1px solid #f8fafc',
  },
  td: {
    padding: '10px 16px',
    fontSize: '13px',
    color: '#374151',
  },
  tdCenter: {
    padding: '10px 16px',
    fontSize: '13px',
    textAlign: 'center',
  },
  tdNotes: {
    padding: '10px 16px',
    fontSize: '12px',
    color: '#94a3b8',
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 40px',
    textAlign: 'center',
    color: '#64748b',
    gap: '8px',
  },
  emptyIcon: {
    fontSize: '40px',
    marginBottom: '8px',
  },
  loading: {
    padding: '20px',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '13px',
  },
};
