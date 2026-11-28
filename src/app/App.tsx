import '../styles/global.scss';
import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from '../components/layout/PublicLayout';
import { AboutPage, CompetitionPage, FAQPage, TemporaryPage } from '../pages/PublicPages';
import AuthLayout from '../features/auth/AuthLayout';
import {
  AdminPage,
  AuthCallbackPage,
  ForgotPasswordPage,
  LoginPage,
  ResetPasswordPage,
} from '../features/auth/AuthPages';
import ProtectedRoute from '../features/auth/ProtectedRoute';
import DashboardPage from '../features/registration/DashboardPage';
import {
  GuardianVerificationPage,
  RegistrationPage,
} from '../features/registration/RegistrationPage';
import HomePage from './HomePage';
import NotFoundPage from './NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/competition" element={<CompetitionPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/apply" element={<TemporaryPage title="განაცხადის შევსება" />} />
      </Route>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<Navigate to="/registration" replace />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
      </Route>
      <Route path="/guardian-verification" element={<GuardianVerificationPage />} />
      <Route path="/registration" element={<RegistrationPage />} />
      <Route
        path="/profile"
        element={
          <ProtectedRoute allowIncompleteRegistration>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="administrator">
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
