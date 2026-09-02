import { Outlet, NavLink } from 'react-router-dom';
import { Users, Banknote, MessageSquare, ShieldAlert, CreditCard } from 'lucide-react';

const AdminLayout = () => {
  const navItems = [
    { to: '/admin/withdrawals', label: 'Withdrawals', icon: Banknote },
    { to: '/admin/plan-payments', label: 'Plan Payments', icon: CreditCard },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/messages', label: 'Messaging', icon: MessageSquare },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen md:h-screen bg-gray-50">
      {/* Mobile Top Header + Navigation Bar */}
      <div className="md:hidden bg-white border-b border-gray-200">
        <div className="h-14 flex items-center px-4 border-b border-gray-100">
          <ShieldAlert className="h-5 w-5 text-accent mr-2" />
          <span className="text-base font-bold text-gray-900">Admin Panel</span>
        </div>
        <nav className="flex overflow-x-auto p-2 gap-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center px-3 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  isActive ? 'bg-primary text-white' : 'text-gray-700 bg-gray-50 hover:bg-gray-100'
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
      <div className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <ShieldAlert className="h-6 w-6 text-accent mr-2" />
          <span className="text-lg font-bold text-gray-900">Admin Panel</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                  isActive ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              <Icon className="h-5 w-5 mr-3 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
};

export default AdminLayout;
