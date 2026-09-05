import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink, LoaderCircle, Save, XCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import http from '../../api/http';
import type { PaymentMethodSetting, PlanPurchase, PlanPurchaseStatus } from '../../types/earnings';
import { ActionDialog } from '../../components/feedback/ActionDialog';
import { useFeedback } from '../../components/feedback/feedback';
import { getApiErrorMessage } from '../../utils/apiError';

interface AdminPurchase extends PlanPurchase {
  proof_url: string;
  user: { username: string; email: string; plan: string };
  reviewer?: { username: string };
}

export function PlanPaymentManagement() {
  const queryClient = useQueryClient();
  const feedback = useFeedback();
  const [status, setStatus] = useState<Extract<PlanPurchaseStatus, 'pending_review' | 'approved' | 'rejected'>>('pending_review');
  const [purchaseToReject, setPurchaseToReject] = useState<AdminPurchase | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [openingProofId, setOpeningProofId] = useState<string | null>(null);
  const purchasesQuery = useQuery<{ data: AdminPurchase[] }>({
    queryKey: ['admin', 'plan-purchases', status],
    queryFn: async () => (await http.get('/admin/plan-purchases', { params: { status } })).data,
  });
  const methodsQuery = useQuery<PaymentMethodSetting[]>({
    queryKey: ['admin', 'payment-methods'],
    queryFn: async () => (await http.get('/admin/payment-methods')).data.data,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, action, reason }: { id: string; action: 'approve' | 'reject'; reason?: string }) =>
      (await http.post(`/admin/plan-purchases/${id}/${action}`, reason ? { reason } : {})).data,
    onSuccess: async (_data, variables) => {
      setPurchaseToReject(null);
      setRejectionReason('');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'plan-purchases'] });
      feedback.success(variables.action === 'approve' ? 'Plan payment approved.' : 'Plan payment rejected.');
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'The plan payment could not be reviewed.')),
  });
  const saveMethod = useMutation({
    mutationFn: async (method: PaymentMethodSetting) => (await http.put(`/admin/payment-methods/${method.id}`, method)).data,
    onSuccess: async (_data, method) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'payment-methods'] }),
        queryClient.invalidateQueries({ queryKey: ['payment-methods'] }),
      ]);
      feedback.success(`${method.label} payment destination saved.`);
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'The payment destination could not be saved.')),
  });

  const openProof = async (purchase: AdminPurchase) => {
    if (openingProofId) return;
    setOpeningProofId(purchase.id);
    try {
      const response = await http.get(purchase.proof_url.replace('/api/v1', ''), { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      feedback.error(getApiErrorMessage(error, 'The payment proof could not be opened.'));
    } finally {
      setOpeningProofId(null);
    }
  };

  const reject = (purchase: AdminPurchase) => {
    setPurchaseToReject(purchase);
    setRejectionReason('');
  };

  return (
    <div className="space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8">
      <div><h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">Plan payments</h1><p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">Review private payment proofs and configure wallet destinations.</p></div>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="flex overflow-x-auto gap-2 border-b border-slate-200 dark:border-slate-800 p-3 sm:p-4">
          {(['pending_review', 'approved', 'rejected'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={status === option}
              onClick={() => setStatus(option)}
              className={`rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold capitalize whitespace-nowrap cursor-pointer transition-colors ${
                status === option
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {option.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-left text-xs uppercase text-slate-500 dark:text-slate-400"><tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Plan / amount</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Submitted</th><th className="px-4 py-3">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-900 dark:text-slate-100">
              {(purchasesQuery.data?.data ?? []).map((purchase) => (
                <tr key={purchase.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-4"><p className="font-semibold">{purchase.user.username}</p><p className="text-xs text-slate-500 dark:text-slate-400">{purchase.user.email}</p></td>
                  <td className="px-4 py-4"><p className="font-medium capitalize">{purchase.plan_type.replaceAll('_', ' ')}</p><p className="text-slate-500 dark:text-slate-400">₱{Number(purchase.amount).toFixed(2)}</p></td>
                  <td className="px-4 py-4"><p className="font-medium uppercase">{purchase.payment_method}</p>{purchase.payment_reference ? <p className="break-all text-slate-500 dark:text-slate-400">Ref: {purchase.payment_reference}</p> : <p className="text-xs text-slate-400 dark:text-slate-500">No ref provided</p>}</td>
                  <td className="px-4 py-4 text-slate-500 dark:text-slate-400">{new Date(purchase.submitted_at).toLocaleString()}</td>
                  <td className="px-4 py-4"><div className="flex flex-wrap gap-2"><button type="button" disabled={openingProofId !== null} aria-busy={openingProofId === purchase.id} onClick={() => void openProof(purchase)} className="inline-flex items-center gap-1 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer">{openingProofId === purchase.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}{openingProofId === purchase.id ? 'Opening...' : 'Proof'}</button>{status === 'pending_review' && <><button type="button" disabled={reviewMutation.isPending} aria-busy={reviewMutation.isPending && reviewMutation.variables?.id === purchase.id && reviewMutation.variables.action === 'approve'} onClick={() => reviewMutation.mutate({ id: purchase.id, action: 'approve' })} className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer">{reviewMutation.isPending && reviewMutation.variables?.id === purchase.id && reviewMutation.variables.action === 'approve' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Approve</button><button type="button" disabled={reviewMutation.isPending} onClick={() => reject(purchase)} className="inline-flex items-center gap-1 rounded bg-red-600 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"><XCircle className="h-4 w-4" />Reject</button></>}</div>{purchase.rejection_reason && <p className="mt-2 max-w-xs text-xs text-red-700 dark:text-red-400">{purchase.rejection_reason}</p>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {purchasesQuery.isLoading && <p className="p-8 text-center text-slate-500 dark:text-slate-400">Loading payments...</p>}
          {purchasesQuery.isError && (
            <p role="alert" className="p-8 text-center text-red-600 dark:text-red-400">Payments could not be loaded.</p>
          )}
          {!purchasesQuery.isLoading && !purchasesQuery.isError && !(purchasesQuery.data?.data.length) && (
            <p className="p-8 text-center text-slate-500 dark:text-slate-400">No {status.replace('_', ' ')} payments.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm text-slate-900 dark:text-slate-100">
        <h2 className="text-lg font-bold">Payment destinations</h2>
        <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">Changes are shown immediately in the user's payment form.</p>
        <div className="grid gap-4 lg:grid-cols-3">
          {(methodsQuery.data ?? []).map((method) => (
            <PaymentMethodForm
              key={method.id}
              method={method}
              isSaving={saveMethod.isPending && saveMethod.variables?.id === method.id}
              onSave={(value) => saveMethod.mutate(value)}
            />
          ))}
          {methodsQuery.isError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">Payment destinations could not be loaded.</p>
          )}
        </div>
      </section>

      <ActionDialog
        open={Boolean(purchaseToReject)}
        title="Reject plan payment?"
        description={`Provide a reason for rejecting ${purchaseToReject?.user.username ?? 'this user'}'s payment.`}
        confirmLabel="Reject payment"
        pendingLabel="Rejecting..."
        tone="danger"
        isPending={reviewMutation.isPending}
        input={{
          label: 'Reason',
          value: rejectionReason,
          onChange: setRejectionReason,
          placeholder: 'Explain why the payment was rejected',
          required: true,
          maxLength: 1000,
        }}
        onCancel={() => {
          if (!reviewMutation.isPending) {
            setPurchaseToReject(null);
            setRejectionReason('');
          }
        }}
        onConfirm={() => {
          if (purchaseToReject && rejectionReason.trim()) {
            reviewMutation.mutate({ id: purchaseToReject.id, action: 'reject', reason: rejectionReason.trim() });
          }
        }}
      />
    </div>
  );
}

function PaymentMethodForm({
  method,
  isSaving,
  onSave,
}: {
  method: PaymentMethodSetting;
  isSaving: boolean;
  onSave: (method: PaymentMethodSetting) => void;
}) {
  const [form, setForm] = useState(method);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 p-4 text-slate-900 dark:text-slate-100">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">{form.label}</h3>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            disabled={isSaving}
            checked={form.is_active}
            onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
          />
          Active
        </label>
      </div>
      <input
        required
        disabled={isSaving}
        value={form.account_name}
        onChange={(event) => setForm({ ...form, account_name: event.target.value })}
        className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 p-2 disabled:opacity-60"
        aria-label={`${form.label} account name`}
        placeholder="Account name"
      />
      <input
        required
        disabled={isSaving}
        value={form.account_identifier}
        onChange={(event) => setForm({ ...form, account_identifier: event.target.value })}
        className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 p-2 disabled:opacity-60"
        aria-label={`${form.label} destination`}
        placeholder="Mobile number or email"
      />
      <textarea
        disabled={isSaving}
        value={form.instructions ?? ''}
        onChange={(event) => setForm({ ...form, instructions: event.target.value })}
        className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 p-2 disabled:opacity-60"
        aria-label={`${form.label} instructions`}
        placeholder="Instructions"
        rows={3}
      />
      <button
        disabled={isSaving}
        aria-busy={isSaving}
        className="inline-flex items-center gap-2 rounded bg-slate-900 hover:bg-slate-800 dark:bg-primary dark:hover:bg-primary-hover px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
      >
        {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {isSaving ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}
