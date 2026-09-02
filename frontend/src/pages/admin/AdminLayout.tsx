import { Outlet, NavLink } from 'react-router-dom';
import { Users, Banknote, MessageSquare, ShieldAlert, CreditCard } from 'lucide-react';

const AdminLayout = () => {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <ShieldAlert className="h-6 w-6 text-accent mr-2" />
          <span className="text-lg font-bold text-gray-900">Admin Panel</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavLink
            to="/admin/withdrawals"
            className={({ isActive }) =>
              `flex items-center px-4 py-3 text-sm font-medium rounded-md ${
                isActive ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'
              }`
            }
          >
            <Banknote className="h-5 w-5 mr-3" />
            Withdrawals
          </NavLink>
          
          <NavLink
            to="/admin/plan-payments"
            className={({ isActive }) =>
              `flex items-center px-4 py-3 text-sm font-medium rounded-md ${
                isActive ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'
              }`
            }
          >
            <CreditCard className="h-5 w-5 mr-3" />
            Plan Payments
          </NavLink>

          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              `flex items-center px-4 py-3 text-sm font-medium rounded-md ${
                isActive ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'
              }`
            }
          >
            <Users className="h-5 w-5 mr-3" />
            Users
          </NavLink>

          <NavLink
            to="/admin/messages"
            className={({ isActive }) =>
              `flex items-center px-4 py-3 text-sm font-medium rounded-md ${
                isActive ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'
              }`
            }
          >
            <MessageSquare className="h-5 w-5 mr-3" />
            Messaging
          </NavLink>
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
