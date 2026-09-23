import { Outlet, NavLink, Link } from 'react-router-dom';
import { Users, Banknote, MessageSquare, ShieldAlert, CreditCard, ArrowLeft, LayoutGrid } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';

const AdminLayout = () => {
  const { user, logout } = useAuth();

  const navItems = [
    { to: '/admin/withdrawals', label: 'Withdrawals', icon: Banknote },
    { to: '/admin/plan-payments', label: 'Plan Payments', icon: CreditCard },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/messages', label: 'Messaging', icon: MessageSquare },
    { to: '/admin/offerwalls', label: 'Offerwalls', icon: LayoutGrid },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F6] dark:bg-slate-950 md:fixed md:inset-0 md:min-h-0 md:flex-row md:overflow-hidden">
      {/* Mobile Top Header + Navigation Bar */}
      <div className="md:hidden bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center">
            <ShieldAlert className="h-5 w-5 text-accent mr-2" />
            <span className="text-base font-bold text-gray-900 dark:text-gray-100">Admin Control</span>
          </div>
          <Link
            to="/explore"
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            App
          </Link>
        </div>
        <nav className="flex overflow-x-auto p-2 gap-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center px-3 py-2 text-xs font-medium rounded-xl whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700'
                }`
              }
            >
              <Icon className="h-4 w-4 mr-1.5 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden w-64 flex-col border-r border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:flex md:h-full md:min-h-0">
        <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-slate-800 justify-between">
          <div className="flex items-center">
            <ShieldAlert className="h-6 w-6 text-accent mr-2" />
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Admin Panel</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                  isActive
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <Icon className="h-5 w-5 mr-3 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer with Link back to user app and user info */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-800 space-y-2">
          <Link
            to="/explore"
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-semibold text-primary border border-primary/30 hover:bg-primary/10 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to User App
          </Link>
          {user && (
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-1">
              <span className="truncate">{user.username}</span>
              <button
                type="button"
                onClick={logout}
                className="text-red-600 dark:text-red-400 hover:underline cursor-pointer font-medium"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <main className="min-w-0 flex-1 bg-[#FAF9F6] dark:bg-slate-950 md:h-full md:min-h-0 md:overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
