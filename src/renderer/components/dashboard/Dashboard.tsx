import React, { useEffect, useState } from 'react';
import type { SyncStatus as SyncStatusType } from '../../../shared/models';

export function Dashboard() {
  const [syncStatus, setSyncStatus] = useState<SyncStatusType | null>(null);

  useEffect(() => {
    async function init() {
      if (!window.opsnest) return;
      // Start sync engine
      await window.opsnest.startSync();
      const status = await window.opsnest.getSyncStatus();
      setSyncStatus({
        isRunning: status.isRunning,
        lastSyncAt: status.lastSyncAt,
        error: status.error,
        sheetsConnected: false,
        mondayConnected: false,
        outlookConnected: false,
      });
    }
    init();

    // Poll sync status
    const interval = setInterval(async () => {
      if (!window.opsnest) return;
      const status = await window.opsnest.getSyncStatus();
      setSyncStatus({
        isRunning: status.isRunning,
        lastSyncAt: status.lastSyncAt,
        error: status.error,
        sheetsConnected: false,
        mondayConnected: false,
        outlookConnected: false,
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleSyncNow = async () => {
    if (!window.opsnest) return;
    await window.opsnest.syncNow();
  };

  return (
    <div style={styles.container}>
      {/* Top Bar */}
      <header style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <h1 style={styles.logo}>OpsNest</h1>
          {/* Event tabs - placeholder for multi-event support */}
          <div style={styles.eventTabs}>
            <button style={styles.eventTabActive}>Trade Show 2026</button>
          </div>
        </div>
        <div style={styles.topBarRight}>
          <div style={styles.syncIndicator}>
            <div
              style={{
                ...styles.syncDot,
                background: syncStatus?.isRunning ? '#22c55e' : '#ef4444',
              }}
            />
            <span style={styles.syncText}>
              {syncStatus?.lastSyncAt
                ? `Last sync: ${new Date(syncStatus.lastSyncAt).toLocaleTimeString()}`
                : 'Not synced yet'}
            </span>
          </div>
          <button style={styles.syncBtn} onClick={handleSyncNow}>
            Sync Now
          </button>
          <button style={styles.settingsBtn}>⚙️</button>
        </div>
      </header>

      {/* Main Content */}
      <div style={styles.main}>
        {/* Left Panel - Area Grid */}
        <div style={styles.leftPanel}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>Areas & Equipment</h2>
          </div>
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📋</div>
            <h3>No areas synced yet</h3>
            <p>Connect your Google Sheet and Monday.com board to see your event areas here.</p>
            <p style={styles.emptyHint}>
              The sync engine will automatically pull data from your connected services.
            </p>
          </div>
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
              <p>Connect Microsoft 365 to see vendor emails here.</p>
            </div>
          </div>

          {/* Escalations */}
          <div style={styles.rightSection}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Escalations & Alerts</h2>
              <span style={styles.badge}>0</span>
            </div>
            <div style={styles.emptyStateSmall}>
              <p>AI-flagged items needing your attention will appear here.</p>
            </div>
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
    padding: '12px 24px',
    background: 'white',
    borderBottom: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
  },
  logo: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#6366f1',
  },
  eventTabs: {
    display: 'flex',
    gap: '4px',
  },
  eventTabActive: {
    padding: '6px 16px',
    borderRadius: '6px',
    border: 'none',
    background: '#eef2ff',
    color: '#6366f1',
    fontWeight: 600,
    fontSize: '13px',
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
  settingsBtn: {
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    background: 'white',
    cursor: 'pointer',
    fontSize: '16px',
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
    padding: '16px 20px',
    borderBottom: '1px solid #f1f5f9',
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
  emptyState: {
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
  emptyHint: {
    fontSize: '13px',
    color: '#94a3b8',
    marginTop: '8px',
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
};
