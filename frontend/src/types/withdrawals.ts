export interface WithdrawalPolicy {
  min_gcash_maya: number;
  min_bank: number;
  platform_fee: number;
  bank_fee: number;
  ads_to_waive_fee: number;
  coin_to_php_rate: number;
  timezone: string;
  processing_days: string[];
  processing_days_label: string;
  processing_turnaround_label: string;
  sunday_deferred: boolean;
  auto_withdrawal_description: string;
}

export type WithdrawalStatus =
  | 'eligible'
  | 'pending_ad_choice'
  | 'watching_ads'
  | 'pending_review'
  | 'approved'
  | 'completed'
  | 'rejected';

export interface WithdrawalAccountSnapshot {
  payment_method?: string;
  payment_account_name?: string | null;
  payment_account_info?: string;
  bank_name?: string | null;
  username?: string;
  email?: string;
  captured_at?: string;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  amount: string;
  gross_amount?: string;
  net_amount?: string;
  coins_deducted?: string;
  source: 'READER' | 'AUTHOR';
  payment_method: 'GCash' | 'Maya' | 'Bank Transfer' | string;
  payment_account_info: string;
  bank_name?: string | null;
  account_snapshot?: WithdrawalAccountSnapshot | null;
  platform_fee: string | number;
  bank_fee: string | number;
  ads_watched_count: number;
  fee_waived: boolean;
  status: WithdrawalStatus;
  system_message_id?: string | null;
  triggered_at?: string | null;
  earliest_review_at?: string | null;
  estimated_deadline_at?: string | null;
  reviewed_at?: string | null;
  completed_at?: string | null;
  rejection_reason?: string | null;
  payout_reference?: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    username: string;
    email?: string;
  };
}