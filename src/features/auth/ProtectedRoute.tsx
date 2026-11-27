import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { AppRole } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import { useAuth } from './AuthProvider';

type ProtectedRouteProps = {
  children: ReactNode;
  requiredRole?: AppRole;
};

type RegistrationAccess = {
  complete: boolean;
  error: boolean;
  path: string;
};

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, role, loading, profileError, configured } = useAuth();
  const location = useLocation();
  const [registration, setRegistration] = useState<RegistrationAccess | null>(null);

  useEffect(() => {
    let active = true;
    if (loading || !user || role !== 'participant' || requiredRole === 'administrator') {
      setRegistration(null);
      return () => {
        active = false;
      };
    }

    async function checkRegistration() {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('participant_registrations')
        .select('completed_at')
        .maybeSingle();
      if (!active) return;
      setRegistration({
        complete: Boolean(data?.completed_at),
        error: Boolean(error),
        path: location.pathname,
      });
    }

    void checkRegistration();
    return () => {
      active = false;
    };
  }, [loading, user?.id, role, requiredRole, location.pathname]);

  if (!configured) return <p>სისტემა ჯერ არ არის დაკავშირებული Supabase პროექტთან.</p>;
  if (loading) return <p role="status">მონაცემები იტვირთება…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (profileError || !role) {
    return <p role="alert">მომხმარებლის პროფილის ჩატვირთვა ვერ მოხერხდა. სცადეთ მოგვიანებით.</p>;
  }
  if (requiredRole && role !== requiredRole) return <Navigate to="/dashboard" replace />;
  if (!requiredRole && role === 'administrator') return <Navigate to="/admin" replace />;

  if (role === 'participant') {
    if (!registration || registration.path !== location.pathname)
      return <p role="status">რეგისტრაციის სტატუსი მოწმდება…</p>;
    if (registration.error)
      return <p role="alert">რეგისტრაციის სტატუსის შემოწმება ვერ მოხერხდა. სცადეთ მოგვიანებით.</p>;
    if (!registration.complete) return <Navigate to="/registration" replace />;
  }

  return children;
}
