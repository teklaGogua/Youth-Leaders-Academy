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
import {
  AuthRevisionGate,
  isInvalidAuthSessionError,
  resolveAuthSnapshot,
} from './auth.lifecycle';

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

  const applySession = useCallback(async (session: Session | null, isCurrent: () => boolean) => {
    if (!isCurrent()) return;

    setUser(session?.user ?? null);
    setRole(null);
    setProfileError(false);
    setLoading(Boolean(session));

    if (!session || !supabase) {
      setLoading(false);
      return;
    }

    const snapshot = await resolveAuthSnapshot(session, {
      getUser: (accessToken) => supabase.auth.getUser(accessToken),
      loadProfile: async (userId) => {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle();
        return { data, error };
      },
      clearLocalSession: () => supabase.auth.signOut({ scope: 'local' }),
    });

    if (!isCurrent()) return;
    setUser(snapshot.user);
    setRole(snapshot.role);
    setProfileError(snapshot.profileError);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const gate = new AuthRevisionGate();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const revision = gate.next();
      // Do not await Supabase APIs inside onAuthStateChange; the auth client holds a lock there.
      void Promise.resolve().then(() =>
        applySession(session, () => gate.isCurrent(revision)),
      );
    });

    const initialRevision = gate.next();
    void supabase.auth
      .getSession()
      .then(async ({ data: sessionData, error }) => {
        if (!gate.isCurrent(initialRevision)) return;
        if (error) {
          if (isInvalidAuthSessionError(error)) {
            await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
          }
          setUser(null);
          setRole(null);
          setProfileError(false);
          setLoading(false);
          return;
        }
        await applySession(sessionData.session, () => gate.isCurrent(initialRevision));
      })
      .catch(() => {
        if (!gate.isCurrent(initialRevision)) return;
        setUser(null);
        setRole(null);
        setProfileError(false);
        setLoading(false);
      });

    return () => {
      gate.dispose();
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
            emailRedirectTo: window.location.origin + '/auth/callback',
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
