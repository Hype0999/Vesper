import React, { useState, useEffect, useRef } from 'react';
import { useVault } from '../context/VaultContext';
import { Lock, Eye, EyeOff, ShieldCheck, X } from 'lucide-react';

export const VaultModal: React.FC = () => {
  const { isUnlockModalOpen, closeUnlockModal, unlockVault, isLoading } = useVault();
  const [passphrase, setPassphrase] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isUnlockModalOpen) {
      setPassphrase('');
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isUnlockModalOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isUnlockModalOpen) {
        closeUnlockModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUnlockModalOpen, closeUnlockModal]);

  if (!isUnlockModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) {
      setError('Please enter your vault passphrase');
      return;
    }

    setError(null);
    const res = await unlockVault(passphrase);
    if (!res.success) {
      setError(res.error || 'Authentication failed. Please check your vault passphrase.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(4, 5, 7, 0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeUnlockModal();
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: 'var(--space-6)',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-elevated)',
          position: 'relative',
        }}
      >
        {/* Close Button */}
        <button
          onClick={closeUnlockModal}
          style={{
            position: 'absolute',
            top: 'var(--space-4)',
            right: 'var(--space-4)',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: 'var(--radius-xs)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Close modal"
        >
          <X size={16} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--vault-subtle)',
              border: '1px solid var(--vault-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--vault-primary)',
              flexShrink: 0,
            }}
          >
            <Lock size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Unlock Private Vault
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Two-Tier Step-Up Authorization
            </p>
          </div>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: 'var(--space-5)' }}>
          Enter your independent vault passphrase to access private media and encrypted notes. Automatically locks on inactivity or when tab is closed.
        </p>

        {error && (
          <div
            style={{
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: 'var(--accent-danger)',
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              marginBottom: 'var(--space-4)',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 'var(--space-5)' }}>
            <label className="label" htmlFor="vault-passphrase-input">
              Vault Passphrase
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="vault-passphrase-input"
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                className="input"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter dedicated vault passphrase"
                autoComplete="current-password"
                disabled={isLoading}
                style={{
                  paddingRight: '2.5rem',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  borderColor: 'var(--border-strong)',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                }}
                aria-label={showPassword ? 'Hide passphrase' : 'Show passphrase'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={closeUnlockModal}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || !passphrase.trim()}
              style={{
                background: 'var(--vault-primary)',
                color: '#000',
                borderColor: 'var(--vault-primary)',
                fontWeight: 600,
              }}
            >
              <ShieldCheck size={16} />
              <span>{isLoading ? 'Verifying...' : 'Unlock Vault'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
