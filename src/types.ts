export type Role = 'consumer' | 'brand' | 'admin' | null;

export type BrandCredit = {
  brandId: string;
  brandName: string;
  amount: number;
  updatedAt: number;
};

export type BrandBountyBalance = {
  brandId: string;
  brandName: string;
  convertibleBountyAmount: number;
};

export type PitchTierStatus = {
  tierNumber: 1 | 2 | 3;
  tierName: string;
  currentBounty: number;
  nextTierBounty: number;
  msRemainingInTier: number;
  nextTierLabel: string;
};

export type Session = {
  role: Role;
  email: string;
  isVerified: boolean;
};

export type ConsumerWallet = {
  lockedEscrow: number;
  withdrawable: number;
};

export type WalletTransaction = {
  id: string;
  type: 'bounty_release' | 'cashout' | 'image_review_bounty' | 'admin_refund' | 'admin_release' | 'REFUND' | 'brand_payout' | 'platform_fee' | 'unclaimed_bounty_refund' | 'bounty_expired_refund' | 'PRODUCT_BOUNTY_CASHBACK' | 'IMAGE_REVIEW_BOUNTY' | 'IMAGE_REVIEW_BOUNTY_EXPIRED' | 'FAILED_DELIVERY_REFUND' | 'ESCROW_RELEASE' | 'UNCLAIMED_BOUNTY_RETURN' | 'ORDER_PAYMENT' | 'SANDBOX_PAYMENT' | 'PLATFORM_FEE_DEDUCTION' | 'BOUNTY_ESCROW_DEDUCTION' | 'WITHDRAWAL' | 'BRAND_CREDIT_CONVERSION' | 'BOUNTY_BRAND_BOOST' | 'BRAND_CREDIT_REDEEMED' | 'SYNDICATE_BOUNTY_UPGRADE' | 'SYNDICATE_TIER_DOWNGRADE';
  amount: number;
  description: string;
  timestamp: number;
  orderId?: string;
  runningBalance?: number;
  wallet?: 'consumer' | 'brand';
  direction?: 'credit' | 'debit';
  category?: 'credit' | 'debit';
};

export type LedgerTag = 'PRODUCT_BOUNTY' | 'IMAGE_BOUNTY' | 'ESCROW_RELEASE' | 'REFUND' | 'FAILED_DELIVERY_REFUND' | 'UNCLAIMED_BOUNTY_RETURN';

export type ReviewStatus = 'pending_upload' | 'pending' | 'uploaded' | 'expired' | 'none';

export type EscrowStatus = 'locked' | 'settled' | 'refunded' | 'released' | 'disputed';

export type BrandStatus = 'verified' | 'pending' | 'suspended';

export type BrandRecord = {
  id: string;
  brandName: string;
  status: BrandStatus;
  totalSales: number;
  totalBounties: number;
  activePitches: number;
};

export type BrandWallet = {
  globalBudget: number;
  walletBalance?: number;
};

export type PlatformRevenue = {
  totalRevenue: number;
};

export type BrandProfile = {
  isCorporateVerified: boolean;
  legalCorporateName: string;
  trademarkId: string;
  dunsNumber: string;
  displayName: string;
  gstin: string;
  gstinVerified: boolean;
  middeskVerified: boolean;
  stripeConnected: boolean;
  stripeAccountLast4: string;
};

export type VariantStock = {
  size: string;
  color: string;
  sku: string;
  stock: number;
  outOfStock: boolean;
};

export type Product = {
  id: string;
  brandId?: string | null;
  brandName: string;
  title: string;
  teaser?: string;
  subcategory?: string;
  priceInr: number;
  category: string;
  keywords: string[];
  images: string[];
  primaryImageIndex: number;
  sizes: string[];
  colors: string[];
  colorHex: Record<string, string>;
  autoBounty: number;
  variants: VariantStock[];
  isDraft: boolean;
  imageReviewBountyEnabled?: boolean;
  imageReviewBountyAmount?: number;
  priceIncreasedAt?: number;
  bountyDecreasedAt?: number;
  priceLastEditedAt?: number;
  bountyLastEditedAt?: number;
  stockQuantity?: number;
  soldCount?: number;
  grossSales?: number;
  bountiesPaid?: number;
  netRevenue?: number;
};

export type Campaign = {
  id: string;
  productId: string;
  productTitle: string;
  keyword: string;
  reachPercent: number;
  targetCount: number;
  totalVipBounty: number;
  createdAt: number;
};

export type KeywordAlert = {
  id: string;
  keyword: string;
  createdAt: number;
};

export type BagItem = {
  id: string;
  productId: string;
  productTitle: string;
  brandName: string;
  image: string;
  priceInr: number;
  autoBounty: number;
  size: string;
  color: string;
  quantity: number;
};

