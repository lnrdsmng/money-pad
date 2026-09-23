import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import http from '../api/http';
import { formatCoins } from '../utils/money';
import { getApiErrorMessage } from '../utils/apiError';
import { useFeedback } from '../components/feedback/feedback';
import type { Offerwall } from '../types/offerwalls';
import { useAuth } from '../auth/AuthProvider';

export default function OfferwallDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const feedback = useFeedback();
  const { checkAuth } = useAuth();
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [proof, setProof] = useState<File | null>(null);
  const startQuery = useQuery<Offerwall>({
    queryKey: ['offerwall-start', id],
    queryFn: async () => {
      const result = (await http.post(`/offerwalls/${id}/start`)).data;
      void queryClient.invalidateQueries({ queryKey: ['offerwalls'] });
      return result;
    },
    enabled: !!id,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const { data: offerwall, isLoading, isError } = useQuery<Offerwall>({
    queryKey: ['offerwall', id],
    queryFn: async () => (await http.get(`/offerwalls/${id}`)).data,
    enabled: !!id && startQuery.isSuccess,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });
  const earnedCoins = offerwall?.earned_coins;
  useEffect(() => {
    if (earnedCoins !== undefined) void checkAuth();
  }, [earnedCoins, checkAuth]);
  const submit = useMutation({
    mutationFn: async () => {
      if (!proof || !selectedStage) throw new Error('Choose an image first.');
      const body = new FormData();
      body.append('proof', proof);
      await http.post(`/offerwalls/${id}/stages/${selectedStage}/proof`, body);
    },
    onSuccess: async () => {
      setProof(null);
      setSelectedStage(null);
      await queryClient.invalidateQueries({ queryKey: ['offerwall', id] });
      await queryClient.invalidateQueries({ queryKey: ['offerwalls'] });
      feedback.success('Proof submitted for review.');
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'Proof could not be submitted.')),
  });
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit.mutate();
  };

  if (startQuery.isPending || isLoading) return <p className="mx-auto max-w-3xl p-6">Loading offerwall...</p>;
  if (startQuery.isError || isError || !offerwall) return <p role="alert" className="mx-auto max-w-3xl p-6 text-red-600">Offerwall is unavailable.</p>;

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-3 py-6 sm:px-6">
      <div className="flex gap-4 rounded-xl bg-white p-4 dark:bg-slate-900">
        <img src={offerwall.image_url} alt="" className="aspect-square h-24 w-24 rounded-lg object-cover sm:h-32 sm:w-32" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{offerwall.name}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">{offerwall.description}</p>
          <p className="mt-2 text-sm font-semibold text-primary">{formatCoins(offerwall.total_coins)} total · {offerwall.completed_stages}/{offerwall.stage_count} stages</p>
        </div>
      </div>
      <section className="space-y-3" aria-label="Rewards">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Rewards</h2>
        {offerwall.stages?.map((stage) => (
          <div key={stage.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <button type="button" disabled={stage.status !== 'ready' && stage.status !== 'rejected'}
              onClick={() => { setSelectedStage(stage.id); setProof(null); }}
              className="flex w-full items-start justify-between gap-3 text-left disabled:cursor-default">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">{stage.position}. {stage.name}</h3>
                <p className="text-sm text-primary">{formatCoins(stage.reward_coins)}</p>
                <p className="text-xs capitalize text-gray-500 dark:text-gray-400">{stage.status === 'ready' ? 'Ready to submit' : stage.status}</p>
                {stage.rejection_reason && <p className="mt-1 text-xs text-red-600">Reason: {stage.rejection_reason}</p>}
              </div>
              {(stage.status === 'ready' || stage.status === 'rejected') && (
                <span className="rounded-lg bg-primary px-3 py-2 text-sm text-white">Upload proof</span>
              )}
            </button>
            {selectedStage === stage.id && (
              <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-center gap-2">
                <input type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => setProof(event.target.files?.[0] ?? null)} aria-label="Proof image" />
                <button disabled={!proof || submit.isPending} className="rounded-lg bg-primary px-3 py-2 text-sm text-white disabled:opacity-50">{submit.isPending ? 'Submitting...' : 'Submit proof'}</button>
              </form>
            )}
          </div>
        ))}
      </section>
      <div className="flex gap-3">
        <Link to="/offerwalls" className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium dark:text-white">Back</Link>
        <a href={offerwall.download_url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white">Play</a>
      </div>
    </main>
  );
}
