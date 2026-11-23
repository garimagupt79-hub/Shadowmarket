export type ProfileRole = 'buyer' | 'brand' | 'admin';

export interface Profile {
  id: string;
  role: ProfileRole;
  display_name: string | null;
  wallet_balance: number;
  pending_escrow_bounty: number;
  brand_bounty_pool: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export type SyndicateWaveStatus = 'active' | 'completed' | 'cancelled';

export interface SyndicateWave {
  id: string;
  product_id: string;
  brand_id: string | null;
  status: SyndicateWaveStatus;
  start_time: string;
  end_time: string;
  has_image_bounty: boolean;
  image_bounty_amount: number;
  created_at: string;
}

export interface WaveTier {
  id: string;
  wave_id: string;
  tier_number: number;
  threshold_units: number;
  bounty_percent: number;
}

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'
  | 'disputed';

export type ReviewStatus = 'none' | 'pending' | 'approved' | 'expired';

export interface Order {
  id: string;
  buyer_id: string | null;
  brand_id: string | null;
  wave_id: string | null;
  product_id: string;
  unit_price: number;
  total_price: number;
  status: OrderStatus;
  product_bounty: number;
  syndicate_tier_unlocked: number;
  has_image_bounty: boolean;
  image_review_bounty: number;
  image_escrow_held: boolean;
  review_status: ReviewStatus;
  review_deadline: string | null;
  created_at: string;
  updated_at: string;
}

export type WalletLedgerType =
  | 'WALLET_DEPOSIT'
  | 'ORDER_PAYMENT'
  | 'ESCROW_HOLD'
  | 'BASE_BOUNTY_RELEASE'
  | 'IMAGE_BOUNTY_RELEASE'
  | 'IMAGE_BOUNTY_EXPIRED_REFUND'
  | 'DELTA_CREDIT'
  | 'SYNDICATE_TIER_DOWNGRADE'
  | 'DISPUTE_REFUND';

export interface WalletLedgerEntry {
  id: string;
  user_id: string;
  order_id: string | null;
  type: WalletLedgerType;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export interface BountyAuditLog {
  id: string;
  order_id: string;
  wave_id: string;
  previous_bounty: number;
  new_bounty: number;
  delta_applied: number;
  tier_number: number;
  reason: string;
  created_at: string;
}
