export interface OfferwallStage {
  id: string;
  name: string;
  position: number;
  reward_coins: string;
  status: 'locked' | 'ready' | 'pending' | 'rejected' | 'approved';
  rejection_reason: string | null;
  proof_url: string | null;
}

export interface Offerwall {
  id: string;
  name: string;
  description: string;
  image_url: string;
  download_url: string;
  category: 'new' | 'started' | 'completed';
  completed_stages: number;
  stage_count: number;
  total_coins: string;
  earned_coins: string;
  next_step: string | null;
  stages?: OfferwallStage[];
}
