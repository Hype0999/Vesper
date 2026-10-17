import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { ApiResponse, UserProfile } from '@media-hub/shared';
import {
  User,
  Lock,
  KeyRound,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  HardDrive,
  Layers,
  Eye,
  EyeOff,
  Server,
} from 'lucide-react';
import { VesperLogo } from '../components/VesperLogo';

const STEP_LABELS = [
  'Welcome',
  'Account',
  'Master Password',
  'Confirm Password',
  'Vault Passphrase',
  'Confirm Vault',
  'Branding',
  'Storage',
  'Security Audit',
  'Initialization',
];

export function SetupWizard() {
  const { login } = useAuth();
  const [step, setStep] = useState(1);

  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [vaultPassword, setVaultPassword] = useState('');
  const [vaultPasswordConfirm, setVaultPasswordConfirm] = useState('');
  const [appName, setAppName] = useState('Vesper');

  // Password Visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showVaultPassword, setShowVaultPassword] = useState(false);

  // UI State
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const totalSteps = 10;

  const validateCurrentStep = (): boolean => {
    setError(null);
    switch (step) {
      case 2:
        if (username.trim().length < 3) {
          setError('Username must contain at least 3 characters.');
          return false;
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(username.trim())) {
          setError('Username can only contain alphanumeric characters, hyphens, and underscores.');
          return false;
        }
        return true;
      case 3:
        if (password.length < 8) {
          setError('Account password must be at least 8 characters long.');
          return false;
        }
        return true;
      case 4:
        if (password !== passwordConfirm) {
          setError('Account passwords do not match.');
          return false;
        }
        return true;
      case 5:
        if (vaultPassword.length < 8) {
          setError('Vault passphrase must be at least 8 characters long.');
          return false;
        }
        if (vaultPassword === password) {
          setError('Vault passphrase must be different from master account password to enforce step-up authorization.');
          return false;
        }
        return true;
      case 6:
        if (vaultPassword !== vaultPasswordConfirm) {
          setError('Vault passphrases do not match.');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setStep((prev) => Math.min(prev + 1, totalSteps));
    }
  };

  const handleBack = () => {
    setError(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/setup/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
          passwordConfirm,
          vaultPassword,
          vaultPasswordConfirm,
          appName: appName.trim() || undefined,
        }),
      });

      const json: ApiResponse<{ user: UserProfile }> = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.success ? 'Setup failed' : json.error.message);
      }

      login(json.data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Initialization failed.');
      setSubmitting(false);
    }
  };

  return (
    <div className="app-container" style={{ maxWidth: '580px', justifyContent: 'center' }}>
      <div className="card" style={{ padding: 'var(--space-8)' }}>
        {/* Minimalist Header with Step Counter */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-3)' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                System Onboarding
              </span>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500, marginTop: '2px' }}>
                {String(step).padStart(2, '0')} / {totalSteps} · {STEP_LABELS[step - 1]}
              </p>
            </div>
            <span className="badge badge-subtle">Phase 3</span>
          </div>

          {/* Clean hairline progress bar */}
          <div style={{ height: '2px', background: 'var(--border-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
            <div
              style={{
                width: `${(step / totalSteps) * 100}%`,
                height: '100%',
                background: 'var(--accent-white)',
                transition: 'width 250ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              marginBottom: 'var(--space-5)',
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.25)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-danger)',
              fontSize: '0.85rem',
            }}
          >
            {error}
          </div>
        )}

        {/* STEP 1: Welcome */}
        {step === 1 && (
          <div>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <VesperLogo size="lg" showText={true} subtitle="Zero-Transcode 4K Media Sanctuary" />
            </div>
            <p style={{ marginTop: 'var(--space-2)', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              A personal, self-hosted media platform engineered for local laptops and Raspberry Pi home servers.
            </p>

            <div
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--space-4)',
                marginTop: 'var(--space-5)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                  <HardDrive size={18} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>100% Self-Hosted</strong>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Zero external third-party cloud backends, tracking, or telemetry.</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                  <KeyRound size={18} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Two-Tier Step-Up Authorization</strong>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Independent vault credentials for sensitive photos, videos, and notes.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Administrator Username */}
        {step === 2 && (
          <div>
            <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
              <User size={18} strokeWidth={1.75} />
            </div>
            <h2>Administrator Account</h2>
            <p style={{ marginTop: 'var(--space-2)' }}>Choose your primary username.</p>
            <div style={{ marginTop: 'var(--space-5)' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
                Username
              </label>
              <input
                type="text"
                autoFocus
                className="input-field"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin"
              />
            </div>
          </div>
        )}

        {/* STEP 3: Master Password */}
        {step === 3 && (
          <div>
            <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
              <Lock size={18} strokeWidth={1.75} />
            </div>
            <h2>Master Password</h2>
            <p style={{ marginTop: 'var(--space-2)' }}>
              Used to sign in to your regular media library and application dashboard.
            </p>
            <div style={{ marginTop: 'var(--space-5)' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
                Password (minimum 8 characters)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  className="input-field"
                  style={{ paddingRight: '2.75rem' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Confirm Password */}
        {step === 4 && (
          <div>
            <h2>Confirm Master Password</h2>
            <p style={{ marginTop: 'var(--space-2)' }}>Re-enter your master account password.</p>
            <div style={{ marginTop: 'var(--space-5)' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
                Confirm Password
              </label>
              <input
                type="password"
                autoFocus
                className="input-field"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="••••••••••••"
              />
            </div>
          </div>
        )}

        {/* STEP 5: Vault Passphrase */}
        {step === 5 && (
          <div>
            <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-sm)', background: 'var(--vault-subtle)', border: '1px solid var(--vault-border)', color: 'var(--vault-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
              <KeyRound size={18} strokeWidth={1.75} />
            </div>
            <h2>Private Vault Passphrase</h2>
            <p style={{ marginTop: 'var(--space-2)', lineHeight: '1.6' }}>
              Your private media and encrypted notes require separate <strong>step-up authorization</strong>. This passphrase must be different from your account password.
            </p>
            <div style={{ marginTop: 'var(--space-5)' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
                Vault Passphrase (minimum 8 characters)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showVaultPassword ? 'text' : 'password'}
                  autoFocus
                  className="input-field"
                  style={{ paddingRight: '2.75rem' }}
                  value={vaultPassword}
                  onChange={(e) => setVaultPassword(e.target.value)}
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowVaultPassword(!showVaultPassword)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  {showVaultPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: Confirm Vault Passphrase */}
        {step === 6 && (
          <div>
            <h2>Confirm Vault Passphrase</h2>
            <p style={{ marginTop: 'var(--space-2)' }}>Re-enter your private vault passphrase.</p>
            <div style={{ marginTop: 'var(--space-5)' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
                Confirm Vault Passphrase
              </label>
              <input
                type="password"
                autoFocus
                className="input-field"
                value={vaultPasswordConfirm}
                onChange={(e) => setVaultPasswordConfirm(e.target.value)}
                placeholder="••••••••••••"
              />
            </div>
          </div>
        )}

        {/* STEP 7: Application Branding */}
        {step === 7 && (
          <div>
            <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
              <Sparkles size={18} strokeWidth={1.75} />
            </div>
            <h2>Hub Name</h2>
            <p style={{ marginTop: 'var(--space-2)' }}>Personalize your media server title.</p>
            <div style={{ marginTop: 'var(--space-5)' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
                Application Title
              </label>
              <input
                type="text"
                className="input-field"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="Nest"
              />
            </div>
          </div>
        )}

        {/* STEP 8: Storage Overview */}
        {step === 8 && (
          <div>
            <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
              <Layers size={18} strokeWidth={1.75} />
            </div>
            <h2>Storage Architecture</h2>
            <p style={{ marginTop: 'var(--space-2)' }}>
              Files are physically segregated outside the web server root:
            </p>
            <div
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--space-4)',
                marginTop: 'var(--space-4)',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                lineHeight: '1.8',
              }}
            >
              <p style={{ color: 'var(--text-primary)' }}>storage/</p>
              <p style={{ paddingLeft: '1rem', color: 'var(--text-secondary)' }}>├── normal/ (library media)</p>
              <p style={{ paddingLeft: '1rem', color: 'var(--vault-primary)' }}>├── private/ (vault-authorized media)</p>
              <p style={{ paddingLeft: '1rem', color: 'var(--text-muted)' }}>└── database/ (SQLite WAL database)</p>
            </div>
          </div>
        )}

        {/* STEP 9: Security Audit */}
        {step === 9 && (
          <div>
            <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
              <Server size={18} strokeWidth={1.75} />
            </div>
            <h2>Security Configuration</h2>
            <p style={{ marginTop: 'var(--space-2)' }}>Pre-initialization security baseline summary:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
              {[
                { label: 'Password Hashes', value: 'Argon2id (OWASP)' },
                { label: 'Session Storage', value: 'SHA-256 in SQLite' },
                { label: 'Cookies', value: 'HttpOnly, SameSite=Strict' },
                { label: 'Database Engine', value: 'SQLite with WAL mode' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.6rem 0.8rem',
                    background: 'var(--bg-surface-elevated)',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: '0.85rem',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 10: Complete */}
        {step === 10 && (
          <div>
            <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-sm)', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--accent-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
              <CheckCircle2 size={20} strokeWidth={1.75} />
            </div>
            <h2>Ready to Launch</h2>
            <p style={{ marginTop: 'var(--space-2)', lineHeight: '1.6' }}>
              Setup configuration complete. Administrator <strong>{username}</strong> will be registered, and setup will lock permanently.
            </p>
          </div>
        )}

        {/* Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-8)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)' }}>
          {step > 1 ? (
            <button className="btn btn-ghost" onClick={handleBack} disabled={submitting}>
              <ArrowLeft size={16} /> Back
            </button>
          ) : (
            <div />
          )}

          {step < totalSteps ? (
            <button className="btn btn-primary" onClick={handleNext}>
              Continue <ArrowRight size={16} />
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Initializing...' : 'Complete & Launch Hub'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
