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
  loading: boolean;
  profileError: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  sendPasswordRecovery: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);

  const applySession = useCallback(async (session: Session | null, isActive: () => boolean) => {
    if (!isActive()) return;

    setUser(session?.user ?? null);
    setRole(null);
    setProfileError(false);

    if (!session?.user || !supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!isActive()) return;

      if (error || !data) {
        setProfileError(true);
        setRole(null);
      } else {
        setRole(data.role);
      }
      setLoading(false);
    } catch {
      if (!isActive()) return;
      setProfileError(true);
      setRole(null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;
    let revision = 0;
    const isCurrent = (value: number) => active && value === revision;

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentRevision = ++revision;
      void Promise.resolve().then(() => applySession(session, () => isCurrent(currentRevision)));
    });

    const initialRevision = ++revision;
    void supabase.auth
      .getSession()
      .then(({ data: sessionData, error }) => {
        if (!isCurrent(initialRevision)) return;
        if (error) {
          setProfileError(true);
          setLoading(false);
          return;
        }
        void applySession(sessionData.session, () => isCurrent(initialRevision));
      })
      .catch(() => {
        if (!isCurrent(initialRevision)) return;
        setProfileError(true);
        setLoading(false);
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
      loading,
      profileError,
      configured: isSupabaseConfigured,
      async signIn(email, password) {
        if (!supabase) throw new Error('სისტემასთან კავშირი ამჟამად მიუწვდომელია.');
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      async signUp(fullName, email, password) {
        if (!supabase) throw new Error('სისტემასთან კავშირი ამჟამად მიუწვდომელია.');
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin + '/auth/callback?next=%2Fregistration',
          },
        });
        if (error) throw error;
        return !data.session;
      },
      async signOut() {
        if (!supabase) return;
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
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
    [user, role, loading, profileError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
