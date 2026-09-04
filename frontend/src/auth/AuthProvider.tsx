import { createContext, useCallback, useContext, useState, useEffect, type ReactNode } from 'react';
import http from '../api/http';
import type { PlanId } from '../types/earnings';

export interface User {
  id: string;
  username: string;
  email: string;
  balance: number | string;
  bio?: string;
  profileImageUrl?: string;
  coverImageUrl?: string;
  onboardingStep: number;
  onboardingCompleted: boolean;
  isVerified: boolean;
  role: string;
  plan: PlanId;
  authorIncome: number | string;
  readerCoins: number | string;
  totalReaderCoins?: number | string;
  preferredGenres?: string;
  referredBy?: string;
  referralCount?: number;
  isReferralRewardClaimed?: boolean;
  signupTimestamp?: number | string;
  created_at?: string;
  followers?: number;
  following?: number;
  payment_method?: string;
  payment_account_info?: string;
  bank_name?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (data: any) => Promise<User>;
  signup: (data: any) => Promise<any>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUser: (data: any) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const response = await http.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();

    const handleUnauthorized = () => setUser(null);
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [checkAuth]);

  const login = async (data: any) => {
    await http.get('/sanctum/csrf-cookie', { baseURL: '' });
    const response = await http.post('/auth/login', data);
    if (response.data.token) {
      localStorage.setItem('auth_token', response.data.token);
    }
    setUser(response.data.user);
    return response.data.user;
  };

  const signup = async (data: any) => {
    const response = await http.post('/auth/signup', data);
    if (response.data.token) {
      localStorage.setItem('auth_token', response.data.token);
    }
    setUser(response.data.user);
    return response.data;
  };

  const logout = async () => {
    try {
      await http.post('/auth/logout');
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('auth_token');
      setUser(null);
    }
  };

  const updateUser = (data: any) => {
    setUser((prev: any) => ({ ...prev, ...data }));
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, checkAuth, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
