import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import { useAuth } from './auth/AuthProvider';
import { ProtectedRoute } from './auth/ProtectedRoute';
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const OnboardingPage = lazy(() => import('./pages/auth/OnboardingPage'));
const ExplorePage = lazy(() => import('./pages/ExplorePage'));
const StoryPage = lazy(() => import('./pages/StoryPage'));
const ReaderPage = lazy(() => import('./pages/ReaderPage'));
const WriterDashboard = lazy(() => import('./pages/writer/WriterDashboard'));
const EditorPage = lazy(() => import('./pages/writer/EditorPage'));
const StoryEditPage = lazy(() => import('./pages/writer/StoryEditPage'));
const StoryPartsPage = lazy(() => import('./pages/writer/StoryPartsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const EarningsDashboard = lazy(() => import('./pages/EarningsDashboard'));
const OfferwallsPage = lazy(() => import('./pages/OfferwallsPage'));
const OfferwallDetailPage = lazy(() => import('./pages/OfferwallDetailPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AuthorVerificationPage = lazy(() => import('./pages/writer/AuthorVerificationPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
import AdminRoute from './auth/AdminRoute';
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const WithdrawalManagement = lazy(() => import('./pages/admin/WithdrawalManagement').then(module => ({ default: module.WithdrawalManagement })));
const UserManagement = lazy(() => import('./pages/admin/UserManagement').then(module => ({ default: module.UserManagement })));
const MessagingPanel = lazy(() => import('./pages/admin/MessagingPanel').then(module => ({ default: module.MessagingPanel })));
const PlanPaymentManagement = lazy(() => import('./pages/admin/PlanPaymentManagement').then(module => ({ default: module.PlanPaymentManagement })));
const OfferwallManagement = lazy(() => import('./pages/admin/OfferwallManagement'));

const CommunityPage = lazy(() => import('./pages/CommunityPage'));

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
      <Suspense fallback={<div role="status" className="p-8 text-center">Loading...</div>}>
      <Routes>
        {/* Standalone Admin Interface completely decoupled from AppLayout */}
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="withdrawals" replace />} />
            <Route path="withdrawals" element={<WithdrawalManagement />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="messages" element={<MessagingPanel />} />
            <Route path="plan-payments" element={<PlanPaymentManagement />} />
            <Route path="offerwalls" element={<OfferwallManagement />} />
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
            <Route path="offerwalls" element={<OfferwallsPage />} />
            <Route path="offerwalls/:id" element={<OfferwallDetailPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="login" element={getAuthRedirect(<LoginPage />)} />
          <Route path="register" element={getAuthRedirect(<RegisterPage />)} />
          <Route path="forgot-password" element={getAuthRedirect(<ForgotPasswordPage />)} />
          <Route path="reset-password" element={getAuthRedirect(<ResetPasswordPage />)} />
          <Route path="onboarding" element={<OnboardingPage />} />
        </Route>
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

