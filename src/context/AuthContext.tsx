// ============================================================
// Auth Context — manages user session
// Uses Supabase if configured, falls back to local auth
// ============================================================

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { generateId } from '@/lib/db';

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  isRecoverySession: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const LOCAL_USERS_KEY = 'alh_local_users';
const LOCAL_SESSION_KEY = 'alh_local_session';
const allowLocalAuth = import.meta.env.VITE_ALLOW_LOCAL_AUTH === 'true';
const DEFAULT_PRODUCTION_URL = 'https://ai-lead-hunter-zeta.vercel.app/';

function getAuthRedirectUrl(): string {
  const configuredUrl = (import.meta.env.VITE_APP_URL as string | undefined)?.trim();
  if (configuredUrl) return configuredUrl.endsWith('/') ? configuredUrl : `${configuredUrl}/`;
  if (typeof window === 'undefined') return DEFAULT_PRODUCTION_URL;
  const origin = window.location.origin;
  return origin.includes('localhost') || origin.includes('127.0.0.1')
    ? DEFAULT_PRODUCTION_URL
    : `${origin}/`;
}

interface LocalUser {
  id: string;
  email: string;
  passwordHash: string;
  full_name: string;
}

function getLocalUsers(): LocalUser[] {
  if (!allowLocalAuth) return [];
  try { return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) ?? '[]'); } catch { return []; }
}
function saveLocalUsers(users: LocalUser[]) {
  if (allowLocalAuth) localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}
async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecoverySession, setIsRecoverySession] = useState(false);

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email ?? '',
            full_name: session.user.user_metadata?.full_name,
          });
        }
        setLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') setIsRecoverySession(true);
        (async () => {
          if (session?.user) {
            setUser({
              id: session.user.id,
              email: session.user.email ?? '',
              full_name: session.user.user_metadata?.full_name,
            });
          } else {
            setUser(null);
          }
        })();
      });

      return () => subscription.unsubscribe();
    } else if (allowLocalAuth) {
      const session = localStorage.getItem(LOCAL_SESSION_KEY);
      if (session) {
        try { setUser(JSON.parse(session)); }
        catch { localStorage.removeItem(LOCAL_SESSION_KEY); }
      }
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message };
    }

    if (!allowLocalAuth) return { error: 'Supabase غير مُهيأ. لا يمكن تسجيل الدخول محليًا في وضع الإنتاج.' };
    const users = getLocalUsers();
    const passwordHash = await hashPassword(password);
    const found = users.find((u) => u.email === email && u.passwordHash === passwordHash);
    if (!found) return { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
    const session: AuthUser = { id: found.id, email: found.email, full_name: found.full_name };
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
    setUser(session);
    return {};
  };

  const signUp = async (email: string, password: string, fullName: string): Promise<{ error?: string }> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
        data: { full_name: fullName },
        emailRedirectTo: getAuthRedirectUrl(),
      },
      });
      return { error: error?.message };
    }

    if (!allowLocalAuth) return { error: 'Supabase غير مُهيأ. لا يمكن إنشاء حساب محليًا في وضع الإنتاج.' };
    const users = getLocalUsers();
    if (users.some((u) => u.email === email)) return { error: 'هذا البريد الإلكتروني مسجل بالفعل' };
    const newUser: LocalUser = { id: generateId(), email, passwordHash: await hashPassword(password), full_name: fullName };
    users.push(newUser);
    saveLocalUsers(users);
    const session: AuthUser = { id: newUser.id, email, full_name: fullName };
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
    setUser(session);
    return {};
  };

  const resetPassword = async (email: string): Promise<{ error?: string }> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRedirectUrl(),
      });
      return { error: error?.message };
    }
    return { error: 'استعادة كلمة المرور متاحة بعد ربط Supabase بالمشروع' };
  };

  const updatePassword = async (password: string): Promise<{ error?: string }> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.updateUser({ password });
      if (!error) setIsRecoverySession(false);
      return { error: error?.message };
    }
    return { error: 'تغيير كلمة المرور متاح بعد ربط Supabase بالمشروع' };
  };

  const signOut = async (): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem(LOCAL_SESSION_KEY);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, resetPassword, updatePassword, isRecoverySession, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
