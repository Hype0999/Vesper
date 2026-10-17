import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import type { ApiResponse, VaultStatus } from '@media-hub/shared';
import { useAuth } from './AuthContext';

// Idle timeout: 15 minutes of zero user activity
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

interface VaultContextType {
  isUnlocked: boolean;
  isLoading: boolean;
  isUnlockModalOpen: boolean;
  openUnlockModal: () => void;
  closeUnlockModal: () => void;
  unlockVault: (passphrase: string) => Promise<{ success: boolean; error?: string }>;
  lockVault: () => Promise<void>;
  refreshVaultStatus: () => Promise<void>;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState<boolean>(false);
  const idleTimerRef = useRef<number | null>(null);

  const lockVault = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await fetch('/api/vault/lock', {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
        keepalive: true,
      });
    } finally {
      setIsUnlocked(false);
      setIsLoading(false);
    }
  }, []);

  const refreshVaultStatus = useCallback(async () => {
    if (!user) {
      setIsUnlocked(false);
      return;
    }

    try {
      const res = await fetch('/api/vault/status');
      if (res.ok) {
        const json: ApiResponse<VaultStatus> = await res.json();
        if (json.success) {
          setIsUnlocked(json.data.isUnlocked);
        } else {
          setIsUnlocked(false);
        }
      } else {
        setIsUnlocked(false);
      }
    } catch {
      setIsUnlocked(false);
    }
  }, [user]);

  // Sync status when user logs in or changes
  useEffect(() => {
    if (user) {
      void refreshVaultStatus();
    } else {
      setIsUnlocked(false);
    }
  }, [user, refreshVaultStatus]);

  // Reset idle timer on any user activity when vault is unlocked
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    if (isUnlocked) {
      idleTimerRef.current = window.setTimeout(() => {
        void lockVault();
      }, IDLE_TIMEOUT_MS);
    }
  }, [isUnlocked, lockVault]);

  useEffect(() => {
    if (!isUnlocked) {
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return;
    }

    // Start idle timer
    resetIdleTimer();

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    const handleActivity = () => resetIdleTimer();

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, handleActivity, { passive: true });
    });

    return () => {
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
      }
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, handleActivity);
      });
    };
  }, [isUnlocked, resetIdleTimer]);

  // Lock vault on tab close or page unload
  useEffect(() => {
    const handlePageUnload = () => {
      if (isUnlocked) {
        // Send keepalive beacon to ensure vault session is destroyed immediately
        fetch('/api/vault/lock', {
          method: 'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener('pagehide', handlePageUnload);
    window.addEventListener('beforeunload', handlePageUnload);

    return () => {
      window.removeEventListener('pagehide', handlePageUnload);
      window.removeEventListener('beforeunload', handlePageUnload);
    };
  }, [isUnlocked]);

  const unlockVault = async (passphrase: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/vault/unlock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ vaultPassword: passphrase }),
      });

      const json: ApiResponse<VaultStatus> = await res.json();
      if (res.ok && json.success) {
        setIsUnlocked(true);
        setIsUnlockModalOpen(false);
        resetIdleTimer();
        return { success: true };
      } else if (!json.success) {
        return { success: false, error: json.error.message };
      } else {
        return { success: false, error: 'Invalid vault passphrase' };
      }
    } catch {
      return { success: false, error: 'Network error connecting to vault service' };
    } finally {
      setIsLoading(false);
    }
  };

  const openUnlockModal = () => setIsUnlockModalOpen(true);
  const closeUnlockModal = () => setIsUnlockModalOpen(false);

  return (
    <VaultContext.Provider
      value={{
        isUnlocked,
        isLoading,
        isUnlockModalOpen,
        openUnlockModal,
        closeUnlockModal,
        unlockVault,
        lockVault,
        refreshVaultStatus,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export function useVault(): VaultContextType {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
}
