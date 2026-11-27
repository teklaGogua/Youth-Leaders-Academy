import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { AppRole } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import { useAuth } from './AuthProvider';
import { getNextRegistrationStep } from '../registration/registration.progress';

type ProtectedRouteProps = {
  children: ReactNode;
  requiredRole?: AppRole;
  allowIncomplete?: boolean;
};

type RegistrationAccess = {
  complete: boolean;
  nextStep: number;
  error: boolean;
  path: string;
};

export default function ProtectedRoute({
  children,
  requiredRole,
  allowIncomplete = false,
}: ProtectedRouteProps) {
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
        .select(
          'step_1_completed_at,step_2_completed_at,step_3_completed_at,guardian_verified_at,guardian_verified_email,guardian_email,completed_at',
        )
        .maybeSingle();
      if (!active) return;
      if (error) {
        setRegistration({ complete: false, nextStep: 1, error: true, path: location.pathname });
        return;
      }
      const nextStep = getNextRegistrationStep(data);
      setRegistration({
        complete: Boolean(data?.completed_at),
        nextStep,
        error: false,
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
    if (allowIncomplete) {
      if (registration.complete) return <Navigate to="/dashboard" replace />;
      const requestedStep = Number(location.pathname.split('/').at(-1));
      if (requestedStep > registration.nextStep) {
        return <Navigate to={'/registration/' + registration.nextStep} replace />;
      }
    } else if (!registration.complete) {
      return <Navigate to={'/registration/' + registration.nextStep} replace />;
    }
  }
  return children;
}
