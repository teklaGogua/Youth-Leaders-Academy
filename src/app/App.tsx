import '../styles/global.scss';
import { Route, Routes } from 'react-router-dom';
import PublicLayout from '../components/layout/PublicLayout';
import { AboutPage, CompetitionPage, FAQPage } from '../pages/PublicPages';
import AuthLayout from '../features/auth/AuthLayout';
import {
  AdminPage,
  AuthCallbackPage,
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
} from '../features/auth/AuthPages';
import ProtectedRoute from '../features/auth/ProtectedRoute';
import {
  ParticipantOnboardingPage,
  ParticipantDashboardPage,
  RegistrationConfirmationPage,
} from '../features/participant/ParticipantPages';
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
      </Route>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
      </Route>
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <ParticipantOnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/edit"
        element={
          <ProtectedRoute>
            <ParticipantOnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/registration/confirmation"
        element={
          <ProtectedRoute>
            <RegistrationConfirmationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <ParticipantDashboardPage />
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
