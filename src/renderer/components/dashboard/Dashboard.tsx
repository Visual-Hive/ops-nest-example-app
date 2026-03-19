import React, { useEffect, useState, useCallback } from 'react';
import { AreaGrid } from './AreaGrid';
import { ConflictPanel } from './ConflictPanel';
import type { Area, AppEvent, Escalation } from '../../../shared/models';

interface DashboardProps {
  onNewEvent?: () => void;
}

export function Dashboard({ onNewEvent }: DashboardProps) {
  const [activeEvent, setActiveEvent] = useState<AppEvent | null>(null);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [syncStatus, setSyncStatus] = useState<{
    isRunning: boolean;
    lastSyncAt: string | null;
    error: string | null;
  }>({ isRunning: false, lastSyncAt: null, error: null });
  const [syncing, setSyncing] = useState(false);

  const loadData = useCallback(async () => {
    if (!window.opsnest) return;

    const [eventResult, eventsResult] = await Promise.all([
      window.opsnest.getActiveEvent(),
      window.opsnest.listEvents(),
    ]);

    setActiveEvent(eventResult.event);
    setEvents(eventsResult.events || []);

    if (eventResult.event) {
      const [areasResult, escalationsResult, status] = await Promise.all([
        window.opsnest.getAreas(),
        window.opsnest.getEscalations(),
        window.opsnest.getSyncStatus(),
      ]);
      // Filter areas for active event
      const eventAreas = (areasResult.areas || []).filter(
        (a: Area) => a.eventId === eventResult.event.id
      );
      setAreas(eventAreas);
      setEscalations(escalationsResult.escalations || []);
      setSyncStatus({
        isRunning: status.isRunning,
        lastSyncAt: status.lastSyncAt,
        error: status.error,
      });
    }
  }, []);

  useEffect(() => {
    loadData();

    // Start sync engine
    if (window.opsnest) {
      window.opsnest.startSync();
    }

    // Poll for updates
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleSyncNow = async () => {
    if (!window.opsnest) return;
    setSyncing(true);
    try {
      await window.opsnest.syncNow();
      await loadData();
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectEvent = async (eventId: string) => {
    if (!window.opsnest) return;
    await window.opsnest.selectEvent(eventId);
    await loadData();
  };

  // Stats
  const totalEquipmentAreas = areas.length;
  const completedAreas = areas.filter((a) => a.status === 'complete').length;
  const openEscalations = escalations.filter((e) => e.status === 'open').length;

  return (
    <div style={styles.container}>
      {/* Top Bar */}
      <header style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <h1 style={styles.logo}>OpsNest</h1>
          <div style={styles.eventTabs}>
            {events.map((ev) => (
              <button
                key={ev.id}
                style={
                  ev.id === activeEvent?.id
                    ? styles.eventTabActive
                    : styles.eventTab
                }
                onClick={() => handleSelectEvent(ev.id)}
              >
                {ev.name}
              </button>
            ))}
            <button style={styles.newEventBtn} onClick={onNewEvent}>
              + New Event
            </button>
          </div>
        </div>
        <div style={styles.topBarRight}>
          <div style={styles.syncIndicator}>
            <div
              style={{
                ...styles.syncDot,
                background: syncStatus.error
                  ? '#ef4444'
                  : syncStatus.isRunning
                  ? '#22c55e'
                  : '#94a3b8',
              }}
            />
            <span style={styles.syncText}>
              {syncing
                ? 'Syncing...'
                : syncStatus.lastSyncAt
                ? `Synced ${new Date(syncStatus.lastSyncAt).toLocaleTimeString()}`
                : 'Not synced'}
            </span>
          </div>
          <button
            style={{ ...styles.syncBtn, ...(syncing ? { opacity: 0.6 } : {}) }}
            onClick={handleSyncNow}
            disabled={syncing}
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      {activeEvent && areas.length > 0 && (
        <div style={styles.statsBar}>
          <div style={styles.stat}>
            <span style={styles.statValue}>{totalEquipmentAreas}</span>
            <span style={styles.statLabel}>Areas</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statValue}>{completedAreas}</span>
            <span style={styles.statLabel}>Complete</span>
          </div>
          <div style={styles.stat}>
            <span style={{ ...styles.statValue, color: openEscalations > 0 ? '#ef4444' : '#22c55e' }}>
              {openEscalations}
            </span>
            <span style={styles.statLabel}>Escalations</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statValue}>
              {activeEvent.date
                ? Math.max(
                    0,
                    Math.ceil(
                      (new Date(activeEvent.date).getTime() - Date.now()) /
                        (1000 * 60 * 60 * 24)
                    )
                  )
                : '—'}
            </span>
            <span style={styles.statLabel}>Days Until Event</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div style={styles.main}>
        {/* Left Panel - Area Grid */}
        <div style={styles.leftPanel}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>Areas & Equipment</h2>
            <span style={styles.badge}>{areas.length}</span>
          </div>
          <AreaGrid areas={areas} onRefresh={loadData} />
        </div>

        {/* Right Panel */}
        <div style={styles.rightPanel}>
          {/* Email Activity */}
          <div style={styles.rightSection}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Email Activity</h2>
              <span style={styles.badge}>0</span>
            </div>
            <div style={styles.emptyStateSmall}>
              <p>Vendor emails will appear here after Outlook sync (Phase 4).</p>
            </div>
          </div>

          {/* Conflicts & Escalations */}
          <div style={styles.rightSection}>
            <ConflictPanel onResolved={loadData} />
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Escalations & Alerts</h2>
              <span
                style={{
                  ...styles.badge,
                  ...(openEscalations > 0
                    ? { background: '#fef2f2', color: '#ef4444' }
                    : {}),
                }}
              >
                {openEscalations}
              </span>
            </div>
            {escalations.length === 0 ? (
              <div style={styles.emptyStateSmall}>
                <p>No escalations. Everything looks good!</p>
              </div>
            ) : (
              <div style={styles.escalationList}>
                {escalations.map((esc) => (
                  <div key={esc.id} style={styles.escalationCard}>
                    <div style={styles.escalationType}>
                      {esc.type.replace(/_/g, ' ').toUpperCase()}
                    </div>
                    <div style={styles.escalationDesc}>{esc.description}</div>
                    {esc.aiRecommendation && (
                      <div style={styles.escalationRec}>
                        AI recommends: {esc.aiRecommendation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#f8fafc',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 24px',
    background: 'white',
    borderBottom: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  logo: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#6366f1',
  },
  eventTabs: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
  },
  eventTab: {
    padding: '6px 14px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    background: 'white',
    color: '#64748b',
    fontSize: '13px',
    cursor: 'pointer',
  },
  eventTabActive: {
    padding: '6px 14px',
    borderRadius: '6px',
    border: 'none',
    background: '#eef2ff',
    color: '#6366f1',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
  },
  newEventBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px dashed #cbd5e1',
    background: 'transparent',
    color: '#94a3b8',
    fontSize: '12px',
    cursor: 'pointer',
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  syncIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  syncDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  syncText: {
    fontSize: '12px',
    color: '#64748b',
  },
  syncBtn: {
    padding: '6px 14px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    background: 'white',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    color: '#374151',
  },
  statsBar: {
    display: 'flex',
    gap: '24px',
    padding: '12px 24px',
    background: 'white',
    borderBottom: '1px solid #f1f5f9',
  },
  stat: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
  },
  statValue: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#1e293b',
  },
  statLabel: {
    fontSize: '12px',
    color: '#94a3b8',
    fontWeight: 500,
  },
  main: {
    flex: 1,
    display: 'flex',
    gap: '16px',
    padding: '16px',
    overflow: 'hidden',
  },
  leftPanel: {
    flex: '0 0 60%',
    background: 'white',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    overflow: 'auto',
  },
  rightPanel: {
    flex: '0 0 calc(40% - 16px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  rightSection: {
    flex: 1,
    background: 'white',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    overflow: 'auto',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    borderBottom: '1px solid #f1f5f9',
    position: 'sticky',
    top: 0,
    background: 'white',
    zIndex: 1,
  },
  panelTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1e293b',
  },
  badge: {
    padding: '2px 8px',
    borderRadius: '10px',
    background: '#f1f5f9',
    color: '#64748b',
    fontSize: '12px',
    fontWeight: 600,
  },
  emptyStateSmall: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 20px',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '13px',
  },
  escalationList: {
    padding: '8px',
  },
  escalationCard: {
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid #fecaca',
    background: '#fef2f2',
    marginBottom: '8px',
  },
  escalationType: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#ef4444',
    letterSpacing: '0.05em',
    marginBottom: '4px',
  },
  escalationDesc: {
    fontSize: '13px',
    color: '#374151',
    lineHeight: 1.4,
  },
  escalationRec: {
    marginTop: '6px',
    fontSize: '12px',
    color: '#6366f1',
    fontStyle: 'italic',
  },
};
