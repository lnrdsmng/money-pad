import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import { useAuth } from './auth/AuthProvider';
import { ProtectedRoute } from './auth/ProtectedRoute';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import OnboardingPage from './pages/auth/OnboardingPage';
import ExplorePage from './pages/ExplorePage';
import StoryPage from './pages/StoryPage';
import ReaderPage from './pages/ReaderPage';
import WriterDashboard from './pages/writer/WriterDashboard';
import EditorPage from './pages/writer/EditorPage';
import StoryEditPage from './pages/writer/StoryEditPage';
import StoryPartsPage from './pages/writer/StoryPartsPage';
import ProfilePage from './pages/ProfilePage';
import EarningsDashboard from './pages/EarningsDashboard';
import SettingsPage from './pages/SettingsPage';
import AuthorVerificationPage from './pages/writer/AuthorVerificationPage';
import LandingPage from './pages/LandingPage';
import AdminRoute from './auth/AdminRoute';
import AdminLayout from './pages/admin/AdminLayout';
import { WithdrawalManagement } from './pages/admin/WithdrawalManagement';
import { UserManagement } from './pages/admin/UserManagement';
import { MessagingPanel } from './pages/admin/MessagingPanel';
import { PlanPaymentManagement } from './pages/admin/PlanPaymentManagement';

import CommunityPage from './pages/CommunityPage';

function ProfileRedirect() {
  const { user } = useAuth();
  return <Navigate to={`/profile/${user?.username}`} replace />;
}

export default function AppRouter() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  const getInitialRedirect = () => {
    if (!user) return <LandingPage />;
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    return <Navigate to={user.onboardingCompleted ? "/explore" : "/onboarding"} replace />;
  };

  const getAuthRedirect = (defaultElement: React.ReactElement) => {
    if (!user) return defaultElement;
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    return <Navigate to={user.onboardingCompleted ? "/explore" : "/onboarding"} replace />;
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Standalone Admin Interface completely decoupled from AppLayout */}
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="withdrawals" replace />} />
            <Route path="withdrawals" element={<WithdrawalManagement />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="messages" element={<MessagingPanel />} />
            <Route path="plan-payments" element={<PlanPaymentManagement />} />
          </Route>
        </Route>

        {/* User Web App Shell */}
        <Route path="/" element={<AppLayout />}>
          <Route index element={getInitialRedirect()} />
          
          <Route element={<ProtectedRoute />}>
            <Route path="explore" element={<ExplorePage />} />
            <Route path="community" element={<CommunityPage />} />
            <Route path="story/:storyId" element={<StoryPage />} />
            <Route path="story/:storyId/read/:partId" element={<ReaderPage />} />
            
            <Route path="writer" element={<WriterDashboard />} />
            <Route path="writer/verification" element={<AuthorVerificationPage />} />
            <Route path="writer/story/:storyId" element={<StoryEditPage />} />
            <Route path="writer/story/:storyId/parts" element={<StoryPartsPage />} />
            <Route path="writer/story/:storyId/read/:partId/edit" element={<EditorPage />} />
            
            <Route path="profile" element={<ProfileRedirect />} />
            <Route path="profile/:username" element={<ProfilePage />} />
            <Route path="earnings" element={<EarningsDashboard />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="login" element={getAuthRedirect(<LoginPage />)} />
          <Route path="register" element={getAuthRedirect(<RegisterPage />)} />
          <Route path="onboarding" element={<OnboardingPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

