import React, { useState } from 'react';
import { ApiKeyStep } from './ApiKeyStep';
import { GoogleSheetsStep } from './GoogleSheetsStep';
import { MicrosoftStep } from './MicrosoftStep';
import { useAuthStore } from '../../stores/auth.store';

const STEPS = [
  { id: 'anthropic', title: 'Claude AI', description: 'AI-powered email analysis' },
  { id: 'monday', title: 'Monday.com', description: 'Task management sync' },
  { id: 'google', title: 'Google Sheets', description: 'Source of truth' },
  { id: 'microsoft', title: 'Microsoft 365', description: 'Email integration' },
];

export function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const { setStatus } = useAuthStore();

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = async () => {
    // Mark onboarding as complete even if some steps were skipped
    if (window.opsnest) {
      const status = await window.opsnest.getAuthStatus();
      setStatus({ ...status, onboardingComplete: true });
    }
  };

  const isLast = currentStep === STEPS.length - 1;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>OpsNest Conference Sync</h1>
          <p style={styles.subtitle}>Let's connect your tools. You can skip any step and set it up later.</p>
        </div>

        {/* Step indicators */}
        <div style={styles.steps}>
          {STEPS.map((step, i) => (
            <div
              key={step.id}
              style={{
                ...styles.stepIndicator,
                ...(i === currentStep ? styles.stepActive : {}),
                ...(i < currentStep ? styles.stepDone : {}),
              }}
              onClick={() => setCurrentStep(i)}
            >
              <div style={styles.stepNumber}>{i < currentStep ? '✓' : i + 1}</div>
              <div>
                <div style={styles.stepTitle}>{step.title}</div>
                <div style={styles.stepDesc}>{step.description}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Step content */}
        <div style={styles.content}>
          {currentStep === 0 && (
            <ApiKeyStep
              service="anthropic"
              title="Anthropic Claude API Key"
              description="This enables AI-powered email analysis, draft composition, and smart escalations."
              helpUrl="https://console.anthropic.com/settings/keys"
              helpText="Get your API key from the Anthropic Console"
              placeholder="sk-ant-..."
            />
          )}
          {currentStep === 1 && (
            <ApiKeyStep
              service="monday"
              title="Monday.com API Token"
              description="This connects your Monday boards so we can sync task statuses and vendor tracking."
              helpUrl="https://support.monday.com/hc/en-us/articles/360005144659"
              helpText="Find your API token in Monday.com > My Profile > API"
              placeholder="eyJhbGciOi..."
            />
          )}
          {currentStep === 2 && <GoogleSheetsStep />}
          {currentStep === 3 && <MicrosoftStep />}
        </div>

        {/* Navigation */}
        <div style={styles.nav}>
          {currentStep > 0 && (
            <button style={styles.btnSecondary} onClick={handleBack}>
              Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button style={styles.btnSecondary} onClick={isLast ? handleFinish : handleNext}>
            Skip
          </button>
          <button style={styles.btnPrimary} onClick={isLast ? handleFinish : handleNext}>
            {isLast ? 'Finish Setup' : 'Next'}
          </button>
        </div>
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
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  card: {
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
    width: '100%',
    maxWidth: '720px',
    padding: '40px',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '32px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: '8px',
  },
  subtitle: {
    color: '#64748b',
    fontSize: '15px',
  },
  steps: {
    display: 'flex',
    gap: '8px',
    marginBottom: '32px',
    overflowX: 'auto' as const,
  },
  stepIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: '10px',
    cursor: 'pointer',
    border: '2px solid #e2e8f0',
    flex: 1,
    transition: 'all 0.2s',
  },
  stepActive: {
    borderColor: '#6366f1',
    background: '#eef2ff',
  },
  stepDone: {
    borderColor: '#22c55e',
    background: '#f0fdf4',
  },
  stepNumber: {
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
  },
  stepTitle: {
    fontWeight: 600,
    fontSize: '13px',
    color: '#1e293b',
  },
  stepDesc: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  content: {
    minHeight: '280px',
    marginBottom: '24px',
  },
  nav: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    borderTop: '1px solid #e2e8f0',
    paddingTop: '20px',
  },
  btnPrimary: {
    padding: '10px 24px',
    borderRadius: '8px',
    border: 'none',
    background: '#6366f1',
    color: 'white',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
  },
  btnSecondary: {
    padding: '10px 24px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: 'white',
    color: '#64748b',
    fontWeight: 500,
    fontSize: '14px',
    cursor: 'pointer',
  },
};
