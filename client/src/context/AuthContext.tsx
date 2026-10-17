import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ApiResponse, SetupStatus, UserProfile } from '@media-hub/shared';

interface AuthContextType {
  isInitialized: boolean | null;
  user: UserProfile | null;
  appName: string;
  loading: boolean;
  login: (user: UserProfile) => void;
  logout: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [appName, setAppName] = useState<string>('Nest');
  const [loading, setLoading] = useState<boolean>(true);

  const refreshStatus = async () => {
    setLoading(true);
    try {
      // 1. Check setup status
      const setupRes = await fetch('/api/setup/status');
      if (!setupRes.ok) throw new Error('Failed to fetch setup status');
      const setupJson: ApiResponse<SetupStatus> = await setupRes.json();

      if (setupJson.success) {
        setIsInitialized(setupJson.data.isInitialized);
        if (setupJson.data.appName && setupJson.data.appName !== 'Private Media Hub') {
          setAppName(setupJson.data.appName);
        } else {
          setAppName('Nest');
        }

        // 2. If initialized, check current session
        if (setupJson.data.isInitialized) {
          const authRes = await fetch('/api/auth/me');
          if (authRes.ok) {
            const authJson: ApiResponse<{ user: UserProfile }> = await authRes.json();
            if (authJson.success) {
              setUser(authJson.data.user);
            } else {
              setUser(null);
            }
          } else {
            setUser(null);
          }
        }
      }
    } catch {
      setIsInitialized(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  const login = (authenticatedUser: UserProfile) => {
    setUser(authenticatedUser);
    setIsInitialized(true);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ isInitialized, user, appName, loading, login, logout, refreshStatus }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
