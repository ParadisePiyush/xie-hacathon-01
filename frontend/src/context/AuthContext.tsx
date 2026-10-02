import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import type { LoginCredentials, RegisterCredentials, User, UserRole } from '../api/types';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  quickLogin: (persona: 'admin' | 'dispatcher' | 'collector' | 'reporter') => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isDispatcher: boolean;
  isCollector: boolean;
  isReporter: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize from existing token or auto-login default demo persona
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const profile = await apiClient.getMe();
          setUser(profile);
        } catch (err) {
          console.warn('Stored token expired or invalid:', err);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const res = await apiClient.login(credentials);
    setUser(res.user);
  };

  const register = async (credentials: RegisterCredentials) => {
    const res = await apiClient.register(credentials);
    setUser(res.user);
  };

  const logout = async () => {
    await apiClient.logout();
    setUser(null);
  };

  const quickLogin = async (persona: 'admin' | 'dispatcher' | 'collector' | 'reporter') => {
    const credentialsMap: Record<'admin' | 'dispatcher' | 'collector' | 'reporter', LoginCredentials> = {
      admin: { email: 'admin@smartwaste.city', password: 'Admin@123' },
      dispatcher: { email: 'dispatcher@smartwaste.city', password: 'Dispatch@123' },
      collector: { email: 'collector@smartwaste.city', password: 'Collector@123' },
      reporter: { email: 'citizen@smartwaste.city', password: 'Citizen@123' },
    };

    const creds = credentialsMap[persona];
    await login(creds);
  };

  const role = user?.role || null;
  const isAuthenticated = !!user;
  const isAdmin = role === 'admin';
  const isDispatcher = role === 'dispatcher' || isAdmin;
  const isCollector = role === 'collector';
  const isReporter = role === 'reporter';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isLoading,
        login,
        register,
        logout,
        quickLogin,
        isAuthenticated,
        isAdmin,
        isDispatcher,
        isCollector,
        isReporter,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
