export interface ReferralTier {
  tier: number;
  targetChapters: number;
  currentChapters: number;
  targetAds: number;
  currentAds: number;
  coins: number;
  isCompleted: boolean;
  isClaimed: boolean;
  canClaim: boolean;
  isLocked: boolean;
  canWatchAd?: boolean;
}

export interface ReferredUserProgress {
  id: string;
  username: string;
  profileImageUrl?: string;
  isVerified?: boolean;
  joinedAt?: string;
  activeTier: number;
  tiers: ReferralTier[];
}

export interface SupportingProgress {
  referrerId: string;
  referrerUsername: string;
  activeTier: number;
  tiers: ReferralTier[];
}

export interface ReferralMilestonesResponse {
  referralCode: string;
  referralCount: number;
  totalChaptersRead: number;
  totalAdsWatched: number;
  referrals: ReferredUserProgress[];
  supporting?: SupportingProgress | null;
  tiers: ReferralTier[];
}
