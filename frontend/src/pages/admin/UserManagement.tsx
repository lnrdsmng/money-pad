import { useQuery } from '@tanstack/react-query';
import http from '../../api/http';
import { formatCoins, formatPesoFromCoins } from '../../utils/money';

const planBadge = (plan: string) => {
  if (plan === 'ultimate_premium') return 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300';
  if (plan === 'mega_premium') return 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300';
  if (plan === 'standard') return 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300';
  return 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-300';
};

export const UserManagement = () => {
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => (await http.get('/admin/users')).data,
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="mb-4 sm:mb-6 text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">User Management</h1>
      <div className="overflow-x-auto rounded-lg bg-white dark:bg-slate-900 shadow border border-gray-200 dark:border-slate-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
          <thead className="bg-gray-50 dark:bg-slate-800/80">
            <tr>
              {['Username', 'Email', 'Reader Coins', 'Author Income', 'Plan', 'Role'].map((heading) => (
                <th key={heading} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {isLoading ? (
              <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">Loading...</td></tr>
            ) : users?.map((user: any) => (
              <tr key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{user.username}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{user.email}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{formatCoins(user.readerCoins || 0)} <span className="block text-xs text-gray-400 dark:text-gray-500">{formatPesoFromCoins(user.readerCoins || 0)}</span></td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">₱{Number(user.authorIncome || 0).toFixed(2)}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <span className={`rounded px-2 py-1 text-xs capitalize ${planBadge(user.plan)}`}>
                    {user.plan.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm capitalize text-gray-500 dark:text-gray-400">{user.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