export type IntentStatus = 'active' | 'fulfilled';

export type PitchStatus = 'active' | 'accepted' | 'expired' | 'declined';

export type Pitch = {
  id: string;
  intentId: string;
  consumerEmail: string;
  productId: string;
  productTitle: string;
  brandName: string;
  productImage: string;
  originalPrice: number;
  bountyAmount: number;
  status: PitchStatus;
  createdAt: string;
  offeredPrice?: number;
  baselinePrice?: number;
  baselineBounty?: number;
  offeredSizes?: string[];
  offeredColors?: string[];
  isVip?: boolean;
};

export type IntentProductSnapshot = {
  productId: string;
  baselinePrice: number;
  baselineBounty: number;
};

export type Intent = {
  id: string;
  consumerEmail: string;
  searchQuery: string;
  status: IntentStatus;
  createdAt: number;
  expiresAt: number;
  refUserId?: string;
  pitches?: Pitch[];
  productSnapshots?: IntentProductSnapshot[];
};

export type Review = {
  id: string;
  productId: string;
  consumerEmail: string;
  rating: number;
  comment: string;
  timestamp: number;
  image?: string;
  images?: string[];
  bountyClaimed?: boolean;
};

export type SalesRecord = {
  id: string;
  productId: string;
  brandName: string;
  productTitle: string;
  category: string;
  salePrice: number;
  bountyPaid: number;
  buyerEmail: string;
  timestamp: number;
  quantity?: number;
};

export type TrackingStatus = 'Placed' | 'Dispatched' | 'In Transit' | 'Delivered';

export type TrackingTimelineStage = {
  status: string;
  time: number;
  location: string;
};

export interface SyndicateTier {
  tierNumber: number;
  thresholdUnits: number;
  bountyPercent: number;
}

export interface SyndicateWave {
  id: string;
  brandId: string;
  brandName: string;
  productId: string;
  productTitle: string;
  productPrice: number;
  hasImageBounty: boolean;
  imageBountyAmount: number;
  startTime: number;
  durationMs: number;
  tiers: SyndicateTier[];
  orderIds: string[];
  currentUnits: number;
  status: 'active' | 'completed' | 'expired';
}

export type OrderStatus = 'placed' | 'shipped' | 'delivered' | 'refunded' | 'replacement_dispatched' | 'cancelled';
export type Courier = 'BlueDart' | 'Delhivery' | 'DTDC' | 'FedEx';
export type DisputeStatus =
  | 'none'
  | 'open'
  | 'opened_under_review'
  | 'escalated'
  | 'replacement_issued_by_admin'
  | 'resolved_refunded_by_admin'
  | 'rejected_by_admin'
  | 'resolved'
  | 'resolved_refunded'
  | 'resolved_reshipped'
  | 'resolved_released'
  | 'resolved_completed'
  | 'replacement_dispatched'
  | 'closed_cancelled'
  | 'pickup_scheduled'
  | 'resolution_proposed';

export type SettlementStatus = 'pending' | 'refunded' | 'replaced' | 'settled';

export type AdminDisputeDecision = 'force_refund' | 'force_replacement' | 'reject_dispute';

export type DisputeMessage = {
  id: string;
  senderRole: 'consumer' | 'brand' | 'admin';
  senderName?: string;
  text: string;
  images?: string[];
  timestamp: number;
};

export type DbOrder = {
  id: string;
  buyerId: string | null;
  brandId: string | null;
  waveId: string | null;
  productId: string;
  unitPrice: number;
  totalPrice: number;
  status: string;
  productBounty: number;
  syndicateTierUnlocked: number;
  hasImageBounty: boolean;
  imageReviewBounty: number;
  imageEscrowHeld: boolean;
  reviewStatus: string;
  reviewDeadline: number | null;
  createdAt: number;
  quantity: number;
  productName: string;
  brandName: string;
  bountyAmount: number;
  consumerEmail: string;
  shippedAt: number | null;
  deliveredAt: number | null;
  isDisputed: boolean;
  isDelivered: boolean;
  disputeReason: string;
  disputeDescription: string;
  disputeStatus: string;
  escrowStatus: string;
  bountyStatus: string;
  brandResponse: string | null;
  size: string | null;
  color: string | null;
  trackingNumber: string | null;
  disputeMessages: DisputeMessage[];
  returnStatus: string | null;
  returnTrackingNumber: string | null;
  tokenDiscountUsed: number;
  totalAmount: number | null;
  cashback: number;
};

export type DailyAnalytics = {
  analyticsDate: string; // ISO date string (YYYY-MM-DD)
  productId: string;
  grossRevenue: number;
  bountiesPaid: number;
  netMargin: number;
  ordersCount: number;
  unitsSold: number;
};

