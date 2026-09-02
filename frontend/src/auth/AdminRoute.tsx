import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';

const AdminRoute = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  // user role must be admin
  if (!user || user.role !== 'admin') {
    return <Navigate to="/explore" replace />;
  }

  return <Outlet />;
};

export default AdminRoute;
