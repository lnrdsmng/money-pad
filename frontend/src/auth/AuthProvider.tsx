import { createContext, useCallback, useContext, useState, useEffect, useRef, useMemo, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
  payment_account_name?: string;
  payment_account_info?: string;
  bank_name?: string;
}

export interface LoginRequest { username: string; password: string }
export interface SignupRequest extends LoginRequest { email: string }
export interface AuthResponse { user: User; token?: string | null }

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<User>;
  signup: (data: SignupRequest) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  const generation = useRef(0);
  const userId = useRef<string | null>(null);

  const replaceUser = useCallback((next: User | null) => {
    if (userId.current !== (next?.id ?? null)) {
      void queryClient.cancelQueries();
      queryClient.clear();
    }
    userId.current = next?.id ?? null;
    setUser(next);
  }, [queryClient]);

  const checkAuth = useCallback(async () => {
    const current = generation.current;
    try {
      const response = await http.get<User>('/auth/me');
      if (current === generation.current) replaceUser(response.data);
    } catch {
      // A temporary network failure must not discard an established session.
      if (current === generation.current && !userId.current) replaceUser(null);
    } finally {
      if (current === generation.current) setIsLoading(false);
    }
  }, [replaceUser]);

  useEffect(() => {
    localStorage.removeItem('auth_token');
    void checkAuth();
    const handleUnauthorized = () => {
      generation.current++;
      replaceUser(null);
      setIsLoading(false);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [checkAuth, replaceUser]);

  const authenticate = useCallback(async (path: string, data: LoginRequest | SignupRequest) => {
    const current = ++generation.current;
    await http.get('/sanctum/csrf-cookie', { baseURL: '' });
    const response = await http.post<AuthResponse>(path, data);
    if (current === generation.current) replaceUser(response.data.user);
    return response.data;
  }, [replaceUser]);

  const login = useCallback(async (data: LoginRequest) => (await authenticate('/auth/login', data)).user, [authenticate]);
  const signup = useCallback((data: SignupRequest) => authenticate('/auth/signup', data), [authenticate]);
  const logout = useCallback(async () => {
    generation.current++;
    // Keep the user signed in if the server could not invalidate the session.
    await http.post('/auth/logout');
    replaceUser(null);
  }, [replaceUser]);

  const updateUser = useCallback((data: Partial<User>) => {
    setUser(previous => previous && (!data.id || data.id === previous.id) ? { ...previous, ...data } : previous);
  }, []);

  const value = useMemo(() => ({ user, isLoading, login, signup, logout, checkAuth, updateUser }),
    [user, isLoading, login, signup, logout, checkAuth, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
