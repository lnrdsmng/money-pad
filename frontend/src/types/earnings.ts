export type PlanId = 'free' | 'standard' | 'mega_premium' | 'ultimate_premium';

export interface MoneyPadPlan {
  id: PlanId;
  name: string;
  price: string;
  rate_per_minute: string;
  multiplier: string;
  ads: boolean;
  duration_months: number | null;
}

export type PaymentMethodId = 'gcash' | 'paymaya' | 'paypal';

export interface PaymentMethodSetting {
  id: PaymentMethodId;
  label: string;
  account_name: string;
  account_identifier: string;
  instructions: string | null;
  is_active: boolean;
}

export type PlanPurchaseStatus = 'pending_review' | 'approved' | 'rejected' | 'cancelled';

export interface PlanPurchase {
  id: string;
  plan_type: PlanId;
  amount: string;
  currency: string;
  payment_method: PaymentMethodId;
  payment_reference: string;
  status: PlanPurchaseStatus;
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

export interface ReadingReward {
  id: string;
  amount: string;
  rate_per_minute: string;
  plan_type: PlanId;
  earned_at: string;
  expires_at: string;
  story?: { id: string; title: string };
  story_part?: { id: string; title: string };
}

export interface ReadingIncomeResponse {
  data: ReadingReward[];
  pending_total: string;
  nearest_expiration: string | null;
  server_time: string;
}

export interface ReadingRewardClaim {
  id: string;
  amount: string;
  reward_count: number;
  status: 'awaiting_ad' | 'completed' | 'cancelled';
  ad_required: boolean;
  ad_provider: string | null;
  claimed_at: string | null;
  rewards?: ReadingReward[];
}

export interface CreateClaimResponse {
  claim: ReadingRewardClaim;
  mock_ad_token: string | null;
  completed: boolean;
  user: Record<string, unknown> | null;
}

export interface PaginatedClaims {
  data: ReadingRewardClaim[];
  current_page: number;
  last_page: number;
}
