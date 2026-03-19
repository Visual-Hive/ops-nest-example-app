import React, { useEffect, useState } from 'react';
import { useAuthStore } from './stores/auth.store';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard';
import { Dashboard } from './components/dashboard/Dashboard';

export default function App() {
  const { status, loading, setStatus, setLoading } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        if (window.opsnest) {
          const authStatus = await window.opsnest.getAuthStatus();
          setStatus(authStatus);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to check auth status');
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [setStatus, setLoading]);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Starting OpsNest...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <h2>Something went wrong</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!status.onboardingComplete) {
    return <OnboardingWizard />;
  }

  return <Dashboard />;
}

const styles: Record<string, React.CSSProperties> = {
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    gap: '16px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e2e8f0',
    borderTopColor: '#6366f1',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: '#64748b',
    fontSize: '14px',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    gap: '8px',
    color: '#dc2626',
  },
};
