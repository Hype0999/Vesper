import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Trash2, X, Shield, User, AlertCircle, Check } from 'lucide-react';
import type { UserProfile } from '@media-hub/shared';

interface UsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
}

export const UsersModal: React.FC<UsersModalProps> = ({ isOpen, onClose, currentUserId }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New User Form State
  const [isAddingUser, setIsAddingUser] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<'admin' | 'member' | 'guest'>('member');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/users');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setUsers(json.data.users);
        }
      }
    } catch {
      /* ignore */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void fetchUsers();
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
          role,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSuccess(`User "${username.trim()}" created successfully`);
        setUsername('');
        setPassword('');
        setIsAddingUser(false);
        void fetchUsers();
      } else {
        setError(json.error?.message || 'Failed to create user');
      }
    } catch {
      setError('Network request error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string, targetUsername: string) => {
    if (!window.confirm(`Are you sure you want to remove user "${targetUsername}"?`)) return;

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        setSuccess(`User "${targetUsername}" removed`);
      } else {
        setError(json.error?.message || 'Could not delete user');
      }
    } catch {
      setError('Network error deleting user');
    }
  };

  if (!isOpen) return null;

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
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '85vh',
          overflowY: 'auto',
          position: 'relative',
          padding: 'var(--space-6)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 'var(--space-4)',
            right: 'var(--space-4)',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
          }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}
          >
            <Users size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Multi-User Management
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Add travel companions, friends, or family to share streaming
            </p>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              marginBottom: 'var(--space-3)',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            style={{
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              marginBottom: 'var(--space-3)',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Check size={14} />
            <span>{success}</span>
          </div>
        )}

        {/* Existing Users List */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Active Accounts ({users.length})
            </span>
            {!isAddingUser && (
              <button
                className="btn btn-secondary"
                onClick={() => setIsAddingUser(true)}
                style={{ fontSize: '0.75rem', padding: '4px 8px', gap: '4px' }}
              >
                <UserPlus size={13} />
                <span>Add Companion</span>
              </button>
            )}
          </div>

          <div
            style={{
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-surface-elevated)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {isLoading ? (
              <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Loading companions...
              </div>
            ) : users.length === 0 ? (
              <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No companion accounts yet. Click "Add Companion" to create one.
              </div>
            ) : (
              users.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <div
                    key={u.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderBottom: '1px solid var(--border-subtle)',
                      background: 'var(--bg-surface)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: u.role === 'admin' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                          color: u.role === 'admin' ? '#ef4444' : '#3b82f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {u.role === 'admin' ? <Shield size={16} /> : <User size={16} />}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#ffffff' }}>
                            {u.username}
                          </span>
                          {isSelf && (
                            <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.1)', color: '#d1d5db', padding: '1px 5px', borderRadius: '4px' }}>
                              You
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          Role: {u.role || 'member'}
                        </span>
                      </div>
                    </div>

                    {!isSelf && (
                      <button
                        onClick={() => void handleDeleteUser(u.id, u.username)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                        title="Remove account"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Add User Form Drawer */}
        {isAddingUser && (
          <form
            onSubmit={handleCreateUser}
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>
                Create New Account
              </span>
              <button
                type="button"
                onClick={() => setIsAddingUser(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
              >
                <X size={14} />
              </button>
            </div>

            <div>
              <label className="label" htmlFor="new-user-username">Username</label>
              <input
                id="new-user-username"
                type="text"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="companion_name"
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="label" htmlFor="new-user-password">Password</label>
              <input
                id="new-user-password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="label" htmlFor="new-user-role">Role</label>
              <select
                id="new-user-role"
                className="input"
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'member' | 'guest')}
                disabled={isSubmitting}
              >
                <option value="member">Member / Companion (Stream movies & songs, upload)</option>
                <option value="guest">Guest (Read-only streaming, no private vault)</option>
                <option value="admin">Administrator (Full device & Wi-Fi control)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setIsAddingUser(false)}
                disabled={isSubmitting}
                style={{ fontSize: '0.8rem' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || !username.trim() || !password}
                style={{ fontSize: '0.8rem' }}
              >
                {isSubmitting ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
