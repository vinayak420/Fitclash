import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import AppShell from './components/AppShell';
import ProfilePage from './pages/ProfilePage';
import CreateCommunityPage from './pages/CreateCommunityPage';
import CommunitiesPage from './pages/CommunitiesPage';
import CommunityDetailPage from './pages/CommunityDetailPage';
import JoinCommunityPage from './pages/JoinCommunityPage';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <div className="fc-text-dim text-sm">Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/profile" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={(
                <RedirectIfAuthed>
                  <LoginPage />
                </RedirectIfAuthed>
              )}
            />
            <Route
              path="/signup"
              element={(
                <RedirectIfAuthed>
                  <SignupPage />
                </RedirectIfAuthed>
              )}
            />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route
              element={(
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              )}
            >
              <Route path="/" element={<Navigate to="/profile" replace />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/create" element={<CreateCommunityPage />} />
              <Route path="/communities" element={<CommunitiesPage />} />
              <Route path="/communities/:id" element={<CommunityDetailPage />} />
              <Route path="/join" element={<JoinCommunityPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/profile" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
