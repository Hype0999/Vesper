import React from 'react';
import { useVault } from '../context/VaultContext';
import { Lock, ShieldAlert, ShieldCheck } from 'lucide-react';

export const VaultBanner: React.FC = () => {
  const { isUnlocked, lockVault, isLoading } = useVault();

  if (!isUnlocked) return null;

  return (
    <div
      style={{
        background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.04) 100%)',
        border: '1px solid var(--vault-border)',
        borderRadius: 'var(--radius-md)',
        padding: '0.65rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        boxShadow: 'var(--shadow-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-xs)',
            background: 'var(--vault-subtle)',
            border: '1px solid var(--vault-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--vault-primary)',
            flexShrink: 0,
          }}
        >
          <Lock size={14} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--vault-primary)' }}>
              Private Vault Active
            </span>
            <span
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '0.1rem 0.5rem',
                borderRadius: 'var(--radius-full)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <ShieldCheck size={11} style={{ color: 'var(--accent-success)' }} />
              Auto-locks on idle or tab close
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
            Step-up authorization unlocked. Private media and encrypted notes are visible.
          </p>
        </div>
      </div>

      <button
        className="btn btn-ghost"
        onClick={() => void lockVault()}
        disabled={isLoading}
        style={{
          fontSize: '0.75rem',
          padding: '0.35rem 0.75rem',
          borderColor: 'var(--vault-border)',
          color: 'var(--vault-primary)',
          flexShrink: 0,
        }}
      >
        <ShieldAlert size={13} />
        <span>{isLoading ? 'Locking...' : 'Lock Vault'}</span>
      </button>
    </div>
  );
};
