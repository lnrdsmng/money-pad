import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Search,
  Sparkles,
  Upload,
  ArrowLeft,
  LoaderCircle,
} from 'lucide-react';
import http from '../../api/http';
import { useAuth } from '../../auth/AuthProvider';
import { VerifiedBadge } from '../../components/common/VerifiedBadge';
import { useFeedback } from '../../components/feedback/feedback';
import { getApiErrorMessage } from '../../utils/apiError';

export default function AuthorVerificationPage() {
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const feedback = useFeedback();

  const [paymentMethod, setPaymentMethod] = useState<'balance' | 'gcash' | 'maya'>('balance');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  const { data: statusData, isLoading } = useQuery({
    queryKey: ['authorVerificationStatus'],
    queryFn: async () => {
      const res = await http.get('/authors/verification-status');
      return res.data;
    },
  });

  const isVerified = Boolean(statusData?.isVerified || user?.isVerified);
  const isEligible = Boolean(statusData?.isEligible);
  const qualifyingStoriesCount = Number(statusData?.qualifyingStoriesCount || 0);
  const authorIncome = Number(statusData?.authorIncome ?? user?.authorIncome ?? 0);
  const pendingRequest = statusData?.pendingRequest;
  const latestRequest = statusData?.latestRequest;

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const res = await http.get('/payment-methods');
      return res.data?.data || [];
    },
  });

  const selectedDestination = paymentMethods.find(
    (m: any) => m.id?.toLowerCase() === paymentMethod.toLowerCase()
  );

  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (paymentMethod === 'balance') {
        const res = await http.post('/authors/verify', { payment_method: 'balance' });
        return res.data;
      } else {
        if (!paymentProof) throw new Error('Please upload a screenshot of your payment receipt');
        if (!paymentReference.trim()) throw new Error('Please enter the payment reference number');

        const formData = new FormData();
        formData.append('payment_method', paymentMethod);
        formData.append('payment_reference', paymentReference.trim());
        formData.append('payment_proof', paymentProof);

        const res = await http.post('/authors/verify', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data;
      }
    },
    onSuccess: (data) => {
      if (data.isVerified) {
        feedback.success('Congratulations! You are now a verified author!');
        if (data.user) updateUser(data.user);
      } else {
        feedback.success('Verification application submitted for review.');
      }
      queryClient.invalidateQueries({ queryKey: ['authorVerificationStatus'] });
    },
    onError: (error) => {
      feedback.error(getApiErrorMessage(error, 'Verification application failed.'));
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setPaymentProof(file);
      setProofPreview(URL.createObjectURL(file));
    }
  };

  if (isLoading) {
    return <div className="text-center py-16 text-sm text-gray-500">Checking verification eligibility...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-8 space-y-8">
      <div>
        <Link
          to="/writer"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-gray-500 hover:text-primary mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Writer Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Author Verification Program
          </h1>
          <VerifiedBadge size={24} />
        </div>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Elevate your author profile with priority distribution, exclusive monetization terms, and the official verified checkmark.
        </p>
      </div>

      {/* ALREADY VERIFIED CARD */}
      {isVerified && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-emerald-500 text-white rounded-full">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                You are a Verified Author!
                <VerifiedBadge size={20} />
              </h2>
              <p className="text-sm text-emerald-800 dark:text-emerald-300 mt-1">
                Your stories receive maximum priority in search, lower withdrawal thresholds, and high-trust reader badges.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PENDING APPLICATION CARD */}
      {!isVerified && pendingRequest && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-amber-500 text-white rounded-full">
            <Clock className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-amber-900 dark:text-amber-100">
              Verification Application Pending Review
            </h2>
            <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
              Your proof of payment ({pendingRequest.payment_method?.toUpperCase()} • Ref: {pendingRequest.payment_reference}) was submitted on{' '}
              {new Date(pendingRequest.submitted_at || pendingRequest.created_at).toLocaleDateString()}. Administrators are reviewing it shortly!
            </p>
          </div>
        </div>
      )}

      {/* REJECTED APPLICATION CARD */}
      {!isVerified && !pendingRequest && latestRequest?.status === 'rejected' && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl p-6 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-red-500 text-white rounded-full">
            <XCircle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-red-900 dark:text-red-100">
              Previous Application Not Approved
            </h2>
            <p className="text-sm text-red-800 dark:text-red-300 mt-1">
              Reason: {latestRequest.rejection_reason || 'Payment verification could not be confirmed.'}
            </p>
            <p className="text-xs text-red-700 dark:text-red-400 mt-2">
              You may submit a revised receipt or pay using author balance below.
            </p>
          </div>
        </div>
      )}

      {/* BENEFITS CARD */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700 shadow-xs">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          Verified Author Benefits
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100 mb-1">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              ₱20 Minimum Payout
            </div>
            <p className="text-xs text-gray-500">
              Enjoy lower minimum withdrawal thresholds for rapid cashouts to GCash and Maya.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100 mb-1">
              <Search className="w-4 h-4 text-blue-500" />
              Search Priority Boost
            </div>
            <p className="text-xs text-gray-500">
              Your novels are ranked ahead of unverified titles across explore search and genre categories.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100 mb-1">
              <VerifiedBadge size={16} />
              Green Verified Checkmark
            </div>
            <p className="text-xs text-gray-500">
              Instant social proof across reader pages, story covers, reviews, and profile boards.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100 mb-1">
              <DollarSign className="w-4 h-4 text-primary" />
              $0.05 / 100 Views Tier
            </div>
            <p className="text-xs text-gray-500">
              Premium view monetization rates for eligible original serialized stories.
            </p>
          </div>
        </div>
      </div>

      {/* ELIGIBILITY CHECKLIST */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700 shadow-xs space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Eligibility Requirements
        </h2>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              {isEligible ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-gray-400 shrink-0" />
              )}
              <div>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  Published Stories with 10+ Chapters
                </span>
                <p className="text-xs text-gray-500">
                  Must have published at least 2 completed or ongoing serialized novels.
                </p>
              </div>
            </div>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                isEligible
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {qualifyingStoriesCount} / 2 Qualified
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  Community & Content Guidelines
                </span>
                <p className="text-xs text-gray-500">Account in good standing with zero copyright strikes.</p>
              </div>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800">
              Compliant
            </span>
          </div>
        </div>
      </div>

      {/* PAYMENT & APPLICATION FORM */}
      {!isVerified && !pendingRequest && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700 shadow-xs space-y-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Complete Author Verification
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              One-time verification fee: <strong className="text-gray-800 dark:text-gray-200">₱149.00</strong>
            </p>
          </div>

          {!isEligible ? (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
              You need <strong>2 published stories with at least 10 chapters each</strong> to unlock the verification application. Keep writing!
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verifyMutation.mutate();
              }}
              className="space-y-6"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Payment Method
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('balance')}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      paymentMethod === 'balance'
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-gray-200 dark:border-slate-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-bold text-sm text-gray-900 dark:text-gray-100">Author Income</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Balance: ₱{authorIncome.toFixed(2)}
                    </div>
                    {authorIncome < 149 && (
                      <span className="text-[10px] text-red-500 font-medium block mt-1">Insufficient</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('gcash')}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      paymentMethod === 'gcash'
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-gray-200 dark:border-slate-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-bold text-sm text-gray-900 dark:text-gray-100">GCash</div>
                    <div className="text-xs text-gray-500 mt-1">Upload payment receipt</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('maya')}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      paymentMethod === 'maya'
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-gray-200 dark:border-slate-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-bold text-sm text-gray-900 dark:text-gray-100">Maya</div>
                    <div className="text-xs text-gray-500 mt-1">Upload payment receipt</div>
                  </button>
                </div>
              </div>

              {/* Balance Deduction Details */}
              {paymentMethod === 'balance' && (
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 text-xs space-y-2">
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Verification Fee:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">₱149.00</span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Your Author Income:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">₱{authorIncome.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-200 dark:border-slate-700 pt-2 flex justify-between font-bold text-gray-900 dark:text-gray-100">
                    <span>Remaining Balance:</span>
                    <span className={authorIncome >= 149 ? 'text-primary' : 'text-red-500'}>
                      ₱{(authorIncome - 149).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Receipt Upload for GCash / Maya */}
              {paymentMethod !== 'balance' && (
                <div className="space-y-4 p-4 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700">
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Send <strong>₱149.00</strong> via {selectedDestination?.label || paymentMethod.toUpperCase()} to{' '}
                    <strong className="text-gray-900 dark:text-gray-100">
                      {selectedDestination?.account_number
                        ? `${selectedDestination.account_number} (${selectedDestination.account_name})`
                        : '0917-123-4567 (MoneyPad Admin)'}
                    </strong>.
                    Upload the transaction screenshot below.
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Reference Number / Transaction ID
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 10029384812"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Upload Receipt Screenshot
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        Choose File
                        <input
                          type="file"
                          accept="image/*"
                          required
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                      {paymentProof && (
                        <span className="text-xs text-gray-500 truncate">{paymentProof.name}</span>
                      )}
                    </div>
                    {proofPreview && (
                      <div className="mt-3 w-32 h-44 rounded-lg overflow-hidden border border-gray-200">
                        <img src={proofPreview} alt="Receipt preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={
                  verifyMutation.isPending ||
                  (paymentMethod === 'balance' && authorIncome < 149) ||
                  (paymentMethod !== 'balance' && (!paymentProof || !paymentReference.trim()))
                }
                className="w-full sm:w-auto px-8 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-green-600 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-md"
              >
                {verifyMutation.isPending ? (
                  <LoaderCircle className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                {paymentMethod === 'balance'
                  ? 'Pay ₱149 & Verify Instantly'
                  : 'Submit Application for Review'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
