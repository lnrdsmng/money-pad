import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Crown, LoaderCircle, Shield, Sparkles, Upload, X, Zap } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import http from '../api/http';
import { useAuth } from '../auth/AuthProvider';
import type { MoneyPadPlan, PaymentMethodSetting, ReadingPlanId, PlanPurchase } from '../types/earnings';
import { formatPesoFromCoins } from '../utils/money';
import { useFeedback } from './feedback/feedback';

const planStyles: Record<ReadingPlanId, { icon: typeof Shield; buttonClass: string }> = {
  free: { icon: Shield, buttonClass: 'bg-slate-800' },
  standard: { icon: Sparkles, buttonClass: 'bg-emerald-600' },
  mega_premium: { icon: Zap, buttonClass: 'bg-blue-600' },
  ultimate_premium: { icon: Crown, buttonClass: 'bg-amber-600' },
};

export const UpgradePlanModal = ({ onClose }: { onClose: () => void }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const feedback = useFeedback();
  const [selectedPlan, setSelectedPlan] = useState<MoneyPadPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('gcash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentProof, setPaymentProof] = useState<File | null>(null);

  const plansQuery = useQuery<MoneyPadPlan[]>({
    queryKey: ['plans'],
    queryFn: async () => (await http.get('/plans')).data.data,
  });
  const methodsQuery = useQuery<PaymentMethodSetting[]>({
    queryKey: ['payment-methods'],
    queryFn: async () => (await http.get('/payment-methods')).data.data,
  });
  const purchasesQuery = useQuery<PlanPurchase[]>({
    queryKey: ['plan-purchases'],
    queryFn: async () => (await http.get('/plan-purchases')).data.data,
  });
  const pendingPurchase = purchasesQuery.data?.find((purchase) => purchase.status === 'pending_review');
  const latestRejected = purchasesQuery.data?.find((purchase) => purchase.status === 'rejected');
  const selectedPaymentMethod = paymentMethod && methodsQuery.data?.some((method) => method.id === paymentMethod)
    ? paymentMethod
    : methodsQuery.data?.[0]?.id ?? '';

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPlan || !paymentProof) throw new Error('Complete the payment form.');
      const form = new FormData();
      form.append('plan_type', selectedPlan.id);
      form.append('payment_method', selectedPaymentMethod);
      form.append('payment_reference', paymentReference);
      form.append('payment_proof', paymentProof);
      return (await http.post('/plan-purchases', form)).data;
    },
    onSuccess: async () => {
      setSelectedPlan(null);
      setPaymentReference('');
      setPaymentProof(null);
      await queryClient.invalidateQueries({ queryKey: ['plan-purchases'] });
      feedback.success('Payment proof submitted for admin review.');
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    submitMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="relative max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <button type="button" onClick={onClose} disabled={submitMutation.isPending} className="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Close plans"><X /></button>
        <div className="border-b border-slate-100 p-4 sm:p-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Choose your monthly plan</h2>
          <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-slate-500">Pay with GCash, Maya, or PayPal, then submit your proof for admin review.</p>
        </div>
        <div className="space-y-6 bg-slate-50 p-3.5 sm:p-8">
          {pendingPurchase && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 sm:p-4 text-xs sm:text-sm text-amber-900">
              Your {pendingPurchase.plan_type.replaceAll('_', ' ')} payment is waiting for admin review. You cannot submit another proof yet.
            </div>
          )}
          {!pendingPurchase && latestRejected?.rejection_reason && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 sm:p-4 text-xs sm:text-sm text-red-800">Latest payment was rejected: {latestRejected.rejection_reason}</div>
          )}
          <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {(plansQuery.data ?? []).map((plan) => {
              const Icon = planStyles[plan.id].icon;
              const isCurrent = user?.plan === plan.id;
              return (
                <article key={plan.id} className={`rounded-xl border-2 bg-white p-4 sm:p-6 shadow-sm ${isCurrent ? 'border-emerald-500' : selectedPlan?.id === plan.id ? 'border-blue-500' : 'border-transparent'}`}>
                  <Icon className="h-6 w-6 sm:h-8 sm:w-8 text-slate-700" />
                  <h3 className="mt-3 sm:mt-4 text-lg sm:text-xl font-bold">{plan.name}</h3>
                  <p className="mt-1.5 sm:mt-2 text-2xl sm:text-3xl font-extrabold">₱{Number(plan.price).toFixed(0)}</p>
                  <p className="text-xs text-slate-500">valid for one month</p>
                  <ul className="my-4 sm:my-5 space-y-2 text-xs sm:text-sm text-slate-600">
                    <li className="flex gap-2"><Check className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 shrink-0" />{Number(plan.rate_per_minute)} coins/min ({formatPesoFromCoins(plan.rate_per_minute)})</li>
                    <li className="flex gap-2"><Check className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 shrink-0" />{plan.ads ? 'Ad required when claiming' : 'No rewarded ad required'}</li>
                  </ul>
                  <button type="button" disabled={isCurrent || plan.id === 'free' || Boolean(pendingPurchase) || submitMutation.isPending} onClick={() => setSelectedPlan(plan)} className={`w-full rounded-lg py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white disabled:bg-slate-200 disabled:text-slate-500 ${planStyles[plan.id].buttonClass}`}>
                    {isCurrent ? 'Active plan' : plan.id === 'free' ? 'Included' : 'Select plan'}
                  </button>
                </article>
              );
            })}
          </div>

          {selectedPlan && !pendingPurchase && (
            <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4 sm:space-y-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
              <div><h3 className="text-xl font-bold">Pay ₱{Number(selectedPlan.price).toFixed(2)} for {selectedPlan.name}</h3><p className="text-sm text-slate-500">Your plan changes only after an administrator verifies the payment.</p></div>
              <div>
                <label className="mb-1 block text-sm font-semibold">Payment method</label>
                <select required disabled={submitMutation.isPending} value={selectedPaymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="w-full rounded-lg border border-slate-300 p-3 disabled:opacity-60">
                  {(methodsQuery.data ?? []).map((method) => <option key={method.id} value={method.id}>{method.label}</option>)}
                </select>
              </div>
              {methodsQuery.data?.filter((method) => method.id === selectedPaymentMethod).map((method) => (
                <div key={method.id} className="rounded-lg bg-blue-50 p-4 text-sm text-blue-950">
                  <p className="font-semibold">Send to {method.account_name}</p>
                  <p className="mt-1 break-all text-lg font-bold">{method.account_identifier}</p>
                  {method.instructions && <p className="mt-2">{method.instructions}</p>}
                </div>
              ))}
              <div><label className="mb-1 block text-sm font-semibold">Payment reference</label><input required disabled={submitMutation.isPending} maxLength={150} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} className="w-full rounded-lg border border-slate-300 p-3 disabled:opacity-60" placeholder="Transaction/reference number" /></div>
              <div><label className="mb-1 block text-sm font-semibold">Payment screenshot</label><label className={`flex items-center gap-3 rounded-lg border border-dashed border-slate-400 p-4 ${submitMutation.isPending ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}><Upload className="h-5 w-5" /><span>{paymentProof?.name ?? 'Choose JPEG, PNG, or WebP (max 5 MB)'}</span><input required disabled={submitMutation.isPending} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPaymentProof(event.target.files?.[0] ?? null)} className="sr-only" /></label></div>
              {submitMutation.isError && <p className="text-sm text-red-600">The proof could not be submitted. Check the file and reference, then try again.</p>}
              <button disabled={submitMutation.isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-bold text-white disabled:opacity-50">{submitMutation.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}Submit for review</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
