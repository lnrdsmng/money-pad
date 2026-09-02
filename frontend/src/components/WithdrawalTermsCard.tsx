import React from 'react';
import { Info, Calendar, DollarSign, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import type { WithdrawalPolicy } from '../types/withdrawals';

interface WithdrawalTermsCardProps {
  policy?: WithdrawalPolicy;
  userPaymentMethod?: string;
  hasPaymentDetails: boolean;
  readerCoins?: number | string;
  onSetupPayment?: () => void;
}

export const WithdrawalTermsCard: React.FC<WithdrawalTermsCardProps> = ({
  policy,
  userPaymentMethod,
  hasPaymentDetails,
  readerCoins = 0,
  onSetupPayment,
}) => {
  const minEWallet = policy?.min_gcash_maya ?? 10;
  const minBank = policy?.min_bank ?? 20;
  const platformFee = policy?.platform_fee ?? 3;
  const bankFee = policy?.bank_fee ?? 10;
  const adsToWaive = policy?.ads_to_waive_fee ?? 10;
  const scheduleLabel = policy?.processing_days_label ?? 'Monday–Saturday';
  const turnaroundLabel = policy?.processing_turnaround_label ?? '1–7 business days';

  const coinRate = policy?.coin_to_php_rate ?? 0.01;
  const cashValue = Number(readerCoins || 0) * coinRate;
  const selectedMin = userPaymentMethod === 'Bank Transfer' ? minBank : minEWallet;
  const isQualifying = cashValue >= selectedMin;

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
      {/* Header */}
      <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-primary/20 p-2 rounded-lg text-primary-light">
            <Info className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Withdrawal Terms & Conditions</h3>
            <p className="text-xs text-slate-300">Automatic payouts directly to your configured payment method</p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
          <Sparkles className="w-3.5 h-3.5 mr-1" />
          Automatic Processing
        </span>
      </div>

      {/* Warning banner when user qualifies but lacks payment setup */}
      {isQualifying && !hasPaymentDetails && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center text-amber-800 text-sm">
            <ShieldAlert className="w-5 h-5 text-amber-600 mr-2 flex-shrink-0" />
            <span>
              Your balance qualifies for withdrawal (<strong>₱{cashValue.toFixed(2)}</strong>), but you have not configured your payout details yet.
            </span>
          </div>
          {onSetupPayment && (
            <button
              onClick={onSetupPayment}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-md shadow-sm transition-colors flex-shrink-0"
            >
              Add Payout Account
            </button>
          )}
        </div>
      )}

      {/* Content Grid */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Term 1: Automatic Triggers & Thresholds */}
        <div className="space-y-2">
          <div className="flex items-center text-gray-900 font-semibold text-sm">
            <DollarSign className="w-4 h-4 text-emerald-600 mr-1.5" />
            Automatic Thresholds
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Withdrawals trigger automatically once your balance qualifies. No manual request needed.
          </p>
          <ul className="text-xs text-gray-700 space-y-1 pt-1">
            <li className="flex items-center">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mr-1.5 flex-shrink-0" />
              <span><strong>GCash / Maya:</strong> Min. ₱{minEWallet.toFixed(2)} ({(minEWallet / coinRate).toLocaleString()} coins)</span>
            </li>
            <li className="flex items-center">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mr-1.5 flex-shrink-0" />
              <span><strong>Bank Transfer:</strong> Min. ₱{minBank.toFixed(2)} ({(minBank / coinRate).toLocaleString()} coins)</span>
            </li>
          </ul>
        </div>

        {/* Term 2: Fees & Waiver Policy */}
        <div className="space-y-2">
          <div className="flex items-center text-gray-900 font-semibold text-sm">
            <Sparkles className="w-4 h-4 text-blue-600 mr-1.5" />
            Fees & Task Waiver
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Standard platform fee is <strong>₱{platformFee.toFixed(2)}</strong>. You can waive it by completing designated in-app tasks ({adsToWaive} ads) before admin review.
          </p>
          <p className="text-xs text-gray-500">
            * Bank Transfers incur a non-waivable <strong>₱{bankFee.toFixed(2)}</strong> bank processing fee.
          </p>
        </div>

        {/* Term 3: Processing Schedule */}
        <div className="space-y-2">
          <div className="flex items-center text-gray-900 font-semibold text-sm">
            <Calendar className="w-4 h-4 text-purple-600 mr-1.5" />
            Processing Window
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Operational hours: <strong>{scheduleLabel}</strong> with a turnaround of <strong>{turnaroundLabel}</strong>.
          </p>
          <p className="text-xs text-purple-700 font-medium">
            * Payouts recorded on Sunday are deferred for review starting the following Monday.
          </p>
        </div>
      </div>
    </div>
  );
};