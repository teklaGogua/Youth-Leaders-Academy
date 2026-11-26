import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { AppRole } from '../../lib/database.types';
import { useAuth } from './AuthProvider';

type ProtectedRouteProps = {
  children: ReactNode;
  requiredRole?: AppRole;
};

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, role, registrationComplete, loading, profileError, configured } = useAuth();
  const location = useLocation();
  if (!configured) return <p>სისტემა ჯერ არ არის დაკავშირებული Supabase პროექტთან.</p>;
  if (loading) return <p role="status">მონაცემები იტვირთება…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (profileError || !role) {
    return <p role="alert">მომხმარებლის პროფილის ჩატვირთვა ვერ მოხერხდა. სცადეთ მოგვიანებით.</p>;
  }
  if (requiredRole && role !== requiredRole) {
    return <Navigate to={role === 'administrator' ? '/admin' : '/dashboard'} replace />;
  }
  if (role === 'administrator')
    return requiredRole === 'participant' ? <Navigate to="/admin" replace /> : children;
  if (!registrationComplete)
    return <Navigate to="/register?step=2" replace state={{ resume: true }} />;
  if (requiredRole === 'administrator') return <Navigate to="/dashboard" replace />;
  return children;
}
