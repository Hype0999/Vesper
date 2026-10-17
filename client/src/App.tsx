import { AuthProvider, useAuth } from './context/AuthContext';
import { VaultProvider } from './context/VaultContext';
import { SetupWizard } from './pages/SetupWizard';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ErrorBoundary } from './components/ErrorBoundary';

function AppContent() {
  const { isInitialized, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid var(--border-strong)',
              borderTopColor: '#ffffff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto var(--space-4)',
            }}
          />
          <p style={{ color: 'var(--text-muted)' }}>Loading Vesper...</p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // 1. If hub is not configured yet, show the First-Run Setup Wizard
  if (!isInitialized) {
    return <SetupWizard />;
  }

  // 2. If configured but no active authenticated session, show Login
  if (!user) {
    return <LoginPage />;
  }

  // 3. Authenticated session: show dashboard
  return <DashboardPage />;
}

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <VaultProvider>
          <AppContent />
        </VaultProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

