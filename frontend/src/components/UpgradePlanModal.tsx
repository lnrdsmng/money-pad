import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Crown, LoaderCircle, Shield, Sparkles, X, Zap } from 'lucide-react';
import http from '../api/http';
import { useAuth } from '../auth/AuthProvider';
import type { MoneyPadPlan, PlanId } from '../types/earnings';

const planStyles: Record<PlanId, { icon: typeof Shield; iconClass: string; buttonClass: string }> = {
  free: { icon: Shield, iconClass: 'text-slate-500', buttonClass: 'bg-slate-800 hover:bg-slate-900' },
  standard: { icon: Sparkles, iconClass: 'text-emerald-600', buttonClass: 'bg-emerald-600 hover:bg-emerald-700' },
  mega_premium: { icon: Zap, iconClass: 'text-blue-600', buttonClass: 'bg-blue-600 hover:bg-blue-700' },
  ultimate_premium: { icon: Crown, iconClass: 'text-amber-600', buttonClass: 'bg-amber-600 hover:bg-amber-700' },
};

export const UpgradePlanModal = ({ onClose }: { onClose: () => void }) => {
  const { user } = useAuth();
  const plansQuery = useQuery<MoneyPadPlan[]>({
    queryKey: ['plans'],
    queryFn: async () => (await http.get('/plans')).data.data,
  });

  const checkoutMutation = useMutation<{ checkout_url: string }, Error, PlanId>({
    mutationFn: async (planType) => (await http.post('/plans/checkout', { plan_type: planType })).data,
    onSuccess: ({ checkout_url: checkoutUrl }) => window.location.assign(checkoutUrl),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="relative max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100" aria-label="Close plans">
          <X className="h-6 w-6" />
        </button>

        <div className="border-b border-slate-100 p-8 text-center">
          <h2 className="text-3xl font-bold text-slate-900">Choose your reading plan</h2>
          <p className="mt-2 text-slate-500">One-time pricing with a fixed peso rate for every completed minute.</p>
        </div>

        <div className="bg-slate-50 p-5 sm:p-8">
          {plansQuery.isLoading && <p className="py-12 text-center text-slate-500">Loading plans…</p>}
          {plansQuery.isError && <p className="py-12 text-center text-red-600">Plans could not be loaded.</p>}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {(plansQuery.data ?? []).map((plan) => {
              const style = planStyles[plan.id];
              const Icon = style.icon;
              const isCurrent = user?.plan === plan.id;

              return (
                <article key={plan.id} className={`rounded-xl border-2 bg-white p-6 shadow-sm ${isCurrent ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-transparent'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <Icon className={`h-8 w-8 ${style.iconClass}`} />
                    {isCurrent && <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold uppercase text-emerald-800">Current</span>}
                  </div>
                  <h3 className="mt-4 text-xl font-bold text-slate-900">{plan.name}</h3>
                  <p className="mt-2 text-3xl font-extrabold text-slate-900">₱{Number(plan.price).toFixed(0)}</p>
                  <p className="text-xs text-slate-500">one-time payment</p>

                  <ul className="my-6 space-y-3 text-sm text-slate-600">
                    <li className="flex gap-2"><Check className="h-5 w-5 shrink-0 text-emerald-600" />₱{Number(plan.rate_per_minute).toFixed(3)} per minute</li>
                    <li className="flex gap-2"><Check className="h-5 w-5 shrink-0 text-emerald-600" />{plan.multiplier}× value multiplier</li>
                    <li className="flex gap-2"><Check className="h-5 w-5 shrink-0 text-emerald-600" />{plan.ads ? 'Ad shown only when claiming' : 'No rewarded ad required'}</li>
                  </ul>

                  <button
                    type="button"
                    disabled={isCurrent || plan.id === 'free' || checkoutMutation.isPending}
                    onClick={() => checkoutMutation.mutate(plan.id)}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-lg py-3 font-bold text-white transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 ${style.buttonClass}`}
                  >
                    {checkoutMutation.isPending && checkoutMutation.variables === plan.id && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    {isCurrent ? 'Active plan' : plan.id === 'free' ? 'Included' : `Buy ${plan.name}`}
                  </button>
                </article>
              );
            })}
          </div>

          {checkoutMutation.isError && <p className="mt-5 text-center text-sm text-red-600">The secure checkout could not be created. Please try again.</p>}
          <p className="mt-6 text-center text-xs text-slate-500">
            Paid plans activate only after MoneyPad receives a verified successful-payment webhook from the payment provider.
          </p>
        </div>
      </div>
    </div>
  );
};