export type Order = {
  id: string;
  consumerEmail: string;
  productId: string;
  productTitle: string;
  brandName: string;
  priceInr: number;
  bountyAmount: number;
  quantity?: number;
  size: string;
  color: string;
  selectedSize?: string;
  selectedColor?: string;
  image: string;
  trackingStatus: TrackingStatus;
  trackingNumber: string;
  courier?: Courier;
  carrier?: string;
  estimatedDelivery?: number;
  status?: OrderStatus;
  isReshipped?: boolean;
  returnOldItemRequired?: boolean;
  trackingTimeline?: TrackingTimelineStage[];
  timestamp: number;
  addressId?: string;
  disputeId?: string;
  disputeStatus: DisputeStatus;
  dispute_status?: string;
  disputeReason?: string;
  disputeDescription?: string;
  disputeEvidenceImages?: string[];
  disputeOpenedAt?: number;
  disputeEscalatedAt?: number;
  disputeMessages?: DisputeMessage[];
  escrowFrozen?: boolean;
  disputeFrozen?: boolean;
  refunded?: boolean;
  reshipped?: boolean;
  adminNotes?: string;
  returnTrackingDueAt?: number;
  priceAtPurchase?: number;
  settlementStatus?: SettlementStatus;
  reviewBountyClaimed?: boolean;
  deliveredAt?: number;
  disputeExpiresAt?: number;
  reviewExpiresAt?: number;
  reviewStatus?: ReviewStatus;
  bountyEscrow?: number;
  brandNetPayout?: number;
  platformFee?: number;
  escrowStatus?: EscrowStatus;
  bountyReleased?: boolean;
  brandPayoutReleased?: boolean;
  productBounty?: number;
  imageReviewBounty?: number;
  productBountyReleased?: boolean;
  imageReviewBountyReleased?: boolean;
  cancelReason?: string;
  cancelNotes?: string;
  cancelledAt?: number;
  brandCreditApplied?: number;
  netPaid?: number;
  isSyndicateOrder?: boolean;
  waveId?: string;
  hasImageBounty?: boolean;
  imageEscrowHeld?: boolean;
  syndicateTierUnlocked?: number;
  bountyUpgradeHistory?: {
    fromBounty: number;
    toBounty: number;
    deltaAdded: number;
    deltaRemoved?: number;
    tierNumber: number;
    reason?: string;
    timestamp: number;
  }[];
  returnStatus?: string | null;
  returnTrackingNumber?: string | null;
  tokenDiscountUsed?: number;
  totalAmount?: number | null;
};

export type ToastType = 'success' | 'info' | 'error';

export type Toast = {
  id: string;
  type: ToastType;
  message: string;
};

export type AddressType = 'Home' | 'Work' | 'Other';

export type Address = {
  id: string;
  consumerEmail: string;
  fullName: string;
  phone: string;
  phoneNumber?: string;
  pincode: string;
  houseNo: string;
  flatHouseNo?: string;
  area: string;
  streetArea?: string;
  landmark: string;
  city: string;
  state: string;
  addressType: AddressType;
  isDefault: boolean;
};

export type NotificationType = 'order' | 'vip_pitch' | 'wallet_cashout' | 'dispute' | 'intent' | 'system';

export type AppNotification = {
  id: string;
  consumerEmail: string;
  type: NotificationType;
  title: string;
  description: string;
  link?: string;
  timestamp: number;
  read: boolean;
};

export type BrandToken = {
  id: string;
  consumerEmail: string;
  brandName: string;
  principalBoosted: number;
  bonusEarned: number;
  totalCreditMinted: number;
  creditSpent: number;
  availableCredit: number;
  updatedAt: number;
};

export type WalletTxn = {
  id: string;
  consumerEmail: string;
  txType: 'brand_boost' | 'upi_withdrawal' | 'token_spend' | 'token_boost' | 'token_redeem' | 'token_refund';
  brandName: string | null;
  cashAmount: number;
  bonusAmount: number;
  creditAmount: number;
  upiId: string | null;
  orderId: string | null;
  createdAt: number;
};

export const RESOLVED_DISPUTE_STATUSES: Set<string> = new Set([
  'resolved',
  'resolved_refunded',
  'refunded',
  'resolved_reshipped',
  'reshipped',
  'resolved_released',
  'resolved_completed',
  'resolved_refunded_by_admin',
  'closed',
  'closed_cancelled',
]);

export function isDisputeResolved(status: string | null | undefined): boolean {
  return !!status && RESOLVED_DISPUTE_STATUSES.has(status);
}

export function matchesIntent(product: Product, intent: Intent): boolean {
  const q = intent.searchQuery.toLowerCase().trim();
  return product.keywords.some((kw) => {
    const k = kw.toLowerCase().trim();
    return q.includes(k) || k.includes(q);
  });
}
