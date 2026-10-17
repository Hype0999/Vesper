import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, RefreshCw } from 'lucide-react';

interface FactoryResetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FactoryResetModal: React.FC<FactoryResetModalProps> = ({ isOpen, onClose }) => {
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isConfirmed = confirmationInput.trim().toUpperCase() === 'RESET';

  const handleHardReset = async () => {
    if (!isConfirmed || isResetting) return;

    setIsResetting(true);
    setError(null);

    try {
      const res = await fetch('/api/system/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ confirmation: 'RESET' }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        // Immediate clean reload to trigger Setup Wizard
        window.location.href = '/';
      } else {
        setError(json.error?.message || 'Hard reset failed. Please check server logs.');
        setIsResetting(false);
      }
    } catch {
      setError('Connection failed. Server might be restarting.');
      setIsResetting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isResetting) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '500px',
          padding: 'var(--space-6)',
          background: '#0d0f14',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          boxShadow: '0 20px 50px rgba(239, 68, 68, 0.2)',
          position: 'relative',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isResetting}
          style={{
            position: 'absolute',
            top: 'var(--space-4)',
            right: 'var(--space-4)',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
          }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Header Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
            }}
          >
            <AlertTriangle size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#ef4444', margin: 0 }}>
              Factory Hard Reset
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Permanent wipe of media and database
            </p>
          </div>
        </div>

        {/* Description Warning */}
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-4)',
            fontSize: '0.83rem',
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            marginBottom: 'var(--space-5)',
          }}
        >
          <p style={{ margin: 0, fontWeight: 500, color: '#f87171', marginBottom: '6px' }}>
            ⚠️ This action cannot be reversed!
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            <li><strong>All physical media files</strong> (videos, photos, thumbnails) deleted from disk</li>
            <li><strong>All database records</strong> (categories, tags, notes, playback history) wiped</li>
            <li><strong>All user credentials & vault passphrases</strong> permanently cleared</li>
            <li>Nest returns to its clean first-run Setup Wizard</li>
          </ul>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#f87171',
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-xs)',
              fontSize: '0.8rem',
              marginBottom: 'var(--space-4)',
            }}
          >
            {error}
          </div>
        )}

        {/* Confirmation Input */}
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              marginBottom: '6px',
            }}
          >
            Type <strong style={{ color: '#ef4444', letterSpacing: '1px' }}>RESET</strong> to confirm:
          </label>
          <input
            type="text"
            className="input"
            value={confirmationInput}
            onChange={(e) => setConfirmationInput(e.target.value)}
            placeholder="Type RESET here"
            disabled={isResetting}
            autoFocus
            style={{
              borderColor: isConfirmed ? '#ef4444' : 'var(--border-strong)',
              background: 'var(--bg-surface)',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              letterSpacing: '1px',
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isResetting}
            style={{ fontSize: '0.85rem' }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => void handleHardReset()}
            disabled={!isConfirmed || isResetting}
            style={{
              background: isConfirmed ? '#dc2626' : 'rgba(220, 38, 38, 0.3)',
              borderColor: isConfirmed ? '#ef4444' : 'transparent',
              color: '#ffffff',
              padding: '0.5rem 1.1rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: isConfirmed && !isResetting ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: isConfirmed ? '0 4px 15px rgba(220, 38, 38, 0.4)' : 'none',
              transition: 'all var(--duration-fast)',
            }}
          >
            {isResetting ? (
              <>
                <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Wiping Everything...</span>
              </>
            ) : (
              <>
                <Trash2 size={15} />
                <span>Hard Reset Nest</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
