import React, { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from './stores/auth.store';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard';
import { EventSetup } from './components/onboarding/EventSetup';
import { Dashboard } from './components/dashboard/Dashboard';

type AppScreen = 'loading' | 'onboarding' | 'event-setup' | 'dashboard';

export default function App() {
  const { status, loading, setStatus, setLoading } = useAuthStore();
  const [screen, setScreen] = useState<AppScreen>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        if (!window.opsnest) {
          setScreen('dashboard'); // Dev mode without Electron
          setLoading(false);
          return;
        }

        const authStatus = await window.opsnest.getAuthStatus();
        setStatus(authStatus);

        if (!authStatus.onboardingComplete) {
          setScreen('onboarding');
        } else {
          // Check if there's an active event
          const { event } = await window.opsnest.getActiveEvent();
          if (event) {
            setScreen('dashboard');
          } else {
            setScreen('event-setup');
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [setStatus, setLoading]);

  const handleOnboardingComplete = useCallback(async () => {
    // Check if we already have an event
    if (window.opsnest) {
      const { event } = await window.opsnest.getActiveEvent();
      if (event) {
        setScreen('dashboard');
      } else {
        setScreen('event-setup');
      }
    }
  }, []);

  const handleEventSetupComplete = useCallback(() => {
    setScreen('dashboard');
  }, []);

  const handleNewEvent = useCallback(() => {
    setScreen('event-setup');
  }, []);

  if (loading || screen === 'loading') {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingText}>Starting OpsNest...</div>
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

  switch (screen) {
    case 'onboarding':
      return <OnboardingWizard onComplete={handleOnboardingComplete} />;
    case 'event-setup':
      return <EventSetup onComplete={handleEventSetupComplete} />;
    case 'dashboard':
      return <Dashboard onNewEvent={handleNewEvent} />;
    default:
      return null;
  }
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
