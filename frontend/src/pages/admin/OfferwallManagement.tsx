import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, ImageOff, LoaderCircle } from 'lucide-react';
import http from '../../api/http';
import { getApiErrorMessage } from '../../utils/apiError';
import { useFeedback } from '../../components/feedback/feedback';
import { formatCoins } from '../../utils/money';
import { LoadMoreButton } from '../../components/common/LoadMoreButton';

interface AdminOfferwall {
  id: string;
  name: string;
  description: string;
  image_url: string;
  archived_at: string | null;
  stages: { id: string; name: string; reward_coins: string }[];
}

interface Submission {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  proof_url: string;
  rejection_reason: string | null;
  created_at: string;
  user: { username: string; email: string };
  stage: { name: string; position: number; offerwall: { name: string; image_url: string } };
}

function OfferwallThumbnail({ imageUrl }: { imageUrl: string }) {
  const [failed, setFailed] = useState(false);
  if (!imageUrl || failed) {
    return <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400 dark:bg-slate-800 sm:h-20 sm:w-20"><ImageOff aria-hidden="true" className="h-6 w-6" /></div>;
  }
  return <img src={imageUrl} alt="" onError={() => setFailed(true)} className="h-16 w-16 shrink-0 rounded-lg bg-gray-100 object-cover sm:h-20 sm:w-20" />;
}

