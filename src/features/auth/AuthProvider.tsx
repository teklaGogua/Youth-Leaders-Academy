import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { AppRole } from '../../lib/database.types';
import { isSupabaseConfigured } from '../../lib/env';
import { supabase } from '../../lib/supabase';

type AuthContextValue = {
  user: User | null;
  role: AppRole | null;
  registrationComplete: boolean;
  loading: boolean;
  profileError: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  sendPasswordRecovery: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);

  const applySession = useCallback(async (session: Session | null, isActive: () => boolean) => {
    if (!isActive()) return;
    setUser(session?.user ?? null);
    setRole(null);
    setRegistrationComplete(false);
    setProfileError(false);
    if (!session?.user || !supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role,registration_completed_at')
        .eq('id', session.user.id)
        .maybeSingle();
      if (!isActive()) return;
      if (error || !data) {
        setProfileError(true);
      } else {
        setRole(data.role);
        setRegistrationComplete(
          data.role === 'administrator' || Boolean(data.registration_completed_at),
        );
      }
    } catch {
      if (isActive()) setProfileError(true);
    } finally {
      if (isActive()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    let revision = 0;
    const current = (value: number) => active && value === revision;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const version = ++revision;
      // Supabase auth callbacks must not await other Supabase calls; defer profile I/O.
      queueMicrotask(() => void applySession(session, () => current(version)));
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [applySession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      registrationComplete,
      loading,
      profileError,
      configured: isSupabaseConfigured,
      async signIn(email, password) {
        if (!supabase) throw new Error('სისტემასთან კავშირი ამჟამად მიუწვდომელია.');
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await applySession(data.session, () => true);
      },
      async signUp(email, password) {
        if (!supabase) throw new Error('სისტემასთან კავშირი ამჟამად მიუწვდომელია.');
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + '/auth/callback' },
        });
        if (error) throw error;
        if (data.session) await applySession(data.session, () => true);
        return !data.session;
      },
      async refreshProfile() {
        if (!supabase) return;
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        await applySession(data.session, () => true);
      },
      async signOut() {
        if (!supabase) return;
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) throw error;
        setUser(null);
        setRole(null);
        setRegistrationComplete(false);
      },
      async sendPasswordRecovery(email) {
        if (!supabase) throw new Error('სისტემასთან კავშირი ამჟამად მიუწვდომელია.');
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/reset-password',
        });
        if (error) throw error;
      },
      async updatePassword(password) {
        if (!supabase) throw new Error('სისტემასთან კავშირი ამჟამად მიუწვდომელია.');
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      },
    }),
    [user, role, registrationComplete, loading, profileError, applySession],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
