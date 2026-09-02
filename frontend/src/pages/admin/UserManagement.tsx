import { useQuery } from '@tanstack/react-query';
import http from '../../api/http';

const planBadge = (plan: string) => {
  if (plan === 'ultimate_premium') return 'bg-amber-100 text-amber-800';
  if (plan === 'mega_premium') return 'bg-blue-100 text-blue-800';
  if (plan === 'standard') return 'bg-emerald-100 text-emerald-800';
  return 'bg-gray-100 text-gray-800';
};

export const UserManagement = () => {
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => (await http.get('/admin/users')).data,
  });

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">User Management</h1>
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Username', 'Email', 'Reader Coins', 'Author Income', 'Plan', 'Role'].map((heading) => (
                <th key={heading} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {isLoading ? (
              <tr><td colSpan={6} className="px-6 py-4 text-center">Loading...</td></tr>
            ) : users?.map((user: any) => (
              <tr key={user.id}>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">{user.username}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{user.email}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">₱{Number(user.readerCoins || 0).toFixed(3)}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">₱{Number(user.authorIncome || 0).toFixed(2)}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <span className={`rounded px-2 py-1 text-xs capitalize ${planBadge(user.plan)}`}>
                    {user.plan.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm capitalize text-gray-500">{user.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
