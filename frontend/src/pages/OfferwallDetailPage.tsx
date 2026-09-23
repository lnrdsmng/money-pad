import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ImagePlus, X } from 'lucide-react';
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
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  useEffect(() => () => {
    if (proofPreview) URL.revokeObjectURL(proofPreview);
  }, [proofPreview]);
  const clearProof = () => {
    setProof(null);
    setProofPreview(null);
  };
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
      clearProof();
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
  const selectProof = (file: File | null) => {
    if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      clearProof();
      feedback.error('Choose a JPEG, PNG, or WebP image up to 5 MB.');
      return;
    }
    setProof(file);
    setProofPreview(file ? URL.createObjectURL(file) : null);
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
              onClick={() => { setSelectedStage(stage.id); clearProof(); }}
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
              <form onSubmit={onSubmit} className="mt-4 space-y-3 border-t border-gray-200 pt-4 dark:border-slate-700">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary dark:hover:bg-primary/20">
                    <ImagePlus aria-hidden="true" className="h-4 w-4" />
                    {proof ? 'Replace proof image' : 'Choose proof image'}
                    <input type="file" accept="image/jpeg,image/png,image/webp" required={!proof} disabled={submit.isPending} aria-label="Proof image" className="sr-only"
                      onChange={(event) => {
                        selectProof(event.target.files?.[0] ?? null);
                        event.target.value = '';
                      }} />
                  </label>
                  {proof && <span className="max-w-full truncate text-sm text-gray-700 dark:text-gray-200">{proof.name}</span>}
                  {proof && <button type="button" disabled={submit.isPending} onClick={clearProof} className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"><X aria-hidden="true" className="h-4 w-4" /> Remove</button>}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">JPEG, PNG, or WebP, up to 5 MB.</p>
                {proofPreview && <img src={proofPreview} alt="Selected proof preview" className="max-h-64 max-w-full rounded-lg border border-gray-200 object-contain dark:border-slate-700" />}
                <button disabled={!proof || submit.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{submit.isPending ? 'Submitting...' : 'Submit proof'}</button>
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