function ProofPreview({ submission }: { submission: Submission }) {
  const feedback = useFeedback();
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => () => {
    if (proofUrl) URL.revokeObjectURL(proofUrl);
  }, [proofUrl]);

  const toggleProof = async () => {
    if (proofUrl) {
      setProofUrl(null);
      return;
    }
    setIsLoading(true);
    try {
      const response = await http.get<Blob>(submission.proof_url.replace(/^\/api\/v1/, ''), { responseType: 'blob' });
      setProofUrl(URL.createObjectURL(response.data));
    } catch (error) {
      feedback.error(getApiErrorMessage(error, 'The uploaded proof could not be opened.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <button type="button" disabled={isLoading} aria-expanded={Boolean(proofUrl)} onClick={() => void toggleProof()}
        className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 dark:hover:bg-primary/20">
        {isLoading ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
        {isLoading ? 'Opening proof...' : proofUrl ? 'Hide uploaded proof' : 'View uploaded proof'}
      </button>
      {proofUrl && <img src={proofUrl} alt={`Proof uploaded by ${submission.user.username} for ${submission.stage.name}`}
        className="max-h-[32rem] max-w-full rounded-lg border border-gray-200 object-contain dark:border-slate-700" />}
    </div>
  );
}

export default function OfferwallManagement() {
  const feedback = useFeedback();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageKey, setImageKey] = useState(0);
  const [stages, setStages] = useState([{ name: '', reward: '' }]);
  const [reviewFilter, setReviewFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const offersQuery = useInfiniteQuery<{ data: AdminOfferwall[]; current_page: number; last_page: number }>({
    queryKey: ['admin', 'offerwalls'],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => (await http.get('/admin/offerwalls', { params: { page: pageParam } })).data,
    getNextPageParam: (page) => page.current_page < page.last_page ? page.current_page + 1 : undefined,
  });
  const submissionsQuery = useInfiniteQuery<{ data: Submission[]; current_page: number; last_page: number }>({
    queryKey: ['admin', 'offerwall-submissions', reviewFilter],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => (await http.get('/admin/offerwall-submissions', { params: { status: reviewFilter, page: pageParam } })).data,
    getNextPageParam: (page) => page.current_page < page.last_page ? page.current_page + 1 : undefined,
  });
  const create = useMutation({
    mutationFn: async () => {
      const body = new FormData();
      body.append('name', name);
      body.append('description', description);
      body.append('download_url', downloadUrl);
      if (image) body.append('image', image);
      stages.forEach((stage, index) => {
        body.append(`stages[${index}][name]`, stage.name);
        body.append(`stages[${index}][reward_coins]`, stage.reward);
      });
      await http.post('/admin/offerwalls', body);
    },
    onSuccess: async () => {
      setName(''); setDescription(''); setDownloadUrl(''); setImage(null); setImagePreview(null);
      setImageKey((key) => key + 1);
      setStages([{ name: '', reward: '' }]);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'offerwalls'] });
      feedback.success('Offerwall added.');
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'Offerwall could not be added.')),
  });
  const archive = useMutation({
    mutationFn: (id: string) => http.delete(`/admin/offerwalls/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'offerwalls'] });
      feedback.success('Offerwall removed from users.');
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'Offerwall could not be removed.')),
  });
  const review = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      http.post(`/admin/offerwall-submissions/${id}/${action}`, action === 'reject' ? { reason: rejectionReasons[id] } : {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'offerwall-submissions'] });
      feedback.success('Proof reviewed.');
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'Proof could not be reviewed.')),
  });
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate(); };
  const selectImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setImage(file);
    setImagePreview(null);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImagePreview(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };
  const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Offerwalls</h1>
      <form onSubmit={submit} className="space-y-4 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add an offerwall</h2>
        <label className="block text-sm dark:text-gray-200">Name<input required maxLength={150} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="block text-sm dark:text-gray-200">Short description<textarea required maxLength={500} rows={2} className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <label className="block text-sm dark:text-gray-200">App download link<input required type="url" pattern="https://.*" className={inputClass} value={downloadUrl} onChange={(e) => setDownloadUrl(e.target.value)} /></label>
        <label className="block text-sm dark:text-gray-200">Square offerwall image<input key={imageKey} required type="file" accept="image/jpeg,image/png,image/webp" className={inputClass} onChange={selectImage} /></label>
        {imagePreview && <img src={imagePreview} alt="Offerwall preview" className="aspect-square h-28 w-28 rounded-lg object-cover" />}
        <div className="space-y-2">
          <h3 className="text-sm font-medium dark:text-gray-200">Stages and reader coins</h3>
          {stages.map((stage, index) => (
            <div key={index} className="flex flex-wrap gap-2 sm:flex-nowrap">
              <input required maxLength={150} aria-label={`Stage ${index + 1} name`} placeholder={`Stage ${index + 1} name`} className={inputClass} value={stage.name}
                onChange={(e) => setStages((items) => items.map((item, position) => position === index ? { ...item, name: e.target.value } : item))} />
              <input required type="number" min="0.001" max="1000000" step="0.001" aria-label={`Stage ${index + 1} coins`} placeholder="Coins" className={`${inputClass} sm:w-36`} value={stage.reward}
                onChange={(e) => setStages((items) => items.map((item, position) => position === index ? { ...item, reward: e.target.value } : item))} />
              {stages.length > 1 && <button type="button" onClick={() => setStages((items) => items.filter((_, position) => position !== index))} className="text-sm text-red-600">Remove</button>}
            </div>
          ))}
          <button type="button" disabled={stages.length >= 100} onClick={() => setStages((items) => [...items, { name: '', reward: '' }])} className="text-sm font-medium text-primary">+ Add stage</button>
        </div>
        <button disabled={create.isPending} className="rounded-lg bg-primary px-5 py-2 text-white disabled:opacity-50">{create.isPending ? 'Adding...' : 'Add offerwall'}</button>
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold dark:text-white">Published offerwalls</h2>
        {offersQuery.isError && <p role="alert" className="text-red-600">Offerwalls could not be loaded.</p>}
        {offersQuery.data?.pages.flatMap((page) => page.data).map((offer) => (
          <div key={offer.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 dark:bg-slate-900">
            <img src={offer.image_url} alt="" className="aspect-square h-16 w-16 rounded-lg object-cover" />
            <div className="min-w-0 flex-1 dark:text-white"><strong>{offer.name}</strong><p className="text-xs text-gray-500">{offer.stages.length} stages · {formatCoins(offer.stages.reduce((sum, stage) => sum + Number(stage.reward_coins), 0))}</p></div>
            {offer.archived_at ? <span className="text-xs text-gray-500">Removed</span> : <button type="button" disabled={archive.isPending} onClick={() => archive.mutate(offer.id)} className="text-sm text-red-600">Delete</button>}
          </div>
        ))}
        <LoadMoreButton hasNextPage={Boolean(offersQuery.hasNextPage)} isFetchingNextPage={offersQuery.isFetchingNextPage} fetchNextPage={offersQuery.fetchNextPage} isError={offersQuery.isError} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold dark:text-white">Stage proof reviews</h2>
        <div className="flex gap-2">
          {(['pending', 'approved', 'rejected'] as const).map((status) => <button key={status} type="button" onClick={() => setReviewFilter(status)} className={`rounded-lg px-3 py-1.5 text-sm capitalize ${reviewFilter === status ? 'bg-primary text-white' : 'bg-white dark:bg-slate-800 dark:text-white'}`}>{status}</button>)}
        </div>
        {submissionsQuery.isError && <p role="alert" className="text-red-600">Proofs could not be loaded.</p>}
        {submissionsQuery.data?.pages.flatMap((page) => page.data).length === 0 && <p className="text-sm text-gray-500">No proofs in this status.</p>}
        {submissionsQuery.data?.pages.flatMap((page) => page.data).map((submission) => (
          <div key={submission.id} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start gap-3 sm:gap-4">
              <OfferwallThumbnail imageUrl={submission.stage.offerwall.image_url} />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="break-words text-base font-semibold text-gray-900 dark:text-white">{submission.stage.offerwall.name}</h3>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold capitalize text-gray-700 dark:bg-slate-800 dark:text-gray-200">{submission.status}</span>
                </div>
                <p className="break-words text-sm text-gray-700 dark:text-gray-200"><span className="text-gray-500 dark:text-gray-400">Stage {submission.stage.position}:</span> {submission.stage.name}</p>
                <p className="break-words text-sm text-gray-700 dark:text-gray-200"><span className="text-gray-500 dark:text-gray-400">Submitted by</span> <strong>{submission.user.username}</strong></p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Submitted {new Date(submission.created_at).toLocaleString()}</p>
              </div>
            </div>
            <ProofPreview submission={submission} />
            {submission.status === 'pending' && <div className="flex flex-wrap gap-2">
              <button type="button" disabled={review.isPending} onClick={() => review.mutate({ id: submission.id, action: 'approve' })} className="rounded-lg bg-primary px-3 py-2 text-sm text-white">Approve</button>
              <input aria-label="Rejection reason" placeholder="Reason for rejection" className={`${inputClass} sm:w-64`} value={rejectionReasons[submission.id] ?? ''}
                onChange={(e) => setRejectionReasons((reasons) => ({ ...reasons, [submission.id]: e.target.value }))} />
              <button type="button" disabled={review.isPending || !rejectionReasons[submission.id]?.trim()} onClick={() => review.mutate({ id: submission.id, action: 'reject' })} className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50">Reject</button>
            </div>}
            {submission.rejection_reason && <p className="text-sm text-red-600">Reason: {submission.rejection_reason}</p>}
          </div>
        ))}
        <LoadMoreButton hasNextPage={Boolean(submissionsQuery.hasNextPage)} isFetchingNextPage={submissionsQuery.isFetchingNextPage} fetchNextPage={submissionsQuery.fetchNextPage} isError={submissionsQuery.isError} />
      </section>
    </main>
  );
}
