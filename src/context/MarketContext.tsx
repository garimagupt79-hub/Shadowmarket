import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import type { Profile as DbProfile } from '../types/database';
import type {
  Address,
  AddressType,
  AppNotification,
  BrandProfile,
  BrandWallet,
  Campaign,
  ConsumerWallet,
  Courier,
  DisputeMessage,
  Intent,
  IntentProductSnapshot,
  KeywordAlert,
  BagItem,
  Order,
  OrderStatus,
  Pitch,
  PitchTierStatus,
  Product,
  Review,
  SalesRecord,
  Session,
  Toast,
  TrackingStatus,
  TrackingTimelineStage,
  VariantStock,
  WalletTransaction,
  BrandCredit,
  SyndicateTier,
  SyndicateWave,
  BrandBountyBalance,
  BrandRecord,
  BrandStatus,
  ReviewStatus,
  EscrowStatus,
  AdminDisputeDecision,
  DisputeStatus,
} from '../types';
import { isDisputeResolved } from '../types';
import type {
  DbOrder,
  DailyAnalytics,
  BrandToken,
  WalletTxn,
} from '../types';

const STORAGE_KEY = 'shadowmarket.state.v4';
const INTENT_TTL = 48 * 60 * 60 * 1000;
const PRICE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

type MarketState = {
  session: Session;
  authLoading: boolean;
  authUser: { id: string; email: string } | null;
  authProfile: DbProfile | null;
  consumerWallet: ConsumerWallet;
  brandWallet: BrandWallet;
  brandProfile: BrandProfile;
  products: Product[];
  intents: Intent[];
  salesAnalytics: SalesRecord[];
  reviews: Review[];
  orders: Order[];
  campaigns: Campaign[];
  pitches: Pitch[];
  keywordAlerts: KeywordAlert[];
  bagItems: BagItem[];
  toasts: Toast[];
  addresses: Address[];
  notifications: AppNotification[];
  walletTransactions: WalletTransaction[];
  brandRecords: BrandRecord[];
  brandCredits: BrandCredit[];
  brandBountyPool: BrandBountyBalance[];
  platformRevenue: number;
  brandWalletBalance: number;
  mainEscrowBalance: number;
  syndicateWaves: SyndicateWave[];
  dbOrders: DbOrder[];
  dailyAnalytics: DailyAnalytics[];
  brandTokens: BrandToken[];
  walletTxns: WalletTxn[];
  disputes: DisputeRow[];
  brandTokenSettings: Record<string, { tokens_enabled: boolean; max_redemption_pct: number }>;
};

export const normalizeBrand = (name?: string) => String(name || 'NOIR ATELIER').trim().toUpperCase();
export const resolveBuyerKey = (email?: string | null, id?: string | null) =>
  String(email || id || 'default_buyer').trim().toLowerCase();

export type EscrowBucket = 'cancelled' | 'realized' | 'frozen' | 'locked';

// Single mutually-exclusive escrow classifier: every order lands in exactly one
// wallet bucket, evaluated in strict priority order (cancelled > frozen > locked > realized).
// A 'processing'/'locked' order can never be classified as 'realized'.
export function classifyOrderEscrow(order: Order, disputes?: DisputeRow[]): EscrowBucket {
  const rec = order as unknown as Record<string, unknown>;
  const matchedDispute = disputes?.find((d) => String(d.order_id) === String(order.id));
  const status = String(order.status ?? rec.order_status ?? rec.delivery_status ?? '').trim().toLowerCase();
  const orderStatusOnly = String(rec.order_status ?? '').trim().toLowerCase();
  const deliveryStatus = String(rec.delivery_status ?? '').trim().toLowerCase();
  const escrow = String(order.escrowStatus ?? rec.escrow_status ?? '').trim().toLowerCase();
  const dStatus = String(matchedDispute?.status ?? order.disputeStatus ?? order.dispute_status ?? rec.dispute_status ?? 'none').trim().toLowerCase();
  const isDelivered = rec.is_delivered === true || order.isDelivered === true ||
    status === 'delivered' || orderStatusOnly === 'delivered' || deliveryStatus === 'delivered';

  if (
    ['refunded', 'cancelled'].includes(status) ||
    ['refunded', 'cancelled'].includes(orderStatusOnly) ||
    ['refunded', 'cancelled'].includes(escrow) ||
    ['resolved_refunded', 'refunded', 'closed_cancelled'].includes(dStatus)
  ) {
    return 'cancelled';
  }
  if (
    ['open', 'resolution_proposed'].includes(dStatus) ||
    (status === 'disputed' && !['resolved_reshipped', 'resolved_released', 'resolved_refunded'].includes(dStatus))
  ) {
    return 'frozen';
  }
  if (
    isDelivered || escrow === 'released' ||
    dStatus === 'resolved_released' || dStatus === 'resolved_completed'
  ) {
    return 'realized';
  }
  // Everything else (processing, pending, shipped, reshipped, escrow locked)
  // stays in LOCKED IN ESCROW.
  return 'locked';
}

export function orderEscrowBounty(order: Order): number {
  const rec = order as unknown as Record<string, unknown>;
  const bounty = Number(rec.bounty_amount ?? order.bountyAmount ?? 0);
  return Number.isFinite(bounty) ? bounty : 0;
}

export const H24 = 24 * 60 * 60 * 1000;
export const H72 = 72 * 60 * 60 * 1000;
export const H168 = 168 * 60 * 60 * 1000;

export const getActiveWaveOrders = (wave: SyndicateWave, allOrders: Order[]): Order[] =>
  (wave.orderIds ?? []).length === 0
    ? []
    : allOrders.filter((order) => (wave.orderIds ?? []).includes(order.id) && order.status !== 'cancelled' && order.status !== 'refunded');

const FALLBACK_TIER: SyndicateTier = { tierNumber: 1, thresholdUnits: 1, bountyPercent: 10 };

export const getCurrentWaveTier = (wave: SyndicateWave, activeCount: number): SyndicateTier => {
  const tiers = wave.tiers ?? [];
  if (tiers.length === 0) return FALLBACK_TIER;
  const sortedTiers = [...tiers].sort((a, b) => b.thresholdUnits - a.thresholdUnits);
  return sortedTiers.find((tier) => activeCount >= tier.thresholdUnits) ?? tiers[0];
};

export function getPitchTierStatus(pitch: Pitch): PitchTierStatus {
  const elapsed = Date.now() - new Date(pitch.createdAt).getTime();

  const tier1 = Number(pitch.bountyAmount || 700);
  const standard = Number(pitch.baselineBounty || Math.round(tier1 / 2));
  const tier2 = Math.round((tier1 + standard) / 2);
  const tier3 = Math.round((tier2 + standard) / 2);

  if (elapsed <= H24) {
    return {
      tierNumber: 1,
      tierName: 'Peak VIP (100% Boost)',
      currentBounty: tier1,
      nextTierBounty: tier2,
      msRemainingInTier: H24 - elapsed,
      nextTierLabel: 'Drops to Tier 2 in',
    };
  } else if (elapsed <= H72) {
    return {
      tierNumber: 2,
      tierName: 'Tier 2 (Base + 2/3 Boost)',
      currentBounty: tier2,
      nextTierBounty: tier3,
      msRemainingInTier: H72 - elapsed,
      nextTierLabel: 'Drops to Tier 3 in',
    };
  } else if (elapsed <= H168) {
    return {
      tierNumber: 3,
      tierName: 'Tier 3 (Base + 1/3 Boost)',
      currentBounty: tier3,
      nextTierBounty: standard,
      msRemainingInTier: H168 - elapsed,
      nextTierLabel: 'Drops to Standard in',
    };
  } else {
    return {
      tierNumber: 4,
      tierName: 'Standard Bounty',
      currentBounty: standard,
      nextTierBounty: standard,
      msRemainingInTier: 0,
      nextTierLabel: 'Standard bounty active',
    };
  }
}

function enrichKeywords(product: {
  brandName: string;
  title: string;
  category: string;
  keywords: string[];
}): string[] {
  const words = new Set<string>();
  const addTokens = (s: string) => {
    const full = s.toLowerCase().trim();
    if (full) words.add(full);
    s.split(/\s+/).forEach((w) => {
      const cleaned = w.toLowerCase().trim();
      if (cleaned) words.add(cleaned);
    });
  };
  addTokens(product.brandName);
  addTokens(product.title);
  addTokens(product.category);
  product.keywords.forEach((k) => {
    const cleaned = k.toLowerCase().trim();
    if (cleaned) words.add(cleaned);
  });
  return Array.from(words);
}

function normalizeDbProduct(p: Record<string, unknown>): Product {
  const imageUrls = Array.isArray(p.image_urls) ? (p.image_urls as string[]) : [];
  const imageUrl = (p.image_url as string) || null;
  const images = imageUrls.length > 0 ? imageUrls : imageUrl ? [imageUrl] : [''];
  return {
    id: p.id as string,
    brandId: (p.brand_id as string | null) ?? null,
    brandName: (p.brand_name as string) || 'Unknown Brand',
    title: (p.name as string) || '',
    teaser: (p.description as string) || undefined,
    subcategory: (p.subcategory as string) || undefined,
    priceInr: Number(p.price) || 0,
    category: (p.category as string) || 'General',
    keywords: Array.isArray(p.keywords) ? (p.keywords as string[]) : [],
    images,
    primaryImageIndex: Number(p.primary_image_index) || 0,
    sizes: Array.isArray(p.sizes) ? (p.sizes as string[]) : [],
    colors: Array.isArray(p.colors) ? (p.colors as string[]) : [],
    colorHex: (p.color_hex as Record<string, string>) || {},
    autoBounty: Number(p.auto_bounty) || 0,
    variants: Array.isArray(p.variants) ? (p.variants as VariantStock[]) : [],
    isDraft: Boolean(p.is_draft),
    imageReviewBountyEnabled: Boolean(p.image_review_bounty_enabled),
    imageReviewBountyAmount: Number(p.image_review_bounty_amount) || 0,
    soldCount: Number(p.sold_count) || 0,
    stockQuantity: Number(p.stock_quantity) || 0,
    grossSales: Number(p.gross_sales) || 0,
    bountiesPaid: Number(p.bounties_paid) || 0,
    netRevenue: Number(p.net_revenue) || 0,
  };
}

function normalizeDbIntent(i: Record<string, unknown>): Intent {
  return {
    id: i.id as string,
    consumerEmail: (i.buyer_email as string) || '',
    searchQuery: (i.search_query as string) || (i.title as string) || '',
    status: ((i.status as string) === 'fulfilled' ? 'fulfilled' : 'active') as Intent['status'],
    createdAt: i.created_at ? new Date(i.created_at as string).getTime() : Date.now(),
    expiresAt: i.expires_at ? new Date(i.expires_at as string).getTime() : Date.now() + INTENT_TTL,
    productSnapshots: [],
  };
}

function normalizeDbAddress(a: Record<string, unknown>): Address {
  const addrLine = String(a.address_line ?? '');
  const parts = addrLine.split(',').map((s) => s.trim());
  return {
    id: a.id as string,
    consumerEmail: String(a.consumer_email ?? ''),
    fullName: String(a.full_name ?? ''),
    phone: String(a.phone ?? ''),
    pincode: String(a.pincode ?? ''),
    houseNo: parts[0] ?? '',
    area: parts[1] ?? '',
    landmark: parts[2] ?? '',
    city: String(a.city ?? ''),
    state: String(a.state ?? ''),
    addressType: (a.label as AddressType) ?? 'Home',
    isDefault: Boolean(a.is_default),
  };
}

function normalizeDbOrder(o: Record<string, unknown>): DbOrder {
  return {
    id: String(o.id ?? ''),
    buyerId: (o.buyer_id as string | null) ?? null,
    brandId: (o.brand_id as string | null) ?? null,
    waveId: (o.wave_id as string | null) ?? null,
    productId: String(o.product_id ?? ''),
    unitPrice: Number(o.unit_price) || 0,
    totalPrice: Number(o.total_price) || 0,
    status: String(o.status ?? 'processing'),
    productBounty: Number(o.product_bounty) || 0,
    syndicateTierUnlocked: Number(o.syndicate_tier_unlocked) || 1,
    hasImageBounty: Boolean(o.has_image_bounty),
    imageReviewBounty: Number(o.image_review_bounty) || 0,
    imageEscrowHeld: Boolean(o.image_escrow_held),
    reviewStatus: String(o.review_status ?? 'none'),
    reviewDeadline: o.review_deadline ? new Date(o.review_deadline as string).getTime() : null,
    createdAt: o.created_at ? new Date(o.created_at as string).getTime() : Date.now(),
    quantity: Number(o.quantity) || 1,
    productName: String(o.product_name ?? ''),
    brandName: String(o.brand_name ?? ''),
    bountyAmount: Number(o.bounty_amount) || 0,
    consumerEmail: String(o.consumer_email ?? ''),
    shippedAt: o.shipped_at ? new Date(o.shipped_at as string).getTime() : null,
    deliveredAt: o.delivered_at ? new Date(o.delivered_at as string).getTime() : null,
    isDisputed: Boolean(o.is_disputed),
    isDelivered: Boolean(o.is_delivered),
    disputeReason: String(o.dispute_reason ?? ''),
    disputeDescription: String(o.dispute_description ?? ''),
    disputeStatus: String(o.dispute_status ?? 'none'),
    escrowStatus: String(o.escrow_status ?? 'locked'),
    bountyStatus: String(o.bounty_status ?? 'locked'),
    brandResponse: (o.brand_response as string | null) ?? null,
    size: (o.size as string | null) ?? null,
    color: (o.color as string | null) ?? null,
    trackingNumber: (o.tracking_number as string | null) ?? null,
    disputeMessages: Array.isArray(o.dispute_messages) ? (o.dispute_messages as unknown[]).map((m) => normalizeDisputeMessage(m as Record<string, unknown>)) : [],
    returnStatus: (o.return_status as string | null) ?? null,
    returnTrackingNumber: (o.return_tracking_number as string | null) ?? null,
    tokenDiscountUsed: Number(o.token_discount_used) || 0,
    totalAmount: o.total_amount != null ? Number(o.total_amount) : null,
    cashback: Number(o.cashback) || 0,
  };
}

// Maps Supabase-backed DbOrder rows into the full Order shape the UI expects,
// filling in product info via lookup so cards render even when product data is partial.
function dbOrderToOrder(db: DbOrder, products: Product[], dispute?: DisputeRow): Order {
  const matchedProduct = products.find((p) => String(p.id) === String(db.productId));
  const productImage = matchedProduct?.images?.[0] ?? '';
  const productTitle = db.productName || matchedProduct?.title || 'Product';
  const brandName = db.brandName || matchedProduct?.brandName || 'NOIR ATELIER';
  const qty = Math.max(1, db.quantity);
  const priceInr = db.totalPrice || (db.unitPrice * qty);
  const unitProductBounty = db.productBounty || (matchedProduct?.autoBounty ?? 0);
  const unitImageReviewBounty = db.imageReviewBounty || 0;
  const productBountyTotal = unitProductBounty * qty;
  const imageReviewBountyTotal = unitImageReviewBounty * qty;
  const bountyAmount = db.bountyAmount;

  const rawStatus = (dispute?.status === 'open' || dispute?.status === 'pickup_scheduled' || dispute?.status === 'resolution_proposed') ? 'disputed' : db.status;
  let trackingStatus: TrackingStatus = 'Placed';
  if (db.isDelivered || rawStatus === 'delivered') trackingStatus = 'Delivered';
  else if (rawStatus === 'shipped' || db.shippedAt) trackingStatus = 'Dispatched';

  const orderStatus = (rawStatus === 'delivered' ? 'delivered'
    : rawStatus === 'shipped' ? 'shipped'
    : rawStatus === 'refunded' ? 'refunded'
    : rawStatus === 'cancelled' ? 'cancelled'
    : rawStatus === 'replacement_dispatched' ? 'replacement_dispatched'
    : 'placed') as OrderStatus;

  const resolvedDisputeStatus = String(dispute?.status || db.disputeStatus || 'none').toLowerCase();
  const disputeStatus = (resolvedDisputeStatus === 'none' || !resolvedDisputeStatus ? 'none' : resolvedDisputeStatus) as DisputeStatus;

  const escrowStatus = (db.escrowStatus === 'locked' ? 'locked'
    : db.escrowStatus === 'released' ? 'released'
    : db.escrowStatus === 'frozen' ? 'disputed'
    : db.escrowStatus === 'cancelled' ? 'refunded'
    : (dispute?.status === 'open' || dispute?.status === 'pickup_scheduled' || dispute?.status === 'resolution_proposed' || rawStatus === 'disputed') ? 'disputed'
    : 'locked') as EscrowStatus;

  const reviewStatusVal = (db.reviewStatus === 'none' ? 'none'
    : db.reviewStatus === 'pending' ? 'pending'
    : db.reviewStatus === 'uploaded' ? 'uploaded'
    : db.reviewStatus === 'expired' ? 'expired'
    : 'pending_upload') as ReviewStatus;

  const disputeMessages = ((dispute?.messages ?? db.disputeMessages ?? []) as unknown[]).map((m) => normalizeDisputeMessage(m as Record<string, unknown>));

  return {
    id: db.id,
    consumerEmail: db.consumerEmail,
    productId: db.productId,
    productTitle,
    brandName,
    priceInr,
    bountyAmount,
    quantity: qty,
    size: db.size ?? '',
    color: db.color ?? '',
    selectedSize: db.size ?? '',
    selectedColor: db.color ?? '',
    image: productImage,
    trackingStatus,
    trackingNumber: db.trackingNumber ?? db.id.slice(-8).toUpperCase(),
    status: (rawStatus === 'disputed' ? 'shipped' : orderStatus),
    timestamp: db.createdAt,
    disputeId: dispute?.id,
    disputeStatus,
    dispute_status: disputeStatus,
    disputeReason: dispute?.reason ?? (db.disputeReason || undefined),
    disputeDescription: dispute?.description ?? (db.disputeDescription || undefined),
    disputeMessages,
    escrowStatus,
    reviewStatus: reviewStatusVal,
    deliveredAt: db.deliveredAt ?? undefined,
    productBounty: productBountyTotal,
    imageReviewBounty: imageReviewBountyTotal,
    hasImageBounty: db.hasImageBounty,
    imageEscrowHeld: db.imageEscrowHeld,
    isSyndicateOrder: !!db.waveId,
    waveId: db.waveId ?? undefined,
    syndicateTierUnlocked: db.syndicateTierUnlocked,
    brandNetPayout: Math.max(0, priceInr - Math.round(priceInr * 0.05) - bountyAmount - imageReviewBountyTotal),
    platformFee: Math.round(priceInr * 0.05),
    refunded: rawStatus === 'refunded',
    bountyReleased: db.escrowStatus === 'released',
    brandPayoutReleased: db.escrowStatus === 'released',
    productBountyReleased: db.escrowStatus === 'released',
    escrowFrozen: dispute?.status === 'open' || dispute?.status === 'pickup_scheduled' || dispute?.status === 'resolution_proposed' || rawStatus === 'disputed',
    returnStatus: dispute?.return_status ?? (db as Record<string, unknown>).return_status as string | null ?? null,
    returnTrackingNumber: dispute?.return_tracking_number ?? (db as Record<string, unknown>).return_tracking_number as string | null ?? null,
    tokenDiscountUsed: db.tokenDiscountUsed,
    totalAmount: db.totalAmount,
  };
}

type DisputeRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string | null;
  brand_name: string | null;
  consumer_email: string | null;
  reason: string;
  description: string | null;
  status: string;
  resolution: string | null;
  messages: unknown;
  created_at: string | null;
  updated_at: string | null;
  return_status: string | null;
  return_tracking_number: string | null;
};

function normalizeDbDispute(d: Record<string, unknown>): DisputeRow {
  return {
    id: String(d.id ?? ''),
    order_id: String(d.order_id ?? ''),
    product_id: (d.product_id as string | null) ?? null,
    product_name: (d.product_name as string | null) ?? null,
    brand_name: (d.brand_name as string | null) ?? null,
    consumer_email: (d.consumer_email as string | null) ?? null,
    reason: String(d.reason ?? ''),
    description: (d.description as string | null) ?? null,
    status: String(d.status ?? 'open'),
    resolution: (d.resolution as string | null) ?? null,
    messages: d.messages ?? [],
    created_at: (d.created_at as string | null) ?? null,
    updated_at: (d.updated_at as string | null) ?? null,
    return_status: (d.return_status as string | null) ?? null,
    return_tracking_number: (d.return_tracking_number as string | null) ?? null,
  };
}

function normalizeDisputeMessage(m: Record<string, unknown>): DisputeMessage {
  const senderRaw = String(m.sender ?? m.senderRole ?? 'consumer');
  const senderRole = (senderRaw === 'brand' || senderRaw === 'admin' ? senderRaw : 'consumer') as DisputeMessage['senderRole'];
  const ts = m.timestamp ?? m.created_at;
  const timestamp = typeof ts === 'number' ? ts : (ts ? new Date(String(ts)).getTime() : Date.now());
  return {
    id: String(m.id ?? `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    senderRole,
    senderName: (m.senderName as string | undefined) ?? undefined,
    text: String(m.text ?? ''),
    images: Array.isArray(m.images) ? (m.images as string[]) : undefined,
    timestamp,
  };
}

function mergeDisputesIntoOrders(orders: Order[], disputes: DisputeRow[]): Order[] {
  const byOrderId = new Map<string, DisputeRow>();
  for (const d of disputes) byOrderId.set(String(d.order_id), d);
  return orders.map((o) => {
    const d = byOrderId.get(String(o.id));
    if (!d) return o;
    const messages = Array.isArray(d.messages) ? (d.messages as unknown[]).map((m) => normalizeDisputeMessage(m as Record<string, unknown>)) : [];
    const ds = String(d.status || 'none').toLowerCase() as DisputeStatus;
    const isResolved = isDisputeResolved(ds);
    const isActive = ds === 'open' || ds === 'pickup_scheduled' || ds === 'resolution_proposed' || ds === 'opened_under_review' || ds === 'escalated';
    return {
      ...o,
      disputeId: d.id,
      disputeStatus: ds,
      dispute_status: ds,
      disputeReason: d.reason || o.disputeReason,
      disputeDescription: d.description ?? o.disputeDescription,
      disputeMessages: messages.length > 0 ? messages : o.disputeMessages,
      escrowFrozen: isResolved ? false : (isActive ? true : o.escrowFrozen),
      escrowStatus: isResolved
        ? (ds === 'resolved_refunded' ? ('refunded' as EscrowStatus)
          : ds === 'resolved_released' || ds === 'resolved_completed' ? ('released' as EscrowStatus)
          : o.escrowStatus)
        : (isActive ? ('disputed' as EscrowStatus) : o.escrowStatus),
      status: isResolved
        ? (ds === 'resolved_refunded' ? ('refunded' as OrderStatus)
          : ds === 'resolved_released' || ds === 'resolved_completed' ? ('delivered' as OrderStatus)
          : ds === 'resolved_reshipped' ? ('shipped' as OrderStatus)
          : o.status)
        : (isActive ? ('shipped' as OrderStatus) : o.status),
      refunded: ds === 'resolved_refunded' ? true : o.refunded,
      returnStatus: d.return_status ?? o.returnStatus,
      returnTrackingNumber: d.return_tracking_number ?? o.returnTrackingNumber,
    } as Order;
  });
}

function normalizeDbPitch(p: Record<string, unknown>): Pitch {
  return {
    id: p.id as string,
    intentId: p.intent_id as string,
    consumerEmail: (p.consumer_email as string) || '',
    productId: String(p.product_id ?? ''),
    productTitle: (p.product_title as string) || '',
    brandName: (p.brand_name as string) || '',
    productImage: (p.product_image as string) || '',
    originalPrice: Number(p.original_price) || 0,
    bountyAmount: Number(p.bounty_amount) || 0,
    status: (p.status as Pitch['status']) || 'active',
    createdAt: p.created_at as string,
    offeredPrice: p.offer_price != null ? Number(p.offer_price) : undefined,
    baselinePrice: p.baseline_price != null ? Number(p.baseline_price) : undefined,
    baselineBounty: p.baseline_bounty != null ? Number(p.baseline_bounty) : undefined,
    offeredSizes: Array.isArray(p.offered_sizes) ? (p.offered_sizes as string[]) : [],
    offeredColors: Array.isArray(p.offered_colors) ? (p.offered_colors as string[]) : [],
    isVip: Boolean(p.is_vip),
  };
}

function normalizeDbDailyAnalytics(r: Record<string, unknown>): DailyAnalytics {
  return {
    analyticsDate: String(r.analytics_date ?? ''),
    productId: String(r.product_id ?? ''),
    grossRevenue: Number(r.gross_revenue) || 0,
    bountiesPaid: Number(r.bounties_paid) || 0,
    netMargin: Number(r.net_margin) || 0,
    ordersCount: Number(r.orders_count) || 0,
    unitsSold: Number(r.units_sold) || 0,
  };
}

function normalizeDbBrandToken(r: Record<string, unknown>): BrandToken {
  return {
    id: String(r.id ?? ''),
    consumerEmail: String(r.consumer_email ?? ''),
    brandName: normalizeBrand(r.brand_name as string | undefined),
    principalBoosted: Number(r.principal_boosted) || 0,
    bonusEarned: Number(r.bonus_earned) || 0,
    totalCreditMinted: Number(r.total_credit_minted) || 0,
    creditSpent: Number(r.credit_spent) || 0,
    availableCredit: Number(r.available_credit ?? r.availableCredit ?? r.balance ?? 0) || 0,
    updatedAt: r.updated_at ? new Date(r.updated_at as string).getTime() : Date.now(),
  };
}

function normalizeTokenSettings(
  rows: Record<string, unknown>[] | null | undefined,
): Record<string, { tokens_enabled: boolean; max_redemption_pct: number }> {
  const map: Record<string, { tokens_enabled: boolean; max_redemption_pct: number }> = {};
  for (const r of rows ?? []) {
    map[normalizeBrand(String(r.brand_name ?? ''))] = {
      tokens_enabled: r.tokens_enabled === undefined ? true : Boolean(r.tokens_enabled),
      max_redemption_pct: Number(r.max_redemption_pct) || 100,
    };
  }
  return map;
}

function normalizeDbWalletTxn(r: Record<string, unknown>): WalletTxn {
  return {
    id: String(r.id ?? ''),
    consumerEmail: String(r.consumer_email ?? ''),
    txType: (r.tx_type as WalletTxn['txType']) ?? 'upi_withdrawal',
    brandName: (r.brand_name as string | null) ?? null,
    cashAmount: Number(r.cash_amount) || 0,
    bonusAmount: Number(r.bonus_amount) || 0,
    creditAmount: Number(r.credit_amount) || 0,
    upiId: (r.upi_id as string | null) ?? null,
    orderId: (r.order_id as string | null) ?? null,
    createdAt: r.created_at ? new Date(r.created_at as string).getTime() : Date.now(),
  };
}

const SEED_ORDERS: Order[] = [];
const SEED_SYNDICATE_WAVES: SyndicateWave[] = [];
const SEED_SALES: SalesRecord[] = [];
const SEED_REVIEWS: Review[] = [];
const SEED_BRAND_RECORDS: BrandRecord[] = [];

const DEFAULT_STATE: MarketState = {
  session: { role: null, email: '', isVerified: false },
  authLoading: true,
  authUser: null,
  authProfile: null,
  consumerWallet: { lockedEscrow: 0, withdrawable: 500000 },
  brandWallet: { globalBudget: 500000 },
  brandProfile: {
    isCorporateVerified: false,
    legalCorporateName: '',
    trademarkId: '',
    dunsNumber: '',
    displayName: '',
    gstin: '',
    gstinVerified: false,
    middeskVerified: false,
    stripeConnected: false,
    stripeAccountLast4: '',
  },
  products: [],
  intents: [],
  salesAnalytics: SEED_SALES,
  reviews: SEED_REVIEWS,
  orders: SEED_ORDERS,
  campaigns: [],
  pitches: [],
  keywordAlerts: [],
  bagItems: [],
  toasts: [],
  addresses: [],
  notifications: [],
  walletTransactions: [],
  brandRecords: SEED_BRAND_RECORDS,
  brandCredits: [],
  brandBountyPool: [],
  platformRevenue: 0,
  brandWalletBalance: 0,
  mainEscrowBalance: 0,
  syndicateWaves: SEED_SYNDICATE_WAVES,
  dbOrders: [],
  dailyAnalytics: [],
  brandTokens: [],
  walletTxns: [],
  brandTokenSettings: {},
  disputes: [],
};

type MarketContextValue = MarketState & {
  availableBalance: number;
  realizedBounties: number;
  lockedInEscrow: number;
  frozenInDispute: number;
  totalPrincipalBoosted: number;
  totalUpiPayouts: number;
  signIn: (role: 'consumer' | 'brand', email: string) => void;
  verifyConsumer: () => void;
  signOut: () => void;
  supabaseSignIn: (email: string, password: string) => Promise<{ error: string | null }>;
  supabaseSignUp: (email: string, password: string, displayName: string, role: 'buyer' | 'brand') => Promise<{ error: string | null }>;
  supabaseSignOut: () => Promise<void>;
  addProduct: (product: Omit<Product, 'id'>) => Promise<{ error: string | null; product: Product | null }>;
  removeProduct: (productId: string) => Promise<void>;
  updateProduct: (productId: string, updates: Partial<Omit<Product, 'id'>>) => void;
  toggleImageReviewBounty: (productId: string, enabled: boolean, amount?: number) => void;
  addCampaign: (campaign: Omit<Campaign, 'id' | 'createdAt'>) => void;
  removeCampaign: (campaignId: string) => void;
  launchVIPPitch: (pitch: {
    intentId: string;
    productId: string;
    productTitle: string;
    brandName: string;
    productImage: string;
    originalPrice: number;
    bountyAmount: number;
    offeredSizes?: string[];
    offeredColors?: string[];
  }) => void;
  acceptPitch: (pitchId: string) => void;
  acceptPitchWithOrder: (pitchId: string, addressId?: string, selectedSize?: string, selectedColor?: string, appliedBrandCredit?: number) => void;
  declinePitch: (pitchId: string) => void;
  openDispute: (orderId: string, reason: string, evidenceImages?: string[]) => void;
  raiseDispute: (orderId: string, reason: string, evidenceImages?: string[]) => void;
  escalateDispute: (orderId: string) => void;
  addKeywordAlert: (keyword: string) => void;
  removeKeywordAlert: (alertId: string) => void;
  addToBag: (item: Omit<BagItem, 'id'>) => void;
  removeFromBag: (itemId: string) => void;
  updateBagQuantity: (itemId: string, qty: number) => void;
  clearBag: () => void;
  checkoutBag: (addressId: string, appliedBrandCredits?: Record<string, number>) => void;
  markShipped: (orderId: string, courier: Courier, trackingNumber: string) => void;
  resolveDispute: (orderId: string) => void;
  resolveDisputeByAdmin: (orderId: string, decision: AdminDisputeDecision, adminNotes: string) => void;
  addDisputeMessage: (orderId: string, text: string, images?: string[]) => void;
  addConsumerDisputeMessage: (orderId: string, text: string, images?: string[]) => void;
  reshipOrder: (orderId: string, courier: Courier, trackingNumber: string) => void;
  refundOrderFromBrand: (orderId: string) => void;
  approveRefundFromBrand: (orderId: string, resolutionNote?: string) => void;
  scheduleDoorstepPickupFromBrand: (orderId: string) => void;
  verifyDoorstepQCAndRefundFromBrand: (orderId: string) => void;
  dismissDisputeFromBrand: (orderId: string, resolutionNote?: string) => void;
  reshipOrderFromBrand: (
    orderId: string,
    details: {
      carrier: string;
      trackingNumber: string;
      estimatedDelivery?: number;
      returnOldItemRequired?: boolean;
    },
  ) => void;
  fullRefundOrder: (orderId: string) => void;
  deleteSalesRecord: (recordId: string) => void;
  verifyGstin: (gstin: string) => void;
  setMiddeskVerified: () => void;
  connectStripe: (last4: string) => void;
  canSendPitchForProduct: (productId: string) => boolean;
  addIntent: (
    intent: Omit<Intent, 'id' | 'status' | 'createdAt' | 'consumerEmail' | 'expiresAt' | 'productSnapshots'>,
  ) => Promise<Intent>;
  removeIntent: (intentId: string) => Promise<void>;
  extendIntent: (intentId: string) => void;
  fulfillIntent: (intentId: string, product: Product, size: string, color: string, addressId?: string, appliedBrandCredit?: number) => void;
  placeDirectOrder: (product: Product, size: string, color: string, addressId?: string, appliedBrandCredit?: number) => void;
  verifyBrand: (data?: {
    legalCorporateName?: string;
    trademarkId?: string;
    dunsNumber?: string;
  }) => void;
  addReview: (review: Omit<Review, 'id' | 'timestamp'>) => Promise<Review | null>;
  addAddress: (address: Omit<Address, 'id' | 'consumerEmail'>) => Promise<Address>;
  updateAddress: (addressId: string, updates: Partial<Omit<Address, 'id' | 'consumerEmail'>>) => Promise<void>;
  saveAddress: (address: Omit<Address, 'id' | 'consumerEmail'> & { id?: string }) => Promise<Address>;
  removeAddress: (addressId: string) => Promise<void>;
  setDefaultAddress: (addressId: string) => Promise<void>;
  advanceOrderStatus: (orderId: string) => void;
  confirmDelivery: (orderId: string) => void;
  pushToast: (type: Toast['type'], message: string) => void;
  dismissToast: (toastId: string) => void;
  pushNotification: (n: Omit<AppNotification, 'id' | 'timestamp' | 'read' | 'consumerEmail'>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  removeNotification: (id: string) => void;
  withdrawCash: (amount: number) => void;
  convertCashToBrandCredit: (brandId: string, brandName: string, cashAmount: number) => void;
  convertBountyToBrandCredit: (brandId: string, convertAmount: number) => void;
  applyBrandCredit: (brandId: string, amount: number) => void;
  adminForceRefund: (orderId: string) => void;
  adminForceRelease: (orderId: string) => void;
  setBrandStatus: (brandId: string, status: BrandStatus) => void;
  submitReviewWithBounty: (review: Omit<Review, 'id' | 'timestamp'>, orderId: string, bountyAmount: number) => void;
  cancelFailedDelivery: (orderId: string, cancelReason: string, notes: string) => void;
  expireUnclaimedReview: (orderId: string) => void;
  acceptProposedResolution: (orderId: string) => void;
  rejectProposedResolution: (orderId: string) => void;
  simulateDoorstepQCPass: (orderId: string) => void;
  createSyndicateWave: (params: {
    productId: string;
    brandId: string;
    tiers: SyndicateTier[];
    durationMs: number;
    hasImageBounty: boolean;
    imageBountyAmount: number;
  }) => Promise<string>;
  refreshSyndicateWaves: () => Promise<void>;
  refreshDbOrders: () => Promise<void>;
  refreshDailyAnalytics: () => Promise<void>;
  refreshBrandTokensAndWalletTxns: () => Promise<void>;
  refreshAllMarketData: () => Promise<void>;
  boostBrandToken: (brandName: string, principalAmount: number) => Promise<void>;
  processUpiWithdrawal: (upiId: string, amount: number) => Promise<void>;
  spendBrandToken: (brandName: string, creditAmount: number, orderId: string) => Promise<void>;
  toggleBrandTokens: (brandName: string, enabled: boolean) => Promise<void>;
  convertBountyToBrandToken: (brandName: string, principalAmount: number) => Promise<void>;
  redeemBrandTokens: (brandName: string, amountUsed: number) => Promise<void>;
};

const MarketContext = createContext<MarketContextValue | null>(null);

function normalizeProductBounties(productsList: Product[]): Product[] {
  return productsList.map((p) => {
    const minProductBounty = Math.ceil(p.priceInr * 0.05);
    if (!p.autoBounty || p.autoBounty < minProductBounty) {
      return { ...p, autoBounty: minProductBounty };
    }
    return p;
  });
}

type ToastFn = (type: Toast['type'], message: string) => void;

const recentSoldIncrements = new Map<string, number>();

function setProductSoldCount(products: Product[], productId: string, newSold: number): Product[] {
  return products.map((p) =>
    p.id === productId ? { ...p, soldCount: newSold } : p,
  );
}

function setProductStock(products: Product[], productId: string, newStock: number, size?: string, color?: string): Product[] {
  return products.map((p) => {
    if (p.id !== productId) return p;
    const updatedStock = Math.max(0, newStock);
    if (size && color) {
      return {
        ...p,
        stockQuantity: updatedStock,
        variants: p.variants.map((v) =>
          v.size === size && v.color === color
            ? { ...v, stock: Math.max(0, v.stock - 1), outOfStock: v.stock - 1 <= 0 }
            : v,
        ),
      };
    }
    return { ...p, stockQuantity: updatedStock };
  });
}

async function syncStockToSupabase(
  productId: string,
  qty: number,
  toast: ToastFn,
  size?: string,
  color?: string,
): Promise<number | null> {
  const safeQty = Math.max(1, Number(qty) || 1);
  const { data: prod, error: fetchErr } = await supabase
    .from('products')
    .select('stock_quantity, variants')
    .eq('id', productId)
    .single();
  if (fetchErr) return null;
  const currentStock = Number(prod?.stock_quantity ?? 0);
  const newStock = Math.max(0, currentStock - safeQty);
  const updatePayload: Record<string, unknown> = { stock_quantity: newStock };
  if (size && color && Array.isArray(prod?.variants)) {
    const variants = (prod!.variants as VariantStock[]).map((v) =>
      v.size === size && v.color === color
        ? { ...v, stock: Math.max(0, (Number(v.stock) || 0) - safeQty), outOfStock: (Number(v.stock) || 0) - safeQty <= 0 }
        : v,
    );
    updatePayload.variants = variants;
  }
  const { error: updateErr } = await supabase
    .from('products')
    .update(updatePayload)
    .eq('id', productId);
  if (updateErr) {
    toast('error', `[Stock Update Error]: ${updateErr.message}`);
    return null;
  }
  return newStock;
}

async function syncSoldCountToSupabase(
  productId: string,
  qty: number,
  toast: ToastFn,
): Promise<number | null> {
  const now = Date.now();
  const last = recentSoldIncrements.get(productId);
  if (last && now - last < 3000) return null;
  recentSoldIncrements.set(productId, now);
  const safeQty = Math.max(1, Number(qty) || 1);
  const { data: currentProd, error: fetchError } = await supabase
    .from('products')
    .select('sold_count, price, auto_bounty')
    .eq('id', productId)
    .single();
  if (fetchError) return null;
  const currentCount = Number(currentProd?.sold_count ?? 0);
  const unitPrice = Number(currentProd?.price ?? 0);
  const unitBounty = Number(currentProd?.auto_bounty ?? 0);
  const newSold = currentCount + safeQty;
  const newGrossSales = newSold * unitPrice;
  const newBountiesPaid = newSold * unitBounty;
  const newNetRevenue = newGrossSales - newBountiesPaid;
  const { error } = await supabase
    .from('products')
    .update({
      sold_count: newSold,
      gross_sales: newGrossSales,
      bounties_paid: newBountiesPaid,
      net_revenue: newNetRevenue,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId);
  if (error) {
    toast('error', `[DB Sales Update Error]: ${error.message}`);
    return null;
  }
  return newSold;
}

type InsertOrderParams = {
  id: string;
  productId: string;
  productTitle: string;
  brandName: string;
  brandId: string | null;
  buyerId: string | null;
  consumerEmail: string;
  unitPrice: number;
  quantity: number;
  productBounty: number;
  imageReviewBounty?: number;
  size?: string;
  color?: string;
  trackingNumber?: string;
  hasImageBounty?: boolean;
  isSyndicateOrder?: boolean;
  waveId?: string;
  syndicateTierUnlocked?: number;
  reviewStatus?: string;
  storeCreditUsed?: number;
  netCashPaid?: number;
  toast: ToastFn;
};

const isValidUUID = (id: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || ''));

async function insertOrderToSupabase(params: InsertOrderParams): Promise<void> {
  const qty = Math.max(1, Number(params.quantity) || 1);
  const unitPrice = Number(params.unitPrice) || 0;
  const totalPrice = unitPrice * qty;
  const productBounty = Number(params.productBounty) || 0;
  const imageReviewBounty = Number(params.imageReviewBounty ?? 0) || 0;
  const totalBounty = (productBounty + imageReviewBounty) * qty;
  const payload = {
    id: params.id,
    product_id: String(params.productId),
    product_name: params.productTitle,
    brand_name: params.brandName,
    buyer_id: params.buyerId ?? null,
    brand_id: params.brandId ?? null,
    wave_id: params.waveId ?? null,
    consumer_email: params.consumerEmail ?? null,
    user_id: resolveBuyerKey(params.consumerEmail, params.buyerId),
    quantity: qty,
    unit_price: unitPrice,
    total_price: totalPrice,
    status: 'processing',
    product_bounty: productBounty,
    bounty_amount: totalBounty,
    syndicate_tier_unlocked: params.syndicateTierUnlocked ?? 1,
    has_image_bounty: Boolean(params.hasImageBounty),
    image_review_bounty: imageReviewBounty,
    image_escrow_held: Boolean(params.hasImageBounty),
    review_status: params.reviewStatus ?? 'none',
    escrow_status: 'locked',
    bounty_status: 'locked',
    is_delivered: false,
    is_disputed: false,
    dispute_status: 'none',
    size: params.size ?? null,
    color: params.color ?? null,
    tracking_number: params.trackingNumber ?? null,
    store_credit_used: Number(params.storeCreditUsed ?? 0) || 0,
    net_cash_paid: params.netCashPaid != null ? Number(params.netCashPaid) : null,
    total_amount: params.netCashPaid != null ? Number(params.netCashPaid) : totalPrice,
    cashback: totalBounty,
    token_discount_used: Number(params.storeCreditUsed ?? 0) || 0,
    dispute_resolved: false,
  };
  const { error } = await supabase.from('orders').insert(payload);
  if (error) {
    params.toast('error', `[DB Order Error]: ${error.message} (${error.code ?? 'unknown'})`);
  }
}

async function syncOrderStatusToSupabase(
  orderId: string,
  update: Record<string, unknown>,
  toast: ToastFn,
): Promise<void> {
  if (!orderId) return;
  const { error } = await supabase.from('orders').update(update).eq('id', String(orderId));
  if (error) {
    toast('error', `[DB Order Sync Error]: ${error.message}`);
  }
}

async function syncDisputeToSupabase(
  orderId: string,
  reason: string,
  description: string,
  order: { productId: string; productTitle: string; brandName: string; consumerEmail: string; quantity?: number; priceInr: number; bountyAmount: number },
  toast: ToastFn,
): Promise<void> {
  if (!orderId) return;
  const initialMessages = [
    {
      id: `msg-${Date.now()}`,
      sender: 'buyer',
      text: description ? `${reason}: ${description}` : reason,
      timestamp: new Date().toISOString(),
    },
  ];
  await supabase.from('orders').update({
    status: 'disputed',
    order_status: 'disputed',
    delivery_status: 'disputed',
    is_disputed: true,
    dispute_status: 'open',
    dispute_reason: reason,
    dispute_description: description,
    dispute_messages: initialMessages,
    escrow_status: 'frozen',
    bounty_status: 'frozen',
    disputed_at: new Date().toISOString(),
    consumer_email: order.consumerEmail,
  }).eq('id', String(orderId));

  const { error } = await supabase.from('disputes').upsert({
    order_id: String(orderId),
    product_id: String(order.productId),
    product_name: order.productTitle,
    brand_name: order.brandName,
    consumer_email: order.consumerEmail,
    quantity: Number(order.quantity ?? 1),
    amount: Number(order.priceInr),
    bounty_amount: Number(order.bountyAmount),
    reason,
    description: description || '',
    status: 'open',
    messages: initialMessages,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'order_id' });
  if (error) {
    toast('error', `[DB Dispute Upsert Error]: ${error.message}`);
  }
}

// While a dispute mutation is being written to the database, background
// polling must not overwrite local state with the stale pre-mutation rows.
let disputeMutationInFlight = false;

async function syncDisputeResolutionToSupabase(
  orderId: string,
  resolution: 'resolved_refunded' | 'resolved_completed' | 'resolved_reshipped' | 'resolved_released' | 'pickup_scheduled' | 'resolution_proposed' | 'open',
  brandResponse: string,
  toast: ToastFn,
  extraDisputeUpdates?: Record<string, unknown>,
  extraOrderUpdates?: Record<string, unknown>,
): Promise<void> {
  if (!orderId) return;
  disputeMutationInFlight = true;
  try {
    const nowIso = new Date().toISOString();
    const orderUpdate: Record<string, unknown> = {
      dispute_status: resolution,
      brand_response: brandResponse,
      resolved_at: nowIso,
      updated_at: nowIso,
    };
    if (resolution === 'resolved_refunded') {
      orderUpdate.is_disputed = false;
      orderUpdate.status = 'refunded';
      orderUpdate.order_status = 'refunded';
      orderUpdate.delivery_status = 'refunded';
      orderUpdate.escrow_status = 'cancelled';
      orderUpdate.bounty_status = 'cancelled';
    } else if (resolution === 'resolved_reshipped') {
      orderUpdate.is_disputed = false;
      orderUpdate.dispute_resolved = true;
      orderUpdate.dispute_status = 'resolved_reshipped';
      orderUpdate.status = 'processing';
      orderUpdate.order_status = 'processing';
      orderUpdate.delivery_status = 'processing';
      orderUpdate.is_delivered = false;
      orderUpdate.buyer_confirmed_delivery = false;
      orderUpdate.escrow_status = 'locked';
      orderUpdate.bounty_status = 'locked';
    } else if (resolution === 'resolved_released' || resolution === 'resolved_completed') {
      orderUpdate.is_disputed = false;
      orderUpdate.status = 'delivered';
      orderUpdate.order_status = 'delivered';
      orderUpdate.delivery_status = 'delivered';
      orderUpdate.is_delivered = true;
      orderUpdate.buyer_confirmed_delivery = true;
      orderUpdate.escrow_status = 'released';
      orderUpdate.bounty_status = 'released';
      orderUpdate.delivered_at = nowIso;
    } else if (resolution === 'pickup_scheduled') {
      orderUpdate.is_disputed = true;
      orderUpdate.status = 'disputed';
      orderUpdate.order_status = 'disputed';
      orderUpdate.delivery_status = 'disputed';
      orderUpdate.escrow_status = 'frozen';
      orderUpdate.bounty_status = 'frozen';
      orderUpdate.dispute_resolved = false;
    } else if (resolution === 'resolution_proposed') {
      orderUpdate.is_disputed = true;
      orderUpdate.status = 'disputed';
      orderUpdate.order_status = 'disputed';
      orderUpdate.delivery_status = 'disputed';
      orderUpdate.escrow_status = 'frozen';
      orderUpdate.bounty_status = 'frozen';
      orderUpdate.dispute_resolved = false;
    } else if (resolution === 'open') {
      orderUpdate.is_disputed = true;
      orderUpdate.status = 'disputed';
      orderUpdate.order_status = 'disputed';
      orderUpdate.delivery_status = 'disputed';
      orderUpdate.escrow_status = 'frozen';
      orderUpdate.bounty_status = 'frozen';
    }
    if (extraOrderUpdates) Object.assign(orderUpdate, extraOrderUpdates);
    const { error: orderError } = await supabase.from('orders').update(orderUpdate).eq('id', String(orderId));
    if (orderError) {
      console.error('[DB orders resolution update failed]:', orderError.message);
      toast('error', `Database update failed: ${orderError.message}`);
    }
    const disputeUpdate: Record<string, unknown> = {
      status: resolution,
      resolution: brandResponse,
      updated_at: nowIso,
    };
    if (resolution === 'resolved_reshipped') disputeUpdate.resolution_type = 'reship';
    if (extraDisputeUpdates) Object.assign(disputeUpdate, extraDisputeUpdates);
    const { data: updatedDisputes, error: disputeError } = await supabase.from('disputes')
      .update(disputeUpdate)
      .eq('order_id', String(orderId))
      .select('id');
    if (disputeError) {
      console.error('[DB disputes resolution update failed]:', disputeError.message);
      toast('error', `Database update failed: ${disputeError.message}`);
    } else if (!updatedDisputes || updatedDisputes.length === 0) {
      // No dispute row existed for this order yet — insert one instead of
      // silently updating zero rows.
      const { error: upsertError } = await supabase.from('disputes')
        .upsert(
          {
            order_id: String(orderId),
            reason: brandResponse || 'Dispute resolution',
            status: resolution,
            resolution: brandResponse,
            updated_at: nowIso,
          },
          { onConflict: 'order_id' },
        );
      if (upsertError) {
        console.error('[DB disputes resolution upsert failed]:', upsertError.message);
        toast('error', `Database update failed: ${upsertError.message}`);
      }
    }
  } finally {
    disputeMutationInFlight = false;
  }
}

async function syncDisputeMessagesToSupabase(
  orderId: string,
  messages: DisputeMessage[],
  toast: ToastFn,
): Promise<void> {
  if (!orderId) return;
  const serialized = messages.map((m) => ({
    id: m.id,
    sender: m.senderRole,
    text: m.text,
    timestamp: new Date(m.timestamp).toISOString(),
    images: m.images ?? [],
    senderName: m.senderName ?? null,
  }));
  await supabase.from('disputes')
    .update({ messages: serialized, updated_at: new Date().toISOString() })
    .eq('order_id', String(orderId));
  const { error } = await supabase.from('orders')
    .update({ dispute_messages: serialized })
    .eq('id', String(orderId));
  if (error) {
    toast('error', `[DB Dispute Message Sync Error]: ${error.message}`);
  }
}

function appendSystemMessage(existing: DisputeMessage[], text: string): DisputeMessage[] {
  const sysMsg: DisputeMessage = {
    id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    senderRole: 'brand',
    text,
    timestamp: Date.now(),
  };
  return [...existing, sysMsg];
}

function deleteIntentsFromSupabase(intentIds: string[]): void {
  if (intentIds.length === 0) return;
  supabase
    .from('buyer_intents')
    .delete()
    .in('id', intentIds)
    .then();
}

function loadState(): MarketState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    window.localStorage.removeItem('syndicate_waves');
    window.localStorage.removeItem('shadowmarket_waves');
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<MarketState>;
    const products: Product[] = [];
    return {
      ...DEFAULT_STATE,
      ...parsed,
      authUser: null,
      authProfile: null,
      consumerWallet: {
        lockedEscrow: parsed.consumerWallet?.lockedEscrow ?? 0,
        withdrawable: parsed.consumerWallet?.withdrawable ?? 0,
      },
      products,
      brandProfile: {
        ...DEFAULT_STATE.brandProfile,
        ...(parsed.brandProfile ?? {}),
      },
      salesAnalytics: parsed.salesAnalytics ?? [],
      reviews:
        parsed.reviews && parsed.reviews.length > 0
          ? parsed.reviews
          : DEFAULT_STATE.reviews,
      orders: [],
      campaigns: parsed.campaigns ?? [],
      pitches: [],
      intents: [],
      keywordAlerts: parsed.keywordAlerts ?? [],
      bagItems: parsed.bagItems ?? [],
      toasts: [],
      addresses: parsed.addresses ?? [],
      notifications: parsed.notifications ?? [],
      walletTransactions: parsed.walletTransactions ?? [],
      brandRecords: parsed.brandRecords ?? DEFAULT_STATE.brandRecords,
      brandCredits: parsed.brandCredits ?? [],
      brandBountyPool: parsed.brandBountyPool ?? [],
      platformRevenue: parsed.platformRevenue ?? 0,
      brandWalletBalance: parsed.brandWalletBalance ?? 0,
      mainEscrowBalance: parsed.mainEscrowBalance ?? 0,
      syndicateWaves: [],
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeTrackingNumber(): string {
  return `SM${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

function addOrderToActiveWave(waves: SyndicateWave[], orders: Order[], order: Order): { waves: SyndicateWave[]; orders: Order[]; upgradeTxs: WalletTransaction[] } {
  const wave = waves.find((candidate) => candidate.status === 'active' && candidate.productId === order.productId && Date.now() < candidate.startTime + candidate.durationMs);
  const allOrders = orders.some((o) => o.id === order.id) ? orders : [order, ...orders];
  if (!wave) return { waves, orders: allOrders, upgradeTxs: [] };
  const nextWaves = waves.map((candidate) => candidate.id === wave.id
    ? { ...candidate, orderIds: candidate.orderIds.includes(order.id) ? candidate.orderIds : [...candidate.orderIds, order.id] }
    : candidate);
  const updatedWave = nextWaves.find((candidate) => candidate.id === wave.id) ?? wave;
  const activeOrders = getActiveWaveOrders(updatedWave, allOrders);
  const tier = getCurrentWaveTier(updatedWave, activeOrders.length);
  const bounty = Math.round(updatedWave.productPrice * (tier.bountyPercent / 100));
  const now = Date.now();
  const upgradeTxs: WalletTransaction[] = [];
  const updatedOrders = allOrders.map((candidate) => {
    if (!updatedWave.orderIds.includes(candidate.id) || candidate.status === 'cancelled') return candidate;
    const previousBounty = candidate.productBounty ?? candidate.bountyAmount ?? 0;
    const delta = bounty - previousBounty;
    const isUpgrade = delta > 0 && previousBounty > 0;
    if (isUpgrade) {
      upgradeTxs.push({
        id: makeId(),
        type: 'SYNDICATE_BOUNTY_UPGRADE',
        amount: delta,
        description: `Wave Tier ${tier.tierNumber} Unlocked — +\u20b9${delta.toLocaleString('en-IN')} escrow boost on order #${candidate.id.slice(-6).toUpperCase()}`,
        timestamp: now,
        orderId: candidate.id,
        wallet: 'consumer',
        direction: 'credit',
        category: 'credit',
      });
    }
    const upgradeEntry = isUpgrade
      ? { fromBounty: previousBounty, toBounty: bounty, deltaAdded: delta, tierNumber: tier.tierNumber, timestamp: now }
      : null;
    return {
      ...candidate,
      isSyndicateOrder: true,
      waveId: updatedWave.id,
      productBounty: bounty,
      bountyAmount: bounty,
      bountyEscrow: bounty + (updatedWave.hasImageBounty ? updatedWave.imageBountyAmount : 0),
      hasImageBounty: updatedWave.hasImageBounty,
      imageReviewBounty: updatedWave.hasImageBounty ? updatedWave.imageBountyAmount : 0,
      imageEscrowHeld: updatedWave.hasImageBounty,
      syndicateTierUnlocked: tier.tierNumber,
      bountyUpgradeHistory: upgradeEntry
        ? [...(candidate.bountyUpgradeHistory ?? []), upgradeEntry]
        : (candidate.bountyUpgradeHistory ?? []),
    };
  });
  return { waves: nextWaves, orders: updatedOrders, upgradeTxs };
}

function reconcileWaveOrders(waves: SyndicateWave[], orders: Order[]): { waves: SyndicateWave[]; orders: Order[] } {
  let nextOrders = orders;
  const nextWaves = waves.map((wave) => {
    if (wave.status !== 'active') return wave;
    const activeOrders = getActiveWaveOrders(wave, nextOrders);
    const tier = getCurrentWaveTier(wave, activeOrders.length);
    const bounty = Math.round(wave.productPrice * (tier.bountyPercent / 100));
    nextOrders = nextOrders.map((order) => wave.orderIds.includes(order.id) && order.status !== 'cancelled' && order.status !== 'refunded'
      ? { ...order, productBounty: bounty, bountyAmount: bounty, bountyEscrow: bounty + (order.imageReviewBounty ?? 0) }
      : order);
    return wave;
  });
  return { waves: nextWaves, orders: nextOrders };
}

function applySyndicateClawback(
  waves: SyndicateWave[],
  orders: Order[],
  targetOrderId: string,
  reason: string,
): { orders: Order[]; waves: SyndicateWave[]; clawbackAmount: number; clawbackTx: WalletTransaction | null; clawbackNotification: AppNotification | null } {
  const targetOrder = orders.find((o) => o.id === targetOrderId);
  if (!targetOrder || !targetOrder.waveId) return { orders, waves, clawbackAmount: 0, clawbackTx: null, clawbackNotification: null };
  const targetWave = waves.find((w) => w.id === targetOrder.waveId);
  if (!targetWave || targetWave.status !== 'active') return { orders, waves, clawbackAmount: 0, clawbackTx: null, clawbackNotification: null };

  const now = Date.now();
  const remainingActive = orders.filter(
    (o) => o.id !== targetOrderId && targetWave.orderIds.includes(o.id) && o.status !== 'cancelled' && o.status !== 'refunded',
  );
  const newActiveCount = remainingActive.length;
  const sortedTiers = [...targetWave.tiers].sort((a, b) => b.thresholdUnits - a.thresholdUnits);
  const downgradedTier = sortedTiers.find((t) => newActiveCount >= t.thresholdUnits) ?? targetWave.tiers[0];
  const downgradedBountyAmount = Math.round(targetWave.productPrice * (downgradedTier.bountyPercent / 100));
  const previousTier = sortedTiers.find((t) => (targetOrder.syndicateTierUnlocked ?? 1) >= t.thresholdUnits) ?? targetWave.tiers[0];

  let totalClawback = 0;
  const updatedOrders = orders.map((o) => {
    if (o.id === targetOrderId) return o;
    if (!targetWave.orderIds.includes(o.id) || o.status === 'cancelled' || o.status === 'refunded') return o;
    const currentBounty = o.productBounty ?? o.bountyAmount ?? 0;
    const clawbackDelta = currentBounty - downgradedBountyAmount;
    if (clawbackDelta > 0) {
      totalClawback += clawbackDelta;
      return {
        ...o,
        productBounty: downgradedBountyAmount,
        bountyAmount: downgradedBountyAmount,
        bountyEscrow: downgradedBountyAmount + (o.imageReviewBounty ?? 0),
        syndicateTierUnlocked: downgradedTier.tierNumber,
        bountyUpgradeHistory: [
          ...(o.bountyUpgradeHistory ?? []),
          {
            fromBounty: currentBounty,
            toBounty: downgradedBountyAmount,
            deltaAdded: 0,
            deltaRemoved: clawbackDelta,
            tierNumber: downgradedTier.tierNumber,
            reason,
            timestamp: now,
          },
        ],
      };
    }
    return o;
  });

  if (totalClawback <= 0) return { orders: updatedOrders, waves, clawbackAmount: 0, clawbackTx: null, clawbackNotification: null };

  const clawbackTx: WalletTransaction = {
    id: makeId(),
    type: 'SYNDICATE_TIER_DOWNGRADE',
    amount: totalClawback,
    description: `Wave dropped to Tier ${downgradedTier.tierNumber} due to ${reason}. -₹${totalClawback.toLocaleString('en-IN')} adjusted from escrow.`,
    timestamp: now,
    orderId: targetOrderId,
    wallet: 'consumer',
    direction: 'debit',
    category: 'debit',
  };
  const clawbackNotification: AppNotification = {
    id: makeId(),
    consumerEmail: targetOrder.consumerEmail,
    type: 'order',
    title: 'Syndicate Tier Downgraded',
    description: `Wave tier dropped from T${previousTier.tierNumber} to T${downgradedTier.tierNumber} due to a ${reason.toLowerCase()}. ₹${totalClawback.toLocaleString('en-IN')} clawed back from escrow.`,
    link: '/consumer/orders',
    timestamp: now,
    read: false,
  };

  return { orders: updatedOrders, waves, clawbackAmount: totalClawback, clawbackTx, clawbackNotification };
}

const STATE_BROADCAST_CHANNEL = 'marketplace_state_sync';

export function MarketProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MarketState>(loadState);
  const isExternalSync = useRef(false);
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel(STATE_BROADCAST_CHANNEL);
      broadcastRef.current = channel;
    }
    return () => {
      broadcastRef.current?.close();
      broadcastRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (isExternalSync.current) {
      isExternalSync.current = false;
      return;
    }
    try {
      const { toasts, products: _products, intents: _intents, pitches: _pitches, ...persistable } = state;
      void toasts; void _products; void _intents; void _pitches;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
      broadcastRef.current?.postMessage({ type: 'state_updated', timestamp: Date.now() });
    } catch {
      /* ignore */
    }
  }, [state]);

  useEffect(() => {
    const syncFromStorage = () => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<MarketState>;
        isExternalSync.current = true;
        setState((s) => ({
          ...s,
          brandProfile: { ...s.brandProfile, ...(parsed.brandProfile ?? {}) },
          syndicateWaves: parsed.syndicateWaves ?? s.syndicateWaves,
          brandWallet: parsed.brandWallet ?? s.brandWallet,
          consumerWallet: parsed.consumerWallet ?? s.consumerWallet,
          walletTransactions: parsed.walletTransactions ?? s.walletTransactions,
          brandBountyPool: parsed.brandBountyPool ?? s.brandBountyPool,
          brandCredits: parsed.brandCredits ?? s.brandCredits,
          salesAnalytics: parsed.salesAnalytics ?? s.salesAnalytics,
          notifications: parsed.notifications ?? s.notifications,
          bag: parsed.bag ?? s.bagItems,
          toasts: s.toasts,
        }));
      } catch {
        /* ignore */
      }
    };
    const onBroadcastMessage = (event: MessageEvent) => {
      if (event.data?.type === 'state_updated') syncFromStorage();
    };
    const channel = broadcastRef.current;
    channel?.addEventListener('message', onBroadcastMessage);
    window.addEventListener('storage', syncFromStorage);
    return () => {
      channel?.removeEventListener('message', onBroadcastMessage);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, []);

  const resolverRef = useRef<((value: unknown) => void) | null>(null);
  useEffect(() => {
    if (resolverRef.current) {
      resolverRef.current(state);
      resolverRef.current = null;
    }
  }, [state]);

  useEffect(() => {
    let mounted = true;
    const hydrateUser = async (userId: string, email: string) => {
      const [profileRes, allOrdersRes, ledgerRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('wallet_ledger').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      ]);
      if (!mounted) return;
      const profile = profileRes.data as DbProfile | null;
      const role: 'consumer' | 'brand' = profile?.role === 'brand' ? 'brand' : 'consumer';

      const buyerKey = resolveBuyerKey(email, userId);
      const [tokensRes, txnsRes, settingsRes, disputesRes] = await Promise.all([
        supabase.from('brand_tokens').select('*').or(`consumer_email.eq.${buyerKey},user_id.eq.${buyerKey}`).order('updated_at', { ascending: false }),
        supabase.from('wallet_transactions').select('*').order('created_at', { ascending: false }),
        supabase.from('brand_token_settings').select('*'),
        supabase.from('disputes').select('*').order('created_at', { ascending: false }),
      ]);

      setState((s) => {
        const dbOrdersData = (allOrdersRes.data ?? []) as Record<string, unknown>[];
        const dbOrders = dbOrdersData.length > 0 ? dbOrdersData.map(normalizeDbOrder) : s.dbOrders;
        const disputesData = (disputesRes.data ?? []) as Record<string, unknown>[];
        const disputes = disputesData.length > 0 ? disputesData.map(normalizeDbDispute) : s.disputes;
        const disputeByOrderId = new Map<string, DisputeRow>();
        for (const d of disputes) disputeByOrderId.set(String(d.order_id), d);
        const derivedOrders = dbOrders.length > 0 ? dbOrders.map((db) => dbOrderToOrder(db, s.products, disputeByOrderId.get(String(db.id)))) : s.orders;
        return {
          ...s,
          authUser: { id: userId, email },
          authProfile: profile,
          session: { role, email, isVerified: true },
          authLoading: false,
          consumerWallet: profile
            ? { lockedEscrow: Number(profile.pending_escrow_bounty), withdrawable: Number(profile.wallet_balance) }
            : s.consumerWallet,
          dbOrders,
          orders: derivedOrders,
          walletTransactions: ledgerRes.data && ledgerRes.data.length > 0
            ? ledgerRes.data.map((entry) => ({
                id: entry.id,
                type: entry.type as WalletTransaction['type'],
                amount: Number(entry.amount),
                description: entry.description,
                timestamp: new Date(entry.created_at).getTime(),
                orderId: entry.order_id ?? undefined,
                runningBalance: Number(entry.balance_after),
              }))
            : s.walletTransactions,
          brandTokens: (tokensRes.data ?? []).map((r) => normalizeDbBrandToken(r as Record<string, unknown>)),
          walletTxns: (txnsRes.data ?? []).map((r) => normalizeDbWalletTxn(r as Record<string, unknown>)),
          brandTokenSettings: normalizeTokenSettings(settingsRes.data),
          disputes,
        };
      });
    };

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      if (sess?.user) {
        hydrateUser(sess.user.id, sess.user.email ?? '');
      } else {
        if (mounted) setState((s) => ({ ...s, authLoading: false }));
      }
    });

    const refreshInterval = window.setInterval(() => {
      if (disputeMutationInFlight) return;
      supabase.auth.getSession().then(({ data: { session: sess } }) => {
        if (sess?.user) {
          hydrateUser(sess.user.id, sess.user.email ?? '');
        }
      });
    }, 15_000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      (async () => {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && sess?.user) {
          setState((s) => ({ ...s, authLoading: true }));
          await hydrateUser(sess.user.id, sess.user.email ?? '');
        } else if (event === 'SIGNED_OUT') {
          if (!mounted) return;
          setState((s) => ({
            ...s,
            authUser: null,
            authProfile: null,
            session: { role: null, email: '', isVerified: false },
            authLoading: false,
          }));
        }
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.clearInterval(refreshInterval);
    };
  }, []);

  useEffect(() => {
    const fetchCatalogData = async () => {
      const results = await Promise.all([
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('buyer_intents').select('*').order('created_at', { ascending: false }),
        supabase.from('pitches').select('*').order('created_at', { ascending: false }),
        supabase.from('addresses').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('daily_analytics').select('*').order('analytics_date', { ascending: true }),
        supabase.from('disputes').select('*').order('created_at', { ascending: false }),
      ]);

      const ordersRes = results[4] as { error?: { message: string }; data?: unknown[] };
      const dailyAnalyticsRes = results[5] as { error?: { message: string }; data?: unknown[] };
      const disputesRes = results[6] as { error?: { message: string }; data?: unknown[] };
      const productsRes = results[0] as { data?: unknown[] };
      const intentsRes = results[1] as { data?: unknown[] };
      const pitchesRes = results[2] as { data?: unknown[] };
      const addressesRes = results[3] as { error?: { message: string }; data?: unknown[] };
      if (ordersRes.error) {
        pushToast('error', `[DB Orders Fetch Error]: ${ordersRes.error.message}`);
      }
      if (dailyAnalyticsRes?.error) {
        console.error('[DB daily_analytics fetch error]:', dailyAnalyticsRes.error.message);
      }
      if (disputesRes?.error) {
        console.error('[DB disputes fetch error]:', disputesRes.error.message);
      }

      if (addressesRes.error) {
        pushToast('error', `[DB Fetch Error]: ${addressesRes.error.message}`);
      }
      setState((s) => {
        const dbProducts = (productsRes.data ?? []) as Record<string, unknown>[];
        const dbIntents = (intentsRes.data ?? []) as Record<string, unknown>[];
        const dbPitches = (pitchesRes.data ?? []) as Record<string, unknown>[];

        const products = dbProducts.length > 0 ? normalizeProductBounties(dbProducts.map(normalizeDbProduct)) : s.products;
        const pitches = dbPitches.length > 0 ? dbPitches.map(normalizeDbPitch) : s.pitches;
        const dbAddresses = (addressesRes.data ?? []) as Record<string, unknown>[];
        const addresses = dbAddresses.length > 0 ? dbAddresses.map(normalizeDbAddress) : s.addresses;

        const pitchesByIntent = new Map<string, Pitch[]>();
        for (const pitch of pitches) {
          const arr = pitchesByIntent.get(pitch.intentId) ?? [];
          arr.push(pitch);
          pitchesByIntent.set(pitch.intentId, arr);
        }
        for (const arr of pitchesByIntent.values()) {
          arr.sort((a, b) => (Number(b.isVip) - Number(a.isVip)) || (b.bountyAmount - a.bountyAmount));
        }

        const intents = dbIntents.length > 0
          ? dbIntents.map(normalizeDbIntent).map((i) => ({ ...i, pitches: pitchesByIntent.get(i.id) ?? [] }))
          : s.intents;

        const dbOrdersData = (ordersRes.data ?? []) as Record<string, unknown>[];
        const dbOrders = dbOrdersData.length > 0 ? dbOrdersData.map(normalizeDbOrder) : s.dbOrders;
        const dailyAnalyticsData = ((results as unknown[])[5] as { data?: unknown[] } | undefined)?.data as Record<string, unknown>[] | undefined;
        const dailyAnalytics = dailyAnalyticsData && dailyAnalyticsData.length > 0 ? dailyAnalyticsData.map(normalizeDbDailyAnalytics) : s.dailyAnalytics;

        const disputesData = (disputesRes.data ?? []) as Record<string, unknown>[];
        const disputes = disputesData.length > 0 ? disputesData.map(normalizeDbDispute) : s.disputes;
        const disputeByOrderId = new Map<string, DisputeRow>();
        for (const d of disputes) disputeByOrderId.set(String(d.order_id), d);

        // Derive full Order[] from Supabase order rows so the consumer My Purchases view shows them.
        const derivedOrders = dbOrders.map((db) => dbOrderToOrder(db, products, disputeByOrderId.get(String(db.id))));
        const orders = derivedOrders.length > 0 ? mergeDisputesIntoOrders(derivedOrders, disputes) : s.orders;

        return { ...s, products, intents, pitches, addresses, dbOrders, dailyAnalytics, orders, disputes };
      });
    };
    fetchCatalogData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.authUser?.id]);

  const value = useMemo<MarketContextValue>(() => {
    const signIn = (role: 'consumer' | 'brand', email: string) =>
      setState((s) => ({
        ...s,
        session: { role, email, isVerified: s.session.isVerified },
      }));

    const verifyConsumer = () =>
      setState((s) => ({ ...s, session: { ...s.session, isVerified: true } }));

    const signOut = () =>
      setState((s) => ({
        ...s,
        session: { role: null, email: '', isVerified: false },
      }));

    const supabaseSignIn = async (email: string, password: string) => {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      return { error: signInError ? signInError.message : null };
    };

    const supabaseSignUp = async (email: string, password: string, displayName: string, role: 'buyer' | 'brand') => {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName, role, initial_balance: 25000 } },
      });
      return { error: signUpError ? signUpError.message : null };
    };

    const supabaseSignOut = async () => {
      await supabase.auth.signOut();
      setState((s) => ({
        ...s,
        authUser: null,
        authProfile: null,
        session: { role: null, email: '', isVerified: false },
        authLoading: false,
      }));
    };

    const addProduct = async (product: Omit<Product, 'id'>): Promise<{ error: string | null; product: Product | null }> => {
      const id = crypto.randomUUID();
      const minBounty = Math.ceil((product.priceInr || 0) * 0.05);
      const sanitized: Omit<Product, 'id'> = {
        ...product,
        autoBounty: Math.max(product.autoBounty ?? 0, minBounty),
        imageReviewBountyAmount:
          product.imageReviewBountyEnabled && product.imageReviewBountyAmount
            ? Math.max(20, Number(product.imageReviewBountyAmount) || 20)
            : product.imageReviewBountyEnabled
              ? 20
              : 0,
      };
      const keywords = enrichKeywords(sanitized);
      const newProduct: Product = { ...sanitized, id, keywords };
      const validBrandId =
        state.authUser?.id && state.authUser.id.length > 20 ? state.authUser.id : null;

      const finalImages = (sanitized.images ?? []).length > 0
        ? sanitized.images
        : ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800'];

      const insertPayload = {
        id,
        name: sanitized.title || 'Untitled Product',
        description: sanitized.teaser ?? null,
        price: Number(sanitized.priceInr) || 0,
        original_price: Number(sanitized.priceInr) || 0,
        image_url: finalImages[0] ?? null,
        image_urls: finalImages,
        primary_image_index: sanitized.primaryImageIndex ?? 0,
        category: sanitized.category || 'General',
        subcategory: sanitized.subcategory ?? null,
        keywords,
        sizes: sanitized.sizes ?? [],
        colors: sanitized.colors ?? [],
        color_hex: sanitized.colorHex ?? {},
        auto_bounty: Number(sanitized.autoBounty) || 0,
        image_review_bounty_enabled: Boolean(sanitized.imageReviewBountyEnabled),
        image_review_bounty_amount: Number(sanitized.imageReviewBountyAmount ?? 0),
        is_draft: Boolean(sanitized.isDraft),
        brand_id: validBrandId,
        brand_name: sanitized.brandName || 'Brand',
        variants: sanitized.variants ?? [],
        stock_quantity: (sanitized.variants ?? []).reduce((sum: number, v: VariantStock) => sum + (Number(v.stock) || 0), 0) || (sanitized.stockQuantity ?? 0),
      };

      const { error } = await supabase.from('products').insert(insertPayload);

      if (error) {
        console.error('EXACT_PRODUCT_SAVE_ERROR:', error);
        const errMsg = error.message || error.details || error.hint || JSON.stringify(error);
        pushToast('error', `Failed to save product: ${errMsg} (${error.code ?? 'NO_CODE'})`);
        return { error: errMsg, product: null };
      }

      setState((s) => ({
        ...s,
        products: [{ ...newProduct, images: finalImages }, ...s.products],
      }));
      pushToast('success', 'Product created successfully!');
      return { error: null, product: { ...newProduct, images: finalImages } };
    };

    const removeProduct = async (productId: string) => {
      const { error } = await supabase.from('products').delete().eq('id', productId);
      if (error) {
        pushToast('error', 'Failed to delete product from database');
        return;
      }
      setState((s) => ({
        ...s,
        products: s.products.filter((p) => p.id !== productId),
      }));
      pushToast('success', 'Product deleted permanently');
    };

    const updateProduct = (productId: string, updates: Partial<Omit<Product, 'id'>>) => {
      let computedUpdates: Partial<Product> = {};
      setState((s) => {
        const product = s.products.find((p) => p.id === productId);
        if (!product) return s;
        const finalUpdates: Partial<Product> = { ...updates };
        const now = Date.now();
        const priceLocked = product.priceLastEditedAt !== undefined && now - product.priceLastEditedAt < PRICE_COOLDOWN_MS;
        const bountyLocked = product.bountyLastEditedAt !== undefined && now - product.bountyLastEditedAt < PRICE_COOLDOWN_MS;
        const priceIncreased = updates.priceInr !== undefined && updates.priceInr > product.priceInr;
        let systemAutoBountyIncrease = false;
        if (updates.priceInr !== undefined && updates.priceInr !== product.priceInr) {
          if (priceLocked) {
            finalUpdates.priceInr = product.priceInr;
          } else {
            const maxAllowed = Math.floor(product.priceInr * 1.20);
            finalUpdates.priceInr = Math.min(updates.priceInr, maxAllowed);
            finalUpdates.priceLastEditedAt = now;
            if (priceIncreased) finalUpdates.priceIncreasedAt = now;
          }
          const effectiveNewPrice = finalUpdates.priceInr ?? product.priceInr;
          const requiredMinBounty = Math.ceil(effectiveNewPrice * 0.05);
          if (priceIncreased && !priceLocked && product.autoBounty < requiredMinBounty) {
            finalUpdates.autoBounty = requiredMinBounty;
            systemAutoBountyIncrease = true;
          }
        }
        if (
          updates.autoBounty !== undefined &&
          updates.autoBounty !== product.autoBounty &&
          bountyLocked &&
          !systemAutoBountyIncrease
        ) {
          finalUpdates.autoBounty = product.autoBounty;
        }
        if (
          updates.autoBounty !== undefined &&
          updates.autoBounty !== product.autoBounty &&
          updates.autoBounty < product.autoBounty &&
          !bountyLocked &&
          !systemAutoBountyIncrease
        ) {
          const minAllowedBounty = Math.max(20, Math.ceil(product.autoBounty * 0.80));
          finalUpdates.autoBounty = Math.max(updates.autoBounty, minAllowedBounty);
          finalUpdates.bountyDecreasedAt = now;
        }
        if (
          updates.autoBounty !== undefined &&
          updates.autoBounty !== product.autoBounty &&
          !bountyLocked &&
          !systemAutoBountyIncrease
        ) {
          const minFivePct = Math.ceil((finalUpdates.priceInr ?? product.priceInr) * 0.05);
          if (updates.autoBounty < minFivePct) {
            finalUpdates.autoBounty = Math.max(minFivePct, product.autoBounty);
          }
          finalUpdates.bountyLastEditedAt = now;
        }
        if (updates.imageReviewBountyEnabled !== undefined) {
          const enabled = updates.imageReviewBountyEnabled;
          const incomingAmount =
            updates.imageReviewBountyAmount !== undefined
              ? Number(updates.imageReviewBountyAmount) || 0
              : product.imageReviewBountyAmount ?? 0;
          if (enabled) {
            finalUpdates.imageReviewBountyEnabled = true;
            finalUpdates.imageReviewBountyAmount = Math.max(20, incomingAmount || 20);
          } else {
            finalUpdates.imageReviewBountyEnabled = false;
            finalUpdates.imageReviewBountyAmount = 0;
          }
        } else if (
          updates.imageReviewBountyAmount !== undefined &&
          updates.imageReviewBountyAmount !== product.imageReviewBountyAmount &&
          !bountyLocked &&
          product.imageReviewBountyAmount !== undefined &&
          product.imageReviewBountyAmount > 0 &&
          updates.imageReviewBountyAmount < product.imageReviewBountyAmount
        ) {
          const minAllowed = Math.max(20, Math.ceil(product.imageReviewBountyAmount * 0.80));
          finalUpdates.imageReviewBountyAmount = Math.max(updates.imageReviewBountyAmount, minAllowed);
          finalUpdates.bountyDecreasedAt = Date.now();
        }
        computedUpdates = finalUpdates;
        return {
          ...s,
          products: s.products.map((p) =>
            p.id === productId ? { ...p, ...finalUpdates } : p,
          ),
        };
      });

      // Persist to Supabase by UUID
      const dbPayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (computedUpdates.title !== undefined) {
        dbPayload.name = computedUpdates.title;
      }
      if (computedUpdates.priceInr !== undefined) {
        dbPayload.price = Number(computedUpdates.priceInr) || 0;
      }
      if (computedUpdates.autoBounty !== undefined) {
        dbPayload.auto_bounty = Number(computedUpdates.autoBounty) || 0;
      }
      if (computedUpdates.stockQuantity !== undefined) {
        dbPayload.stock_quantity = Number(computedUpdates.stockQuantity) || 0;
      }
      if (computedUpdates.imageReviewBountyEnabled !== undefined) {
        dbPayload.image_review_bounty_enabled = Boolean(computedUpdates.imageReviewBountyEnabled);
      }
      if (computedUpdates.imageReviewBountyAmount !== undefined) {
        dbPayload.image_review_bounty_amount = Number(computedUpdates.imageReviewBountyAmount) || 0;
      }
      if (computedUpdates.images !== undefined) {
        dbPayload.image_urls = computedUpdates.images;
        dbPayload.image_url = computedUpdates.images[0] ?? null;
      }
      if (computedUpdates.primaryImageIndex !== undefined) {
        dbPayload.primary_image_index = computedUpdates.primaryImageIndex;
      }
      if (computedUpdates.variants !== undefined) {
        dbPayload.variants = computedUpdates.variants;
        dbPayload.stock_quantity = (computedUpdates.variants as VariantStock[]).reduce(
          (sum, v) => sum + (Number(v.stock) || 0), 0,
        );
      }
      if (computedUpdates.sizes !== undefined) dbPayload.sizes = computedUpdates.sizes;
      if (computedUpdates.colors !== undefined) dbPayload.colors = computedUpdates.colors;
      if (computedUpdates.colorHex !== undefined) dbPayload.color_hex = computedUpdates.colorHex;
      if (computedUpdates.teaser !== undefined) dbPayload.description = computedUpdates.teaser;
      if (computedUpdates.subcategory !== undefined) dbPayload.subcategory = computedUpdates.subcategory;
      if (computedUpdates.keywords !== undefined) dbPayload.keywords = computedUpdates.keywords;
      if (computedUpdates.isDraft !== undefined) dbPayload.is_draft = computedUpdates.isDraft;

      if (Object.keys(dbPayload).length > 1) {
        supabase
          .from('products')
          .update(dbPayload)
          .eq('id', productId)
          .then(({ error }) => {
            if (error) {
              pushToast('error', `[DB Edit Error]: ${error.message} (${error.code || 'unknown'})`);
              return;
            }
            // Re-fetch from Supabase so Brand & Consumer views stay in sync
            supabase
              .from('products')
              .select('*')
              .eq('id', productId)
              .single()
              .then(({ data: refreshed, error: refreshErr }) => {
                if (refreshErr || !refreshed) return;
                setState((s) => ({
                  ...s,
                  products: s.products.map((p) =>
                    p.id === productId
                      ? { ...p, ...normalizeDbProduct(refreshed) }
                      : p,
                  ),
                }));
              });
          });
      }
    };

    const toggleImageReviewBounty = (productId: string, enabled: boolean, amount?: number) => {
      let finalAmount = 0;
      let bountyChanged = false;
      setState((s) => {
        const product = s.products.find((p) => p.id === productId);
        if (!product) return s;
        const now = Date.now();
        finalAmount = enabled ? Math.max(20, Number(amount) || product.imageReviewBountyAmount || 20) : 0;
        bountyChanged =
          enabled !== product.imageReviewBountyEnabled ||
          (enabled && finalAmount !== product.imageReviewBountyAmount);
        return {
          ...s,
          products: s.products.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  imageReviewBountyEnabled: enabled,
                  imageReviewBountyAmount: enabled ? finalAmount : 0,
                  bountyLastEditedAt: bountyChanged ? now : p.bountyLastEditedAt,
                }
              : p,
          ),
        };
      });

      // Persist to Supabase by UUID
      supabase
        .from('products')
        .update({
          image_review_bounty_enabled: enabled,
          image_review_bounty_amount: enabled ? finalAmount : 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId)
        .then(({ error }) => {
          if (error) {
            pushToast('error', `[DB Edit Error]: ${error.message} (${error.code || 'unknown'})`);
            return;
          }
          supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single()
            .then(({ data: refreshed, error: refreshErr }) => {
              if (refreshErr || !refreshed) return;
              setState((s) => ({
                ...s,
                products: s.products.map((p) =>
                  p.id === productId
                    ? { ...p, ...normalizeDbProduct(refreshed) }
                    : p,
                ),
              }));
            });
        });
    };

    const canSendPitchForProduct = (productId: string): boolean =>
      state.products.some((product) => product.id === productId);

    const removeIntent = async (intentId: string) => {
      const { error } = await supabase
        .from('buyer_intents')
        .delete()
        .eq('id', intentId);
      if (error) {
        pushToast('error', 'Could not delete intent from database');
        return;
      }
      setState((s) => ({
        ...s,
        intents: s.intents.filter((i) => i.id !== intentId),
      }));
      pushToast('success', 'Intent deleted');
    };

    const extendIntent = (intentId: string) => {
      const fixedExpiry = Date.now() + INTENT_TTL;
      supabase
        .from('buyer_intents')
        .update({
          expires_at: new Date(fixedExpiry).toISOString(),
          status: 'active',
        })
        .eq('id', intentId)
        .then(({ error }) => {
          if (error) pushToast('error', 'Failed to reset timer');
        });
      setState((s) => ({
        ...s,
        intents: s.intents.map((i) =>
          i.id === intentId
            ? { ...i, expiresAt: fixedExpiry, status: 'active' }
            : i,
        ),
      }));
      pushToast('success', 'Intent reset to 48 hours remaining');
    };

    const verifyBrand = (data?: {
      legalCorporateName?: string;
      trademarkId?: string;
      dunsNumber?: string;
    }) =>
      setState((s) => ({
        ...s,
        brandProfile: {
          ...s.brandProfile,
          isCorporateVerified: true,
          legalCorporateName:
            data?.legalCorporateName ?? s.brandProfile.legalCorporateName,
          trademarkId: data?.trademarkId ?? s.brandProfile.trademarkId,
          dunsNumber: data?.dunsNumber ?? s.brandProfile.dunsNumber,
          displayName:
            data?.legalCorporateName ?? s.brandProfile.displayName,
          middeskVerified: true,
        },
      }));

    const verifyGstin = (gstin: string) =>
      setState((s) => ({
        ...s,
        brandProfile: {
          ...s.brandProfile,
          gstin: gstin.toUpperCase(),
          gstinVerified: true,
        },
      }));

    const setMiddeskVerified = () =>
      setState((s) => ({
        ...s,
        brandProfile: {
          ...s.brandProfile,
          middeskVerified: true,
        },
      }));

    const connectStripe = (last4: string) =>
      setState((s) => ({
        ...s,
        brandProfile: {
          ...s.brandProfile,
          stripeConnected: true,
          stripeAccountLast4: last4,
        },
      }));

    const addCampaign = (campaign: Omit<Campaign, 'id' | 'createdAt'>) =>
      setState((s) => ({
        ...s,
        campaigns: [
          { ...campaign, id: makeId(), createdAt: Date.now() },
          ...s.campaigns,
        ],
      }));

    const removeCampaign = (campaignId: string) =>
      setState((s) => ({
        ...s,
        campaigns: s.campaigns.filter((c) => c.id !== campaignId),
      }));

    const launchVIPPitch = (p: {
      intentId: string;
      productId: string;
      productTitle: string;
      brandName: string;
      productImage: string;
      originalPrice: number;
      bountyAmount: number;
      offeredSizes?: string[];
      offeredColors?: string[];
    }) => {
      const intent = state.intents.find((i) => i.id === p.intentId);
      if (!intent) return;
      const product = state.products.find((pr) => pr.id === p.productId);
      const baseBounty = product?.autoBounty || Math.ceil((product?.priceInr ?? p.originalPrice) * 0.05);
      const requiredMinBounty = Math.ceil(baseBounty * 1.20);
      const finalBounty = Math.max(requiredMinBounty, Number(p.bountyAmount) || requiredMinBounty);
      const snapshot = intent.productSnapshots?.find((sp) => sp.productId === p.productId);
      const baselinePrice = snapshot?.baselinePrice ?? p.originalPrice;
      const baselineBounty = snapshot?.baselineBounty ?? baseBounty;
      const pitchId = crypto.randomUUID();
      const newPitch: Pitch = {
        id: pitchId,
        intentId: p.intentId,
        consumerEmail: intent.consumerEmail,
        productId: p.productId,
        productTitle: p.productTitle,
        brandName: p.brandName,
        productImage: p.productImage,
        originalPrice: baselinePrice,
        bountyAmount: finalBounty,
        status: 'active',
        createdAt: new Date().toISOString(),
        offeredPrice: baselinePrice,
        baselinePrice,
        baselineBounty,
        offeredSizes: p.offeredSizes ?? [],
        offeredColors: p.offeredColors ?? [],
        isVip: true,
      };
      supabase
        .from('pitches')
        .insert({
          id: pitchId,
          intent_id: p.intentId,
          brand_id: state.authUser?.id ?? null,
          brand_name: p.brandName,
          product_id: p.productId,
          product_title: p.productTitle,
          product_image: p.productImage,
          offer_price: baselinePrice,
          original_price: baselinePrice,
          bounty_amount: finalBounty,
          is_vip: true,
          stake_amount: finalBounty,
          offered_sizes: p.offeredSizes ?? [],
          offered_colors: p.offeredColors ?? [],
          status: 'active',
          consumer_email: intent.consumerEmail,
          baseline_price: baselinePrice,
          baseline_bounty: baselineBounty,
        })
        .then(({ error }) => {
          if (error) pushToast('error', `Failed to save pitch to cloud: ${error.message}`);
        });
      setState((s) => ({
        ...s,
        pitches: [newPitch, ...s.pitches],
        intents: s.intents.map((i) =>
          i.id === p.intentId
            ? { ...i, pitches: [...(i.pitches ?? []), newPitch] }
            : i,
        ),
        notifications: [
          {
            id: makeId(),
            consumerEmail: intent.consumerEmail,
            type: 'intent' as const,
            title: 'New VIP Pitch Received',
            description: `${p.brandName} pitched ${p.productTitle} with ₹${baselineBounty} cash back.`,
            link: `/consumer/intent/${p.intentId}`,
            timestamp: Date.now(),
            read: false,
          },
          ...s.notifications,
        ],
      }));
    };

    const acceptPitch = (pitchId: string) =>
      setState((s) => ({
        ...s,
        pitches: s.pitches.map((p) =>
          p.id === pitchId ? { ...p, status: 'accepted' as const } : p,
        ),
        intents: s.intents.map((i) =>
          i.pitches
            ? {
                ...i,
                pitches: i.pitches.map((p) =>
                  p.id === pitchId ? { ...p, status: 'accepted' as const } : p,
                ),
              }
            : i,
        ),
      }));

    const acceptPitchWithOrder = (pitchId: string, addressId?: string, selectedSize?: string, selectedColor?: string, appliedBrandCredit?: number) =>
      setState((s) => {
        const pitch = s.pitches.find((p) => p.id === pitchId);
        if (!pitch || pitch.status !== 'active') return s;
        const product = s.products.find((p) => p.id === pitch.productId);
        const size = selectedSize ?? product?.sizes[0] ?? '';
        const color = selectedColor ?? product?.colors[0] ?? '';
        const orderId = crypto.randomUUID();
        const platformFee = Math.round(pitch.originalPrice * 0.05);
        const productBounty = pitch.bountyAmount;
        const imageReviewBounty = 0;
        const totalBounty = productBounty + imageReviewBounty;
        const brandNet = pitch.originalPrice - platformFee - totalBounty;
        const creditApplied = Math.max(0, Math.min(appliedBrandCredit ?? 0, pitch.originalPrice));
        const validCreditApplied = creditApplied;
        const netPaid = Math.max(0, pitch.originalPrice - validCreditApplied);
        const order: Order = {
          id: orderId,
          consumerEmail: pitch.consumerEmail,
          productId: pitch.productId,
          productTitle: pitch.productTitle,
          brandName: pitch.brandName,
          priceInr: pitch.originalPrice,
          bountyAmount: pitch.bountyAmount,
          size,
          color,
          selectedSize: size,
          selectedColor: color,
          image: pitch.productImage,
          trackingStatus: 'Placed',
          trackingNumber: makeTrackingNumber(),
          timestamp: Date.now(),
          addressId,
          disputeStatus: 'resolved',
          priceAtPurchase: pitch.originalPrice,
          settlementStatus: 'pending',
          bountyEscrow: totalBounty,
          brandNetPayout: brandNet,
          platformFee,
          escrowStatus: 'locked',
          reviewStatus: 'pending_upload',
          bountyReleased: false,
          brandPayoutReleased: false,
          productBounty,
          imageReviewBounty,
          productBountyReleased: false,
          imageReviewBountyReleased: false,
          brandCreditApplied: validCreditApplied,
          netPaid,
        };
        const paymentTx: WalletTransaction = {
          id: makeId(),
          type: 'SANDBOX_PAYMENT',
          amount: netPaid,
          description: `Sandbox Instant Pay — Order #${orderId.slice(-6).toUpperCase()} (PAID)`,
          timestamp: Date.now(),
          orderId,
          wallet: 'consumer',
          direction: 'debit',
          category: 'debit',
          runningBalance: s.consumerWallet.withdrawable,
        };
        const creditTx: WalletTransaction | null = validCreditApplied > 0
          ? {
              id: makeId(),
              type: 'BRAND_CREDIT_REDEEMED',
              amount: validCreditApplied,
              description: `Applied ₹${validCreditApplied.toLocaleString('en-IN')} ${pitch.brandName} credit on Order #${orderId.slice(-6).toUpperCase()}`,
              timestamp: Date.now(),
              orderId,
              wallet: 'consumer',
              direction: 'debit',
              category: 'debit',
              runningBalance: s.consumerWallet.withdrawable,
            }
          : null;
        const updatedCredits = validCreditApplied > 0
          ? s.brandCredits
              .map((c) =>
                c.brandId === pitch.brandName
                  ? { ...c, amount: Math.max(0, c.amount - validCreditApplied), updatedAt: Date.now() }
                  : c,
              )
              .filter((c) => c.amount > 0)
          : s.brandCredits;
        const waveResult = addOrderToActiveWave(s.syndicateWaves, s.orders, order);
        const waveUpgradeDelta = waveResult.upgradeTxs.reduce((sum, t) => sum + t.amount, 0);
        const pitchProduct = s.products.find((p) => p.id === pitch.productId);
        void insertOrderToSupabase({
          id: orderId,
          productId: pitch.productId,
          productTitle: pitch.productTitle,
          brandName: pitch.brandName,
          brandId: pitchProduct?.brandId ?? null,
          buyerId: s.authUser?.id ?? null,
          consumerEmail: pitch.consumerEmail,
          unitPrice: pitch.originalPrice,
          quantity: 1,
          productBounty,
          imageReviewBounty,
          size,
          color,
          trackingNumber: order.trackingNumber,
          hasImageBounty,
          isSyndicateOrder: !!order.waveId,
          waveId: order.waveId,
          syndicateTierUnlocked: order.syndicateTierUnlocked,
          reviewStatus: order.reviewStatus,
          storeCreditUsed: validCreditApplied,
          netCashPaid: netPaid,
          toast: pushToast,
        });
        void refreshAllMarketData();
        void syncSoldCountToSupabase(pitch.productId, 1, pushToast).then((newSold) => {
          if (newSold != null) setState((s2) => ({ ...s2, products: setProductSoldCount(s2.products, pitch.productId, newSold) }));
        });
        void syncStockToSupabase(pitch.productId, 1, pushToast, size, color).then((newStock) => {
          if (newStock != null) setState((s2) => ({ ...s2, products: setProductStock(s2.products, pitch.productId, newStock, size, color) }));
        });
        const completedIntentIds: string[] = [];
        if (pitchProduct) {
          s.intents.forEach((i) => {
            if (i.status !== 'active' || i.consumerEmail !== pitch.consumerEmail) return;
            const query = i.searchQuery.toLowerCase().trim();
            if (!query) return;
            const matches = pitchProduct.keywords.some((kw) => {
              const k = kw.toLowerCase().trim();
              return query.includes(k) || k.includes(query);
            }) || pitchProduct.title.toLowerCase().includes(query) || pitchProduct.category.toLowerCase().includes(query);
            if (matches) completedIntentIds.push(i.id);
          });
        }
        deleteIntentsFromSupabase(completedIntentIds);
        return {
          ...s,
          pitches: s.pitches.map((p) =>
            p.id === pitchId ? { ...p, status: 'accepted' as const } : p,
          ),
          intents: s.intents.filter((i) => !completedIntentIds.includes(i.id)),
          orders: waveResult.orders,
          syndicateWaves: waveResult.waves,
          products: s.products.map((p) =>
              p.id === pitch.productId
                ? {
                    ...p,
                    stockQuantity: Math.max(0, (p.stockQuantity ?? 0) - 1),
                    variants: p.variants.map((v) =>
                      v.size === size && v.color === color
                        ? { ...v, stock: Math.max(0, v.stock - 1), outOfStock: v.stock - 1 <= 0 }
                        : v,
                    ),
                  }
                : p,
            ),
          consumerWallet: {
            ...s.consumerWallet,
            lockedEscrow: s.consumerWallet.lockedEscrow + pitch.bountyAmount + waveUpgradeDelta,
          },
          brandCredits: updatedCredits,
          walletTransactions: [...waveResult.upgradeTxs, paymentTx, ...(creditTx ? [creditTx] : []), ...s.walletTransactions],
          notifications: [
            {
              id: makeId(),
              consumerEmail: pitch.consumerEmail,
              type: 'order' as const,
              title: 'VIP Pitch Order Placed',
              description: `${pitch.productTitle} — ₹${pitch.bountyAmount.toLocaleString('en-IN')} bounty locked in escrow.`,
              link: '/consumer/orders',
              timestamp: Date.now(),
              read: false,
            },
            ...s.notifications,
          ],
        };
      });

    const declinePitch = (pitchId: string) =>
      setState((s) => ({
        ...s,
        pitches: s.pitches.map((p) =>
          p.id === pitchId ? { ...p, status: 'declined' as const } : p,
        ),
        intents: s.intents.map((i) =>
          i.pitches
            ? {
                ...i,
                pitches: i.pitches.map((p) =>
                  p.id === pitchId ? { ...p, status: 'declined' as const } : p,
                ),
              }
            : i,
        ),
      }));

    const openDispute = (orderId: string, reason: string, evidenceImages: string[] = []) => {
      const order = state.orders.find((o) => o.id === orderId);
      if (order) {
        void syncDisputeToSupabase(orderId, reason, '', {
          productId: order.productId,
          productTitle: order.productTitle,
          brandName: order.brandName,
          consumerEmail: order.consumerEmail,
          quantity: order.quantity,
          priceInr: order.priceInr,
          bountyAmount: order.bountyAmount,
        }, pushToast).then(() => refreshDbOrders().then(() => refreshAllMarketData()));
      }
      setState((s) => {
        const existing = s.orders.find((o) => o.id === orderId);
        if (!existing || existing.disputeStatus === 'resolved_refunded_by_admin' || existing.disputeStatus === 'rejected_by_admin') return s;
        const now = Date.now();
        return {
          ...s,
          orders: s.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  disputeStatus: 'open' as const,
                  disputeReason: reason,
                  disputeEvidenceImages: evidenceImages,
                  disputeOpenedAt: o.disputeOpenedAt ?? now,
                  escrowFrozen: true,
                  escrowStatus: 'disputed' as EscrowStatus,
                  status: 'shipped' as OrderStatus,
                  disputeMessages: [
                    ...(o.disputeMessages ?? []),
                    { id: makeId(), senderRole: 'consumer' as const, text: reason, timestamp: now },
                  ],
                }
              : o,
          ),
          notifications: [
            {
              id: makeId(),
              consumerEmail: existing.consumerEmail,
              type: 'dispute' as const,
              title: 'Dispute Filed',
              description: `Your dispute for order #${orderId.slice(-6).toUpperCase()} has been submitted. Funds are frozen during review.`,
              link: '/consumer/orders',
              timestamp: now,
              read: false,
            },
            ...s.notifications,
          ],
        };
      });
    };

    const raiseDispute = openDispute;

    const escalateDispute = (orderId: string) =>
      setState((s) => ({
        ...s,
        orders: s.orders.map((o) =>
          o.id === orderId && o.escrowFrozen
            ? { ...o, disputeStatus: 'escalated' as const, disputeEscalatedAt: Date.now() }
            : o,
        ),
      }));

    const addKeywordAlert = (keyword: string) =>
      setState((s) => ({
        ...s,
        keywordAlerts: [
          { id: makeId(), keyword: keyword.toLowerCase(), createdAt: Date.now() },
          ...s.keywordAlerts.filter((a) => a.keyword !== keyword.toLowerCase()),
        ],
      }));

    const removeKeywordAlert = (alertId: string) =>
      setState((s) => ({
        ...s,
        keywordAlerts: s.keywordAlerts.filter((a) => a.id !== alertId),
      }));

    const markShipped = (
      orderId: string,
      courier: Courier,
      trackingNumber: string,
    ) => {
      void syncOrderStatusToSupabase(orderId, {
        status: 'shipped',
        shipped_at: new Date().toISOString(),
        tracking_number: trackingNumber,
      }, pushToast);
      setState((s) => ({
        ...s,
        orders: s.orders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                courier,
                trackingNumber,
                trackingStatus: 'Dispatched',
              }
            : o,
        ),
        notifications: [
          {
            id: makeId(),
            consumerEmail: s.orders.find((o) => o.id === orderId)?.consumerEmail ?? '',
            type: 'order' as const,
            title: 'Order Dispatched',
            description: `Your order has been shipped via ${courier}. Tracking: ${trackingNumber}`,
            link: '/consumer/orders',
            timestamp: Date.now(),
            read: false,
          },
          ...s.notifications,
        ],
      }));
    };

    const resolveDispute = (orderId: string) => {
        const order = s.orders.find((o) => o.id === orderId);
        if (order && (order.waveId || state.authUser)) {
          supabase
            .rpc('process_dispute_refund', { p_order_id: orderId })
            .then(({ error }) => {
              if (error) {
                pushToast('error', `Refund failed: ${error.message}`);
                return;
              }
              refetchUserState(state.authUser!.id);
              pushToast('success', 'Dispute resolved and refund processed.');
            });
        } else {
          void syncDisputeResolutionToSupabase(orderId, 'resolved_refunded', 'Refund processed after dispute resolution.', pushToast);
        }
      setState((s) => ({
        ...s,
        orders: s.orders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: 'refunded' as OrderStatus,
                disputeStatus: 'resolved_refunded' as DisputeStatus,
                dispute_status: 'resolved_refunded',
                escrowFrozen: false,
                escrowStatus: 'refunded' as EscrowStatus,
                refunded: true,
              }
            : o,
        ),
      }));
    };

    const resolveDisputeByAdmin = (orderId: string, decision: AdminDisputeDecision, adminNotes: string) =>
      setState((s) => {
        const order = s.orders.find((o) => o.id === orderId);
        if (!order || !order.escrowFrozen) return s;
        const now = Date.now();
        const priceAtPurchase = order.priceAtPurchase ?? order.priceInr;
        const imageBountyStillLocked = (order.imageReviewBounty ?? 0) - (order.imageReviewBountyReleased ? (order.imageReviewBounty ?? 0) : 0);
        const remainingLockedBounty = order.productBountyReleased ? imageBountyStillLocked : (order.bountyEscrow ?? order.bountyAmount);
        const brandPayout = order.brandNetPayout ?? Math.max(0, priceAtPurchase - (order.bountyEscrow ?? order.bountyAmount) - (order.platformFee ?? 0));
        const platformFee = order.platformFee ?? Math.round(priceAtPurchase * 0.05);
        if (decision === 'force_refund') {
          const newWithdrawable = s.consumerWallet.withdrawable + priceAtPurchase;
          const tx: WalletTransaction = {
            id: makeId(),
            type: 'REFUND',
            amount: priceAtPurchase,
            description: `Admin approved refund for Order #${orderId.slice(-6).toUpperCase()}`,
            timestamp: now,
            orderId,
            wallet: 'consumer',
            runningBalance: newWithdrawable,
          };
          return {
            ...s,
            orders: s.orders.map((o) => o.id === orderId ? {
              ...o,
              disputeStatus: 'resolved_refunded_by_admin' as const,
              escrowFrozen: false,
              escrowStatus: 'refunded' as EscrowStatus,
              settlementStatus: 'refunded' as const,
              refunded: true,
              adminNotes,
            } : o),
            consumerWallet: {
              ...s.consumerWallet,
              lockedEscrow: Math.max(0, s.consumerWallet.lockedEscrow - remainingLockedBounty),
              withdrawable: s.consumerWallet.withdrawable + priceAtPurchase,
            },
            mainEscrowBalance: Math.max(0, s.mainEscrowBalance - priceAtPurchase),
            walletTransactions: [tx, ...s.walletTransactions],
          };
        }
        if (decision === 'force_replacement') {
          return {
            ...s,
            orders: s.orders.map((o) => o.id === orderId ? {
              ...o,
              disputeStatus: 'replacement_issued_by_admin' as const,
              disputeFrozen: true,
              adminNotes,
              returnTrackingDueAt: now + 3 * 24 * 60 * 60 * 1000,
              settlementStatus: 'replaced' as const,
            } : o),
          };
        }
        const newBrandBalance = s.brandWalletBalance + brandPayout;
        const txs: WalletTransaction[] = [
          { id: makeId(), type: 'brand_payout', amount: brandPayout, description: `Brand payout after rejected dispute for ${order.productTitle}`, timestamp: now, orderId, wallet: 'brand', direction: 'credit', category: 'credit', runningBalance: newBrandBalance },
          { id: makeId(), type: 'PLATFORM_FEE_DEDUCTION', amount: platformFee, description: `Platform 5% fee for Order #${orderId.slice(-6).toUpperCase()}`, timestamp: now, orderId, wallet: 'brand', direction: 'debit', category: 'debit', runningBalance: newBrandBalance },
        ];
        return {
          ...s,
          orders: s.orders.map((o) => o.id === orderId ? {
            ...o,
            disputeStatus: 'rejected_by_admin' as const,
            escrowFrozen: false,
            escrowStatus: 'released' as EscrowStatus,
            settlementStatus: 'settled' as const,
            brandPayoutReleased: true,
            adminNotes,
          } : o),
          consumerWallet: { ...s.consumerWallet, lockedEscrow: Math.max(0, s.consumerWallet.lockedEscrow - remainingLockedBounty), withdrawable: s.consumerWallet.withdrawable + remainingLockedBounty },
          brandWalletBalance: s.brandWalletBalance + brandPayout,
          platformRevenue: s.platformRevenue + platformFee,
          mainEscrowBalance: Math.max(0, s.mainEscrowBalance - priceAtPurchase),
          walletTransactions: [...txs, ...s.walletTransactions],
        };
      });

    const addDisputeMessage = (orderId: string, text: string, images?: string[]) =>
      setState((s) => {
        const updatedMessages: DisputeMessage[] = [];
        const updated = s.orders.map((o) => {
          if (o.id !== orderId) return o;
          if (o.disputeStatus === 'resolved') return o;
          const msg: DisputeMessage = {
            id: makeId(),
            senderRole: 'brand',
            senderName: o.brandName,
            text,
            images: images && images.length > 0 ? images : undefined,
            timestamp: Date.now(),
          };
          updatedMessages.push(msg);
          return { ...o, disputeMessages: [...(o.disputeMessages ?? []), msg] };
        });
        if (updatedMessages.length > 0) {
          const order = s.orders.find((o) => o.id === orderId);
          const allMessages = [...(order?.disputeMessages ?? []), ...updatedMessages];
          void syncDisputeMessagesToSupabase(orderId, allMessages, pushToast);
        }
        window.setTimeout(() => window.dispatchEvent(new Event('marketplace_state_updated')), 0);
        return { ...s, orders: updated };
      });

    const addConsumerDisputeMessage = (orderId: string, text: string, images?: string[]) =>
      setState((s) => {
        const updatedMessages: DisputeMessage[] = [];
        const updated = s.orders.map((o) => {
          if (o.id !== orderId) return o;
          if (o.disputeStatus === 'resolved') return o;
          const msg: DisputeMessage = {
            id: makeId(),
            senderRole: 'consumer',
            senderName: s.session.email,
            text,
            images: images && images.length > 0 ? images : undefined,
            timestamp: Date.now(),
          };
          updatedMessages.push(msg);
          return { ...o, disputeMessages: [...(o.disputeMessages ?? []), msg] };
        });
        if (updatedMessages.length > 0) {
          const order = s.orders.find((o) => o.id === orderId);
          const allMessages = [...(order?.disputeMessages ?? []), ...updatedMessages];
          void syncDisputeMessagesToSupabase(orderId, allMessages, pushToast);
        }
        window.setTimeout(() => window.dispatchEvent(new Event('marketplace_state_updated')), 0);
        return { ...s, orders: updated };
      });

    const reshipOrder = (orderId: string, courier: Courier, trackingNumber: string) =>
      setState((s) => ({
        ...s,
        orders: s.orders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                courier,
                trackingNumber,
                trackingStatus: 'Dispatched' as TrackingStatus,
                disputeStatus: 'resolved' as const,
                escrowFrozen: false,
                reshipped: true,
              }
            : o,
        ),
      }));

    const refundOrderFromBrand = (orderId: string) => {
      void syncDisputeResolutionToSupabase(orderId, 'resolved_refunded', 'Refund approved and inventory restocked.', pushToast)
        .then(() => refreshDbOrders().then(() => refreshAllMarketData()));
      setState((s) => {
        const order = s.orders.find((o) => o.id === orderId);
        if (!order) return s;
        const now = Date.now();
        const refundAmount = order.priceAtPurchase ?? order.priceInr;
        const remainingLockedBounty = order.productBountyReleased
          ? (order.imageReviewBounty ?? 0) - (order.imageReviewBountyReleased ? (order.imageReviewBounty ?? 0) : 0)
          : (order.bountyEscrow ?? order.bountyAmount);
        const newWithdrawable = s.consumerWallet.withdrawable + refundAmount;
        const tx: WalletTransaction = {
          id: makeId(),
          type: 'REFUND',
          amount: refundAmount,
          description: `Refund issued for Order #${order.id.slice(-6).toUpperCase()}`,
          timestamp: now,
          orderId: order.id,
          wallet: 'consumer',
          runningBalance: newWithdrawable,
        };
        const refundedOrders = s.orders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                settlementStatus: 'refunded' as const,
                status: 'refunded' as OrderStatus,
                disputeStatus: 'resolved_refunded' as const,
                disputeFrozen: false,
                escrowFrozen: false,
                escrowStatus: 'refunded' as EscrowStatus,
                refunded: true,
              }
            : o,
        );
        const clawback = applySyndicateClawback(s.syndicateWaves, refundedOrders, orderId, 'DISPUTE_REFUND');
        const waveResult = reconcileWaveOrders(clawback.waves, clawback.orders);
        const extraTxs = clawback.clawbackTx ? [clawback.clawbackTx] : [];
        const extraNotifications = [clawback.clawbackNotification, ...(clawback.clawbackNotification ? [] : [])].filter(Boolean) as AppNotification[];
        return {
          ...s,
          orders: waveResult.orders,
          syndicateWaves: waveResult.waves,
          consumerWallet: {
            ...s.consumerWallet,
            lockedEscrow: Math.max(0, s.consumerWallet.lockedEscrow - remainingLockedBounty - clawback.clawbackAmount),
            withdrawable: newWithdrawable,
          },
          mainEscrowBalance: Math.max(0, s.mainEscrowBalance - refundAmount),
          walletTransactions: [...extraTxs, tx, ...s.walletTransactions],
          notifications: [
            ...extraNotifications,
            {
              id: makeId(),
              consumerEmail: order.consumerEmail,
              type: 'dispute' as const,
              title: 'Refund Issued',
              description: `₹${refundAmount.toLocaleString('en-IN')} refunded to your wallet for Order #${order.id.slice(-6).toUpperCase()}.`,
              link: '/consumer/orders',
              timestamp: now,
              read: false,
            },
            ...s.notifications,
          ],
        };
      });
    };

    const reshipOrderFromBrand = (
      orderId: string,
      details: {
        carrier: string;
        trackingNumber: string;
        estimatedDelivery?: number;
        returnOldItemRequired?: boolean;
      },
    ) => {
      void syncDisputeResolutionToSupabase(orderId, 'resolved_reshipped', `Doorstep Replacement Dispatched via ${details.carrier}. Tracking: ${details.trackingNumber}.`, pushToast, {}, { tracking_number: details.trackingNumber, shipped_at: new Date().toISOString() })
        .then(() => refreshDbOrders().then(() => refreshAllMarketData()));
      void syncDisputeMessagesToSupabase(orderId, appendSystemMessage([], `🔄 Doorstep Replacement Dispatched. Courier will collect defective unit at delivery. Escrow remains protected until you confirm delivery.`), pushToast);
      setState((s) => {
        const order = s.orders.find((o) => o.id === orderId);
        if (!order) return s;
        const now = Date.now();
        const timeline: TrackingTimelineStage[] = [
          { status: 'Replacement Shipped', time: now, location: 'Brand Hub' },
        ];
        const sysMsg: DisputeMessage = {
          id: `sys-${now}-${Math.random().toString(36).slice(2, 6)}`,
          senderRole: 'brand',
          text: `🔄 Doorstep Replacement Dispatched. Courier will collect defective unit at delivery. Escrow remains protected until you confirm delivery.`,
          timestamp: now,
        };
        return {
          ...s,
          orders: s.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: 'shipped' as OrderStatus,
                  trackingStatus: 'Dispatched' as TrackingStatus,
                  isReshipped: true,
                  trackingNumber: details.trackingNumber,
                  carrier: details.carrier,
                  courier: (['BlueDart', 'Delhivery', 'DTDC', 'FedEx'].includes(details.carrier) ? details.carrier : 'BlueDart') as Courier,
                  estimatedDelivery: details.estimatedDelivery,
                  returnOldItemRequired: details.returnOldItemRequired ?? false,
                  trackingTimeline: timeline,
                  disputeStatus: 'resolved_reshipped' as const,
                  dispute_status: 'resolved_reshipped',
                  isDelivered: false,
                  deliveredAt: undefined,
                  disputeFrozen: false,
                  escrowFrozen: false,
                  escrowStatus: 'locked' as EscrowStatus,
                  reshipped: true,
                  disputeMessages: [...(o.disputeMessages ?? []), sysMsg],
                }
              : o,
          ),
          notifications: [
            {
              id: makeId(),
              consumerEmail: order.consumerEmail,
              type: 'order' as const,
              title: 'Replacement Dispatched',
              description: `A replacement for Order #${order.id.slice(-6).toUpperCase()} has been shipped via ${details.carrier}. Tracking: ${details.trackingNumber}`,
              link: '/consumer/orders',
              timestamp: now,
              read: false,
            },
            ...s.notifications,
          ],
        };
      });
    };

    const fullRefundOrder = (orderId: string) =>
      setState((s) => {
        const order = s.orders.find((o) => o.id === orderId);
        if (!order) return s;
        const now = Date.now();
        const refundAmount = order.priceAtPurchase ?? order.priceInr;
        const remainingLockedBounty = order.productBountyReleased
          ? (order.imageReviewBounty ?? 0) - (order.imageReviewBountyReleased ? (order.imageReviewBounty ?? 0) : 0)
          : (order.bountyEscrow ?? order.bountyAmount);
        const refundedOrders = s.orders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: 'refunded' as OrderStatus,
                disputeStatus: 'resolved_refunded' as const,
                dispute_status: 'resolved_refunded',
                escrowFrozen: false,
                escrowStatus: 'refunded' as EscrowStatus,
                refunded: true,
              }
            : o,
        );
        const clawback = applySyndicateClawback(s.syndicateWaves, refundedOrders, orderId, 'FULL_REFUND');
        const waveResult = reconcileWaveOrders(clawback.waves, clawback.orders);
        const extraTxs = clawback.clawbackTx ? [clawback.clawbackTx] : [];
        const extraNotifications = clawback.clawbackNotification ? [clawback.clawbackNotification] : [];
        return {
          ...s,
          orders: waveResult.orders,
          syndicateWaves: waveResult.waves,
          consumerWallet: {
            ...s.consumerWallet,
            lockedEscrow: Math.max(0, s.consumerWallet.lockedEscrow - remainingLockedBounty - clawback.clawbackAmount),
            withdrawable: s.consumerWallet.withdrawable + refundAmount,
          },
          mainEscrowBalance: Math.max(0, s.mainEscrowBalance - refundAmount),
          walletTransactions: [...extraTxs, ...s.walletTransactions],
          notifications: [
            ...extraNotifications,
            {
              id: makeId(),
              consumerEmail: order.consumerEmail,
              type: 'dispute' as const,
              title: 'Full Refund Processed',
              description: `₹${refundAmount.toLocaleString('en-IN')} refunded to your wallet for Order #${order.id.slice(-6).toUpperCase()}.`,
              link: '/consumer/orders',
              timestamp: now,
              read: false,
            },
            ...s.notifications,
          ],
        };
      });

    const addToBag = (item: Omit<BagItem, 'id'>) =>
      setState((s) => ({
        ...s,
        bagItems: [...s.bagItems, { ...item, id: makeId() }],
      }));

    const removeFromBag = (itemId: string) =>
      setState((s) => ({
        ...s, bagItems: s.bagItems.filter((b) => b.id !== itemId),
      }));

    const updateBagQuantity = (itemId: string, qty: number) =>
      setState((s) => ({
        ...s, bagItems: s.bagItems.map((b) =>
          b.id === itemId ? { ...b, quantity: Math.max(1, qty) } : b,
        ),
      }));

    const clearBag = () =>
      setState((s) => ({ ...s, bagItems: [] }));

    const checkoutBag = (addressId: string, appliedBrandCredits?: Record<string, number>) =>
      setState((s) => {
        const creditMap = appliedBrandCredits ?? {};
        const newOrders: Order[] = s.bagItems.map((item) => {
          const qty = Math.max(1, Number(item.quantity) || 1);
          const unitPrice = item.priceInr;
          const linePrice = unitPrice * qty;
          const platformFee = Math.round(linePrice * 0.05);
          const activeWave = s.syndicateWaves.find(
            (w) => w.status === 'active' && w.productId === item.productId && Date.now() < w.startTime + w.durationMs,
          );
          let unitProductBounty: number;
          let unitImageReviewBounty = 0;
          if (activeWave) {
            const existingCount = s.orders.filter(
              (o) => activeWave.orderIds.includes(o.id) && o.status !== 'cancelled',
            ).length;
            const projectedCount = existingCount + 1;
            const sortedTiers = [...activeWave.tiers].sort((a, b) => b.thresholdUnits - a.thresholdUnits);
            const projectedTier = sortedTiers.find((t) => projectedCount >= t.thresholdUnits) ?? activeWave.tiers[0];
            unitProductBounty = Math.round(unitPrice * (projectedTier.bountyPercent / 100));
            unitImageReviewBounty = activeWave.hasImageBounty ? activeWave.imageBountyAmount : Math.max(0, item.autoBounty - unitProductBounty);
          } else {
            unitProductBounty = Math.max(Math.round(unitPrice * 0.05), item.autoBounty);
            unitImageReviewBounty = Math.max(0, item.autoBounty - unitProductBounty);
          }
          const productBounty = unitProductBounty * qty;
          const imageReviewBounty = unitImageReviewBounty * qty;
          const totalBounty = productBounty + imageReviewBounty;
          const brandNet = linePrice - platformFee - totalBounty;
          const creditRecord = creditMap[item.brandName] ? s.brandCredits.find((c) => c.brandId === item.brandName) : undefined;
          const creditApplied = creditRecord ? Math.min(creditMap[item.brandName] ?? 0, creditRecord.amount, linePrice) : 0;
          const netPaid = Math.max(0, linePrice - creditApplied);
          return {
            id: crypto.randomUUID(),
            consumerEmail: s.session.email,
            productId: item.productId,
            productTitle: item.productTitle,
            brandName: item.brandName,
            priceInr: linePrice,
            bountyAmount: productBounty,
            size: item.size,
            color: item.color,
            image: item.image,
            trackingStatus: 'Placed' as const,
            trackingNumber: makeTrackingNumber(),
            timestamp: Date.now(),
            addressId,
            disputeStatus: 'resolved' as const,
            priceAtPurchase: linePrice,
            settlementStatus: 'pending' as const,
            bountyEscrow: totalBounty,
            brandNetPayout: brandNet,
            platformFee,
            escrowStatus: 'locked' as const,
            reviewStatus: 'pending_upload' as ReviewStatus,
            bountyReleased: false,
            brandPayoutReleased: false,
            productBounty,
            imageReviewBounty,
            productBountyReleased: false,
            imageReviewBountyReleased: false,
            brandCreditApplied: creditApplied,
            netPaid,
            quantity: qty,
            isSyndicateOrder: !!activeWave,
            waveId: activeWave?.id,
            hasImageBounty: activeWave?.hasImageBounty,
            imageEscrowHeld: activeWave?.hasImageBounty ?? false,
          };
        });
        const totalBountyEscrow = newOrders.reduce((sum, o) => sum + (o.bountyEscrow ?? ((o.productBounty ?? 0) + (o.imageReviewBounty ?? 0))), 0);
        const totalPaid = newOrders.reduce((sum, o) => sum + (o.netPaid ?? o.priceInr), 0);
        const totalCreditApplied = newOrders.reduce((sum, o) => sum + (o.brandCreditApplied ?? 0), 0);
        const paymentTxs: WalletTransaction[] = newOrders.map((o) => ({
          id: makeId(),
          type: 'SANDBOX_PAYMENT' as const,
          amount: o.netPaid ?? o.priceAtPurchase ?? o.priceInr,
          description: `Sandbox Instant Pay — Order #${o.id.slice(-6).toUpperCase()} (PAID)`,
          timestamp: Date.now(),
          orderId: o.id,
          wallet: 'consumer' as const,
          direction: 'debit' as const,
          category: 'debit' as const,
          runningBalance: s.consumerWallet.withdrawable,
        }));
        const creditTxs: WalletTransaction[] = newOrders
          .filter((o) => (o.brandCreditApplied ?? 0) > 0)
          .map((o) => ({
            id: makeId(),
            type: 'BRAND_CREDIT_REDEEMED' as const,
            amount: o.brandCreditApplied ?? 0,
            description: `Applied ₹${(o.brandCreditApplied ?? 0).toLocaleString('en-IN')} ${o.brandName} credit on Order #${o.id.slice(-6).toUpperCase()}`,
            timestamp: Date.now(),
            orderId: o.id,
            wallet: 'consumer' as const,
            direction: 'debit' as const,
            category: 'debit' as const,
            runningBalance: s.consumerWallet.withdrawable,
          }));
        const updatedCredits = totalCreditApplied > 0
          ? s.brandCredits
              .map((c) => {
                const deducted = creditMap[c.brandId] ?? 0;
                return deducted > 0
                  ? { ...c, amount: Math.max(0, c.amount - Math.min(deducted, c.amount)), updatedAt: Date.now() }
                  : c;
              })
              .filter((c) => c.amount > 0)
          : s.brandCredits;
        let waveOrders = [...newOrders, ...s.orders];
        let waveWaves = s.syndicateWaves;
        const allUpgradeTxs: WalletTransaction[] = [];
        const touchedWaveIds = new Set<string>();
        for (const newOrder of newOrders) {
          if (newOrder.waveId) touchedWaveIds.add(newOrder.waveId);
          const result = addOrderToActiveWave(waveWaves, waveOrders, newOrder);
          waveOrders = result.orders;
          waveWaves = result.waves;
          allUpgradeTxs.push(...result.upgradeTxs);
        }
        waveWaves = waveWaves.map((w) =>
          touchedWaveIds.has(w.id)
            ? { ...w, currentUnits: (w.currentUnits ?? 0) + newOrders.filter((o) => o.waveId === w.id).length }
            : w,
        );
        for (const wid of touchedWaveIds) {
          const inc = newOrders.filter((o) => o.waveId === wid).length;
          supabase
            .from('syndicate_waves')
            .update({ current_units: (s.syndicateWaves.find((w) => w.id === wid)?.currentUnits ?? 0) + inc })
            .eq('id', wid)
            .then();
        }
        const upgradeDeltaTotal = allUpgradeTxs.reduce((sum, t) => sum + t.amount, 0);
        const newSalesRecords: SalesRecord[] = newOrders.map((o) => {
          const bagItem = s.bagItems.find((b) => b.productId === o.productId);
          const qty = Math.max(1, Number(bagItem?.quantity) || 1);
          return {
            id: makeId(),
            productId: o.productId,
            brandName: o.brandName,
            productTitle: o.productTitle,
            category: s.products.find((p) => p.id === o.productId)?.category ?? '',
            salePrice: o.priceInr,
            bountyPaid: o.bountyAmount,
            buyerEmail: o.consumerEmail,
            timestamp: Date.now(),
            quantity: qty,
          };
        });

        const updatedProducts = newOrders.reduce((acc, o) => {
          const product = acc.find((p) => p.id === o.productId);
          const qty = Math.max(1, Number(s.bagItems.find((b) => b.productId === o.productId)?.quantity) || 1);
          if (product) {
            void insertOrderToSupabase({
              id: o.id,
              productId: o.productId,
              productTitle: o.productTitle,
              brandName: o.brandName,
              brandId: product.brandId ?? null,
              buyerId: s.authUser?.id ?? null,
              consumerEmail: o.consumerEmail,
              unitPrice: o.priceInr / qty,
              quantity: qty,
              productBounty: (o.productBounty ?? o.bountyAmount ?? 0) / qty,
              imageReviewBounty: (o.imageReviewBounty ?? 0) / qty,
              size: o.size,
              color: o.color,
              trackingNumber: o.trackingNumber,
              hasImageBounty: o.hasImageBounty,
              isSyndicateOrder: !!o.waveId,
              waveId: o.waveId,
              syndicateTierUnlocked: o.syndicateTierUnlocked,
              reviewStatus: o.reviewStatus,
              storeCreditUsed: o.brandCreditApplied ?? 0,
              netCashPaid: o.netPaid ?? o.priceInr,
              toast: pushToast,
            });
            void syncSoldCountToSupabase(o.productId, qty, pushToast).then((newSold) => {
              if (newSold != null) setState((s3) => ({ ...s3, products: setProductSoldCount(s3.products, o.productId, newSold) }));
            });
            void syncStockToSupabase(o.productId, qty, pushToast, o.size, o.color).then((newStock) => {
              if (newStock != null) setState((s3) => ({ ...s3, products: setProductStock(s3.products, o.productId, newStock, o.size, o.color) }));
            });
          }
          return acc;
        }, s.products);

        const completedIntentIds: string[] = [];
        newOrders.forEach((o) => {
          const product = s.products.find((p) => p.id === o.productId);
          if (!product) return;
          s.intents.forEach((i) => {
            if (i.status !== 'active' || i.consumerEmail !== o.consumerEmail) return;
            const query = i.searchQuery.toLowerCase().trim();
            if (!query) return;
            const matches = product.keywords.some((kw) => {
              const k = kw.toLowerCase().trim();
              return query.includes(k) || k.includes(query);
            }) || product.title.toLowerCase().includes(query) || product.category.toLowerCase().includes(query);
            if (matches) completedIntentIds.push(i.id);
          });
        });
        deleteIntentsFromSupabase(completedIntentIds);
        void refreshAllMarketData();

        return {
          ...s,
          orders: waveOrders,
          syndicateWaves: waveWaves,
          salesAnalytics: [...newSalesRecords, ...s.salesAnalytics],
          products: updatedProducts,
          intents: s.intents.filter((i) => !completedIntentIds.includes(i.id)),
          consumerWallet: {
            ...s.consumerWallet,
            lockedEscrow: s.consumerWallet.lockedEscrow + totalBountyEscrow + upgradeDeltaTotal,
          },
          brandCredits: updatedCredits,
          bagItems: [],
          mainEscrowBalance: s.mainEscrowBalance + totalPaid,
          walletTransactions: [...allUpgradeTxs, ...paymentTxs, ...creditTxs, ...s.walletTransactions],
        };
      });

    const deleteSalesRecord = (recordId: string) =>
      setState((s) => ({
        ...s,
        salesAnalytics: s.salesAnalytics.filter((r) => r.id !== recordId),
      }));

    const addReview = async (review: Omit<Review, 'id' | 'timestamp'>): Promise<Review | null> => {
      const images = review.images ?? (review.image ? [review.image] : []);
      const { data, error } = await supabase
        .from('reviews')
        .insert({
          product_id: review.productId,
          consumer_email: review.consumerEmail,
          rating: review.rating,
          comment: review.comment,
          image_url: images[0] ?? null,
          image_urls: images.length > 0 ? images : null,
          bounty_claimed: review.bountyClaimed ?? false,
        })
        .select()
        .single();
      if (error) {
        console.error('Review insert error:', error);
        pushToast('error', error?.message || 'Failed to publish review');
        return null;
      }
      const dbImages: string[] = Array.isArray(data.image_urls) ? data.image_urls : (data.image_url ? [data.image_url] : []);
      const newReview: Review = {
        id: data.id,
        productId: data.product_id,
        consumerEmail: data.consumer_email,
        rating: data.rating,
        comment: data.comment,
        timestamp: new Date(data.created_at).getTime(),
        ...(dbImages.length > 0 ? { images: dbImages, image: dbImages[0] } : {}),
        ...(data.bounty_claimed ? { bountyClaimed: data.bounty_claimed } : {}),
      };
      setState((s) => ({
        ...s,
        reviews: [newReview, ...s.reviews],
      }));
      return newReview;
    };

    const pushToast = (type: Toast['type'], message: string) => {
      const id = makeId();
      setState((s) => ({
        ...s,
        toasts: [...s.toasts, { id, type, message }],
      }));
      window.setTimeout(() => {
        setState((s) => ({
          ...s,
          toasts: s.toasts.filter((t) => t.id !== id),
        }));
      }, 4000);
    };

    const dismissToast = (toastId: string) =>
      setState((s) => ({
        ...s,
        toasts: s.toasts.filter((t) => t.id !== toastId),
      }));

    const pushNotification = (
      n: Omit<AppNotification, 'id' | 'timestamp' | 'read' | 'consumerEmail'>,
    ) =>
      setState((s) => ({
        ...s,
        notifications: [
          {
            ...n,
            id: makeId(),
            consumerEmail: s.session.email,
            timestamp: Date.now(),
            read: false,
          },
          ...s.notifications,
        ],
      }));

    const markNotificationRead = (id: string) =>
      setState((s) => ({
        ...s,
        notifications: s.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n,
        ),
      }));

    const markAllNotificationsRead = () =>
      setState((s) => ({
        ...s,
        notifications: s.notifications.map((n) => ({ ...n, read: true })),
      }));

    const removeNotification = (id: string) =>
      setState((s) => ({
        ...s,
        notifications: s.notifications.filter((n) => n.id !== id),
      }));

    const addAddress = async (address: Omit<Address, 'id' | 'consumerEmail'>): Promise<Address> => {
      const isDefault = Boolean(address.isDefault);
      if (isDefault) {
        await supabase.from('addresses').update({ is_default: false }).neq('id', '00000000-0000-0000-0000-000000000000');
      }
      const payload = {
        label: address.addressType ?? 'Home',
        full_name: address.fullName,
        phone: address.phone ?? address.phoneNumber ?? '',
        address_line: `${address.houseNo ?? address.flatHouseNo ?? ''}, ${address.area ?? address.streetArea ?? ''}, ${address.landmark ?? ''}`.trim(),
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        is_default: isDefault,
        consumer_email: state.session.email,
      };
      const { data, error } = await supabase
        .from('addresses')
        .insert(payload)
        .select()
        .single();
      if (error) {
        pushToast('error', `[DB Save Error]: ${error.message} (${error.code ?? 'unknown'})`);
        return address as Address;
      }
      const newAddr = normalizeDbAddress(data);
      setState((s) => {
        const isFirst = s.addresses.length === 0;
        const addresses = isFirst
          ? [{ ...newAddr, isDefault: true }]
          : isDefault
            ? [newAddr, ...s.addresses.map((a) => ({ ...a, isDefault: false }))]
            : [...s.addresses, newAddr];
        return { ...s, addresses };
      });
      return newAddr;
    };

    const updateAddress = async (addressId: string, updates: Partial<Omit<Address, 'id' | 'consumerEmail'>>) => {
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (updates.fullName !== undefined) payload.full_name = updates.fullName;
      if (updates.phone !== undefined) payload.phone = updates.phone ?? updates.phoneNumber ?? '';
      if (updates.pincode !== undefined) payload.pincode = updates.pincode;
      if (updates.city !== undefined) payload.city = updates.city;
      if (updates.state !== undefined) payload.state = updates.state;
      if (updates.isDefault !== undefined) payload.is_default = Boolean(updates.isDefault);
      if (updates.houseNo !== undefined || updates.area !== undefined) {
        const existing = state.addresses.find((a) => a.id === addressId);
        payload.address_line = `${updates.houseNo ?? existing?.houseNo ?? ''}, ${updates.area ?? existing?.area ?? ''}, ${updates.landmark ?? existing?.landmark ?? ''}`.trim();
      }
      if (updates.isDefault === true) {
        await supabase.from('addresses').update({ is_default: false }).neq('id', addressId);
      }
      const { error: updateError } = await supabase.from('addresses').update(payload).eq('id', addressId);
      if (updateError) {
        pushToast('error', `[DB Update Error]: ${updateError.message} (${updateError.code ?? 'unknown'})`);
        return;
      }
      setState((s) => ({
        ...s,
        addresses: s.addresses.map((a) =>
          a.id === addressId ? { ...a, ...updates } : updates.isDefault === true ? { ...a, isDefault: false } : a,
        ),
      }));
    };

    const saveAddress = async (address: Omit<Address, 'id' | 'consumerEmail'> & { id?: string }): Promise<Address> => {
      if (address.id) {
        const existing = state.addresses.find((a) => a.id === address.id);
        if (existing) {
          await updateAddress(address.id, address);
          if (address.isDefault) {
            setState((s) => ({
              ...s,
              addresses: s.addresses.map((a) =>
                a.id === address.id ? { ...a, ...address } as Address : { ...a, isDefault: false },
              ),
            }));
          } else {
            setState((s) => ({
              ...s,
              addresses: s.addresses.map((a) =>
                a.id === address.id ? { ...a, ...address } as Address : a,
              ),
            }));
          }
          return { ...existing, ...address } as Address;
        }
      }
      return addAddress(address);
    };

    const removeAddress = async (addressId: string) => {
      const { error } = await supabase.from('addresses').delete().eq('id', addressId);
      if (error) {
        pushToast('error', `[DB Delete Error]: ${error.message} (${error.code ?? 'unknown'})`);
        return;
      }
      setState((s) => ({
        ...s,
        addresses: s.addresses.filter((a) => a.id !== addressId),
      }));
      pushToast('success', 'Address deleted from database');
    };

    const setDefaultAddress = async (addressId: string) => {
      const { error: clearError } = await supabase.from('addresses').update({ is_default: false }).neq('id', addressId);
      if (clearError) {
        pushToast('error', `[DB Error]: ${clearError.message} (${clearError.code ?? 'unknown'})`);
        return;
      }
      const { error: setError } = await supabase.from('addresses').update({ is_default: true }).eq('id', addressId);
      if (setError) {
        pushToast('error', `[DB Error]: ${setError.message} (${setError.code ?? 'unknown'})`);
        return;
      }
      setState((s) => ({
        ...s,
        addresses: s.addresses.map((a) => ({
          ...a,
          isDefault: a.id === addressId,
        })),
      }));
    };

    const addIntent = (
      intent: Omit<
        Intent,
        'id' | 'status' | 'createdAt' | 'consumerEmail' | 'expiresAt' | 'productSnapshots'
      >,
    ): Promise<Intent> => {
      const intentId = crypto.randomUUID();
      const matchingProducts = state.products.filter((p) =>
        p.keywords.some((k) => intent.searchQuery.toLowerCase().includes(k)) ||
        p.category.toLowerCase().includes(intent.searchQuery.toLowerCase()) ||
        p.title.toLowerCase().includes(intent.searchQuery.toLowerCase()),
      );
      const productSnapshots: IntentProductSnapshot[] = matchingProducts.map((p) => ({
        productId: p.id,
        baselinePrice: p.priceInr,
        baselineBounty: p.imageReviewBountyAmount ?? p.autoBounty ?? 0,
      }));
      const now = Date.now();
      const newIntent: Intent = {
        ...intent,
        id: intentId,
        consumerEmail: state.session.email,
        status: 'active',
        createdAt: now,
        expiresAt: now + INTENT_TTL,
        productSnapshots,
      };
      supabase
        .from('buyer_intents')
        .insert({
          id: intentId,
          title: intent.searchQuery,
          search_query: intent.searchQuery,
          buyer_id: state.authUser?.id ?? null,
          buyer_email: state.session.email,
          status: 'active',
          created_at: new Date(now).toISOString(),
          expires_at: new Date(now + INTENT_TTL).toISOString(),
        })
        .then(({ error }) => {
          if (error) pushToast('error', `Failed to save intent to cloud: ${error.message}`);
        });
      return new Promise<Intent>((resolve) => {
        resolverRef.current = (next) => {
          const arr = (next as MarketState).intents;
          const confirmed = arr.find((i) => i.id === newIntent.id);
          resolve(confirmed ?? newIntent);
        };
        setState((s) => ({ ...s, intents: [newIntent, ...s.intents] }));
      });
    };

    const fulfillIntent = (
      intentId: string,
      product: Product,
      size: string,
      color: string,
      addressId?: string,
      appliedBrandCredit?: number,
      bountyOverride?: number,
    ) => {
      const activeWave = state.syndicateWaves.find(
        (w) => w.status === 'active' && w.productId === product.id && Date.now() < w.startTime + w.durationMs,
      );
      if (activeWave && state.authUser) {
        const hasImageBounty = Boolean(activeWave.hasImageBounty && Number(activeWave.imageBountyAmount) > 0);
        const imageBountyAmount = hasImageBounty ? Number(activeWave.imageBountyAmount) : 0;
        supabase
          .rpc('process_syndicate_order', {
            p_wave_id: activeWave.id,
            p_product_id: product.id,
            p_unit_price: product.priceInr,
            p_has_image_bounty: hasImageBounty,
            p_image_bounty_amount: imageBountyAmount,
          })
          .then(({ data, error }) => {
            if (error) {
              pushToast('error', `Order failed: ${error.message}`);
              return;
            }
            const rpcData = data as { bounty_locked: number; unlocked_tier: number } | null;
            const bountyEarned = Math.round(rpcData?.bounty_locked ?? 0);
            const tierUnlocked = rpcData?.unlocked_tier ?? 1;
            deleteIntentsFromSupabase([intentId]);
            setState((s2) => ({
              ...s2,
              intents: s2.intents.filter((i) => i.id !== intentId),
              syndicateWaves: s2.syndicateWaves.map((w) =>
                w.id === activeWave.id ? { ...w, currentUnits: (w.currentUnits ?? 0) + 1 } : w,
              ),
              consumerWallet: {
                ...s2.consumerWallet,
                lockedEscrow: s2.consumerWallet.lockedEscrow + bountyEarned + (hasImageBounty ? imageBountyAmount : 0),
              },
            }));
            const syndicateOrderId = crypto.randomUUID();
            const syndicateTrackingNum = makeTrackingNumber();
            void insertOrderToSupabase({
              id: syndicateOrderId,
              productId: product.id,
              productTitle: product.title,
              brandName: product.brandName,
              brandId: product.brandId ?? null,
              buyerId: state.authUser?.id ?? null,
              consumerEmail: s2.session.email,
              unitPrice: product.priceInr,
              quantity: 1,
              productBounty: bountyEarned,
              imageReviewBounty: hasImageBounty ? imageBountyAmount : 0,
              size,
              color,
              trackingNumber: syndicateTrackingNum,
              hasImageBounty,
              isSyndicateOrder: true,
              waveId: activeWave.id,
              syndicateTierUnlocked: tierUnlocked,
              reviewStatus: hasImageBounty ? 'pending' : 'none',
              toast: pushToast,
            });
            void syncSoldCountToSupabase(product.id, 1, pushToast).then((newSold) => {
              if (newSold != null) setState((s3) => ({ ...s3, products: setProductSoldCount(s3.products, product.id, newSold) }));
            });
            void syncStockToSupabase(product.id, 1, pushToast, size, color).then((newStock) => {
              if (newStock != null) setState((s3) => ({ ...s3, products: setProductStock(s3.products, product.id, newStock, size, color) }));
            });
            refetchUserState(state.authUser!.id);
            pushToast('success', `Purchase complete! \u20b9${bountyEarned.toLocaleString('en-IN')} locked in escrow (Tier ${tierUnlocked} unlocked).`);
          });
        return;
      }
      setState((s) => {
        const intent = s.intents.find((i) => i.id === intentId);
        if (!intent || intent.status === 'fulfilled') return s;
        const validCreditApplied = Math.min(appliedBrandCredit ?? 0, product.priceInr);
        const netPaid = Math.max(0, product.priceInr - validCreditApplied);
        const record: SalesRecord = {
          id: makeId(),
          productId: product.id,
          brandName: product.brandName,
          productTitle: product.title,
          category: product.category,
          salePrice: product.priceInr,
          bountyPaid: product.autoBounty,
          buyerEmail: intent.consumerEmail,
          timestamp: Date.now(),
        };
        const platformFee = Math.round(product.priceInr * 0.05);
        const productBounty = bountyOverride != null
          ? Math.max(0, Math.round(bountyOverride))
          : Math.max(Math.round(product.priceInr * 0.05), product.autoBounty);
        const imageReviewBounty = bountyOverride != null ? 0 : Math.max(0, product.autoBounty - productBounty);
        const totalBounty = productBounty + imageReviewBounty;
        const brandNet = product.priceInr - platformFee - totalBounty;
        const order: Order = {
          id: crypto.randomUUID(),
          consumerEmail: intent.consumerEmail,
          productId: product.id,
          productTitle: product.title,
          brandName: product.brandName,
          priceInr: product.priceInr,
          bountyAmount: product.autoBounty,
          size,
          color,
          image: product.images[0] ?? '',
          trackingStatus: 'Placed',
          trackingNumber: makeTrackingNumber(),
          timestamp: Date.now(),
          addressId,
          disputeStatus: 'resolved',
          priceAtPurchase: product.priceInr,
          settlementStatus: 'pending' as const,
          bountyEscrow: totalBounty,
          brandNetPayout: brandNet,
          platformFee,
          escrowStatus: 'locked' as EscrowStatus,
          reviewStatus: 'pending_upload' as ReviewStatus,
          bountyReleased: false,
          brandPayoutReleased: false,
          productBounty,
          imageReviewBounty,
          productBountyReleased: false,
          imageReviewBountyReleased: false,
          brandCreditApplied: validCreditApplied,
          netPaid,
        };
        const paymentTx: WalletTransaction = {
          id: makeId(),
          type: 'SANDBOX_PAYMENT',
          amount: netPaid,
          description: `Sandbox Instant Pay — Order #${order.id.slice(-6).toUpperCase()} (PAID)`,
          timestamp: Date.now(),
          orderId: order.id,
          wallet: 'consumer',
          direction: 'debit',
          category: 'debit',
          runningBalance: s.consumerWallet.withdrawable,
        };
        const creditTx: WalletTransaction | null = validCreditApplied > 0
          ? {
              id: makeId(),
              type: 'BRAND_CREDIT_REDEEMED',
              amount: validCreditApplied,
              description: `Applied ₹${validCreditApplied.toLocaleString('en-IN')} ${product.brandName} credit on Order #${order.id.slice(-6).toUpperCase()}`,
              timestamp: Date.now(),
              orderId: order.id,
              wallet: 'consumer',
              direction: 'debit',
              category: 'debit',
              runningBalance: s.consumerWallet.withdrawable,
            }
          : null;
        const updatedCredits = validCreditApplied > 0
          ? s.brandCredits
              .map((c) =>
                c.brandId === product.brandName
                  ? { ...c, amount: Math.max(0, c.amount - validCreditApplied), updatedAt: Date.now() }
                  : c,
              )
              .filter((c) => c.amount > 0)
          : s.brandCredits;
        const waveResult = addOrderToActiveWave(s.syndicateWaves, s.orders, order);
        const updatedOrder = waveResult.orders.find((o) => o.id === order.id) ?? order;
        const lockedBounty = updatedOrder.productBounty ?? updatedOrder.bountyAmount ?? product.autoBounty;
        const fulfillUpgradeDelta = waveResult.upgradeTxs.reduce((sum, t) => sum + t.amount, 0);
        const fulfillActiveWave = s.syndicateWaves.find(
          (w) => w.status === 'active' && w.productId === product.id && Date.now() < w.startTime + w.durationMs,
        );
        if (fulfillActiveWave) {
          supabase
            .from('syndicate_waves')
            .update({ current_units: (fulfillActiveWave.currentUnits ?? 0) + 1 })
            .eq('id', fulfillActiveWave.id)
            .then();
        }
        void insertOrderToSupabase({
          id: order.id,
          productId: product.id,
          productTitle: product.title,
          brandName: product.brandName,
          brandId: product.brandId ?? null,
          buyerId: s.authUser?.id ?? null,
          consumerEmail: intent.consumerEmail,
          unitPrice: product.priceInr,
          quantity: 1,
          productBounty,
          imageReviewBounty,
          size,
          color,
          trackingNumber: order.trackingNumber,
          hasImageBounty: false,
          isSyndicateOrder: !!order.waveId,
          waveId: order.waveId,
          reviewStatus: order.reviewStatus,
          storeCreditUsed: validCreditApplied,
          netCashPaid: netPaid,
          toast: pushToast,
        }).then(() => { void refreshAllMarketData(); });
        void syncSoldCountToSupabase(product.id, 1, pushToast).then((newSold) => {
          if (newSold != null) setState((s2) => ({ ...s2, products: setProductSoldCount(s2.products, product.id, newSold) }));
        });
        void syncStockToSupabase(product.id, 1, pushToast, size, color).then((newStock) => {
          if (newStock != null) setState((s2) => ({ ...s2, products: setProductStock(s2.products, product.id, newStock, size, color) }));
        });
        deleteIntentsFromSupabase([intentId]);
        return {
          ...s,
          intents: s.intents.filter((i) => i.id !== intentId),
          syndicateWaves: waveResult.waves.map((w) =>
            fulfillActiveWave && w.id === fulfillActiveWave.id ? { ...w, currentUnits: (w.currentUnits ?? 0) + 1 } : w,
          ),
          consumerWallet: {
            ...s.consumerWallet,
            lockedEscrow: s.consumerWallet.lockedEscrow + lockedBounty + fulfillUpgradeDelta,
          },
          brandWallet: {
            globalBudget: Math.max(0, s.brandWallet.globalBudget - product.autoBounty),
          },
          brandCredits: updatedCredits,
          salesAnalytics: [record, ...s.salesAnalytics],
          orders: waveResult.orders,
          mainEscrowBalance: s.mainEscrowBalance + netPaid,
          walletTransactions: [...waveResult.upgradeTxs, paymentTx, ...(creditTx ? [creditTx] : []), ...s.walletTransactions],
        };
      });
    };

    const refetchUserState = async (userId: string) => {
      const [profileRes, ledgerRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('wallet_ledger').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      ]);
      const profile = profileRes.data as DbProfile | null;
      setState((s) => ({
        ...s,
        authProfile: profile,
        consumerWallet: profile
          ? { lockedEscrow: Number(profile.pending_escrow_bounty), withdrawable: Number(profile.wallet_balance) }
          : s.consumerWallet,
        walletTransactions: ledgerRes.data && ledgerRes.data.length > 0
          ? ledgerRes.data.map((entry: { id: string; type: string; amount: number; description: string; created_at: string; order_id: string | null; balance_after: number }) => ({
              id: entry.id,
              type: entry.type as WalletTransaction['type'],
              amount: Number(entry.amount),
              description: entry.description,
              timestamp: new Date(entry.created_at).getTime(),
              orderId: entry.order_id ?? undefined,
              runningBalance: Number(entry.balance_after),
            }))
          : s.walletTransactions,
      }));
    };

    const placeDirectOrder = (
      product: Product,
      size: string,
      color: string,
      addressId?: string,
      appliedBrandCredit?: number,
    ) => {
      const activeWave = state.syndicateWaves.find(
        (w) => w.status === 'active' && w.productId === product.id && Date.now() < w.startTime + w.durationMs,
      );
      if (activeWave && state.authUser) {
        const hasImageBounty = Boolean(activeWave.hasImageBounty && Number(activeWave.imageBountyAmount) > 0);
        const imageBountyAmount = hasImageBounty ? Number(activeWave.imageBountyAmount) : 0;
        supabase
          .rpc('process_syndicate_order', {
            p_wave_id: activeWave.id,
            p_product_id: product.id,
            p_unit_price: product.priceInr,
            p_has_image_bounty: hasImageBounty,
            p_image_bounty_amount: imageBountyAmount,
          })
          .then(({ data, error }) => {
            if (error) {
              pushToast('error', `Order failed: ${error.message}`);
              return;
            }
            const rpcData = data as { bounty_locked: number; unlocked_tier: number } | null;
            const bountyEarned = Math.round(rpcData?.bounty_locked ?? 0);
            const tierUnlocked = rpcData?.unlocked_tier ?? 1;
            setState((s2) => ({
              ...s2,
              syndicateWaves: s2.syndicateWaves.map((w) =>
                w.id === activeWave.id ? { ...w, currentUnits: (w.currentUnits ?? 0) + 1 } : w,
              ),
              consumerWallet: {
                ...s2.consumerWallet,
                lockedEscrow: s2.consumerWallet.lockedEscrow + bountyEarned + (hasImageBounty ? imageBountyAmount : 0),
              },
            }));
            const directSyndicateOrderId = crypto.randomUUID();
            const directSyndicateTrackingNum = makeTrackingNumber();
            void insertOrderToSupabase({
              id: directSyndicateOrderId,
              productId: product.id,
              productTitle: product.title,
              brandName: product.brandName,
              brandId: product.brandId ?? null,
              buyerId: state.authUser?.id ?? null,
              consumerEmail: s2.session.email,
              unitPrice: product.priceInr,
              quantity: 1,
              productBounty: bountyEarned,
              imageReviewBounty: hasImageBounty ? imageBountyAmount : 0,
              size,
              color,
              trackingNumber: directSyndicateTrackingNum,
              hasImageBounty,
              isSyndicateOrder: true,
              waveId: activeWave.id,
              syndicateTierUnlocked: tierUnlocked,
              reviewStatus: hasImageBounty ? 'pending' : 'none',
              toast: pushToast,
            });
            void syncSoldCountToSupabase(product.id, 1, pushToast).then((newSold) => {
              if (newSold != null) setState((s3) => ({ ...s3, products: setProductSoldCount(s3.products, product.id, newSold) }));
            });
            void syncStockToSupabase(product.id, 1, pushToast, size, color).then((newStock) => {
              if (newStock != null) setState((s3) => ({ ...s3, products: setProductStock(s3.products, product.id, newStock, size, color) }));
            });
            refetchUserState(state.authUser!.id);
            pushToast('success', `Purchase complete! \u20b9${bountyEarned.toLocaleString('en-IN')} locked in escrow (Tier ${tierUnlocked} unlocked).`);
          });
        return;
      }
      setState((s) => {
        const validCreditApplied = Math.min(appliedBrandCredit ?? 0, product.priceInr);
        const netPaid = Math.max(0, product.priceInr - validCreditApplied);
        const activeWave = s.syndicateWaves.find(
          (w) => w.status === 'active' && w.productId === product.id && Date.now() < w.startTime + w.durationMs,
        );
        let productBounty: number;
        let hasImageBounty = false;
        let imageReviewBounty = 0;
        if (activeWave) {
          const existingCount = s.orders.filter(
            (o) => activeWave.orderIds.includes(o.id) && o.status !== 'cancelled',
          ).length;
          const projectedCount = existingCount + 1;
          const sortedTiers = [...activeWave.tiers].sort((a, b) => b.thresholdUnits - a.thresholdUnits);
          const projectedTier = sortedTiers.find((t) => projectedCount >= t.thresholdUnits) ?? activeWave.tiers[0];
          productBounty = Math.round(product.priceInr * (projectedTier.bountyPercent / 100));
          hasImageBounty = Boolean(activeWave.hasImageBounty && Number(activeWave.imageBountyAmount) > 0);
          imageReviewBounty = hasImageBounty ? Number(activeWave.imageBountyAmount) : 0;
        } else {
          productBounty = Math.max(Math.round(product.priceInr * 0.05), product.autoBounty);
          hasImageBounty = false;
          imageReviewBounty = 0;
        }
        const totalBounty = productBounty + imageReviewBounty;
        const platformFee = Math.round(product.priceInr * 0.05);
        const brandNet = product.priceInr - platformFee - totalBounty;
        const record: SalesRecord = {
          id: makeId(),
          productId: product.id,
          brandName: product.brandName,
          productTitle: product.title,
          category: product.category,
          salePrice: product.priceInr,
          bountyPaid: productBounty,
          buyerEmail: s.session.email,
          timestamp: Date.now(),
        };
        const order: Order = {
          id: crypto.randomUUID(),
          consumerEmail: s.session.email,
          productId: product.id,
          productTitle: product.title,
          brandName: product.brandName,
          priceInr: product.priceInr,
          bountyAmount: productBounty,
          size,
          color,
          selectedSize: size,
          selectedColor: color,
          image: product.images[0] ?? '',
          trackingStatus: 'Placed',
          trackingNumber: makeTrackingNumber(),
          timestamp: Date.now(),
          addressId,
          disputeStatus: 'resolved',
          priceAtPurchase: product.priceInr,
          settlementStatus: 'pending' as const,
          bountyEscrow: totalBounty,
          brandNetPayout: brandNet,
          platformFee,
          escrowStatus: 'locked' as EscrowStatus,
          reviewStatus: (hasImageBounty ? 'pending' : 'none') as ReviewStatus,
          bountyReleased: false,
          brandPayoutReleased: false,
          productBounty,
          imageReviewBounty,
          productBountyReleased: false,
          imageReviewBountyReleased: false,
          brandCreditApplied: validCreditApplied,
          netPaid,
          isSyndicateOrder: !!activeWave,
          waveId: activeWave?.id,
          hasImageBounty,
          imageEscrowHeld: hasImageBounty,
        };
        const paymentTx: WalletTransaction = {
          id: makeId(),
          type: 'SANDBOX_PAYMENT',
          amount: netPaid,
          description: `Sandbox Instant Pay — Order #${order.id.slice(-6).toUpperCase()} (PAID)`,
          timestamp: Date.now(),
          orderId: order.id,
          wallet: 'consumer',
          direction: 'debit',
          category: 'debit',
          runningBalance: s.consumerWallet.withdrawable,
        };
        const creditTx: WalletTransaction | null = validCreditApplied > 0
          ? {
              id: makeId(),
              type: 'BRAND_CREDIT_REDEEMED',
              amount: validCreditApplied,
              description: `Applied ₹${validCreditApplied.toLocaleString('en-IN')} ${product.brandName} credit on Order #${order.id.slice(-6).toUpperCase()}`,
              timestamp: Date.now(),
              orderId: order.id,
              wallet: 'consumer',
              direction: 'debit',
              category: 'debit',
              runningBalance: s.consumerWallet.withdrawable,
            }
          : null;
        const updatedCredits = validCreditApplied > 0
          ? s.brandCredits
              .map((c) =>
                c.brandId === product.brandName
                  ? { ...c, amount: Math.max(0, c.amount - validCreditApplied), updatedAt: Date.now() }
                  : c,
              )
              .filter((c) => c.amount > 0)
          : s.brandCredits;
        const waveResult = addOrderToActiveWave(s.syndicateWaves, s.orders, order);
        const updatedOrder = waveResult.orders.find((o) => o.id === order.id) ?? order;
        const lockedBounty = updatedOrder.productBounty ?? updatedOrder.bountyAmount ?? productBounty;
        const upgradeDelta = waveResult.upgradeTxs.reduce((sum, t) => sum + t.amount, 0);
        if (activeWave) {
          supabase
            .from('syndicate_waves')
            .update({ current_units: (activeWave.currentUnits ?? 0) + 1 })
            .eq('id', activeWave.id)
            .then();
        }
        void insertOrderToSupabase({
          id: order.id,
          productId: product.id,
          productTitle: product.title,
          brandName: product.brandName,
          brandId: product.brandId ?? null,
          buyerId: s.authUser?.id ?? null,
          consumerEmail: s.session.email,
          unitPrice: product.priceInr,
          quantity: 1,
          productBounty,
          imageReviewBounty,
          size,
          color,
          trackingNumber: order.trackingNumber,
          hasImageBounty,
          isSyndicateOrder: !!activeWave,
          waveId: activeWave?.id,
          syndicateTierUnlocked: order.syndicateTierUnlocked,
          reviewStatus: order.reviewStatus,
          storeCreditUsed: validCreditApplied,
          netCashPaid: netPaid,
          toast: pushToast,
        }).then(() => { void refreshAllMarketData(); });
        void syncSoldCountToSupabase(product.id, 1, pushToast).then((newSold) => {
          if (newSold != null) setState((s2) => ({ ...s2, products: setProductSoldCount(s2.products, product.id, newSold) }));
        });
        void syncStockToSupabase(product.id, 1, pushToast, size, color).then((newStock) => {
          if (newStock != null) setState((s2) => ({ ...s2, products: setProductStock(s2.products, product.id, newStock, size, color) }));
        });
        const completedIntentIds: string[] = [];
        s.intents.forEach((i) => {
          if (i.status !== 'active' || i.consumerEmail !== s.session.email) return;
          const query = i.searchQuery.toLowerCase().trim();
          if (!query) return;
          const matches = product.keywords.some((kw) => {
            const k = kw.toLowerCase().trim();
            return query.includes(k) || k.includes(query);
          }) || product.title.toLowerCase().includes(query) || product.category.toLowerCase().includes(query);
          if (matches) completedIntentIds.push(i.id);
        });
        deleteIntentsFromSupabase(completedIntentIds);
        return {
          ...s,
          syndicateWaves: waveResult.waves.map((w) =>
            activeWave && w.id === activeWave.id ? { ...w, currentUnits: (w.currentUnits ?? 0) + 1 } : w,
          ),
          consumerWallet: {
            ...s.consumerWallet,
            lockedEscrow: s.consumerWallet.lockedEscrow + lockedBounty + (updatedOrder.imageReviewBounty ?? 0) + upgradeDelta,
          },
          brandWallet: {
            globalBudget: Math.max(0, s.brandWallet.globalBudget - productBounty),
          },
          brandCredits: updatedCredits,
          salesAnalytics: [record, ...s.salesAnalytics],
          orders: waveResult.orders,
          intents: s.intents.filter((i) => !completedIntentIds.includes(i.id)),
          mainEscrowBalance: s.mainEscrowBalance + netPaid,
          walletTransactions: [...waveResult.upgradeTxs, paymentTx, ...(creditTx ? [creditTx] : []), ...s.walletTransactions],
        };
      });
    };

    const advanceOrderStatus = (orderId: string) =>
      setState((s) => {
        const order = s.orders.find((o) => o.id === orderId);
        if (!order) return s;
        const flow: TrackingStatus[] = ['Placed', 'Dispatched', 'In Transit', 'Delivered'];
        const idx = flow.indexOf(order.trackingStatus);
        if (idx >= flow.length - 1) return s;
        const nextStatus = flow[idx + 1];
        if (nextStatus === 'Delivered') {
          window.setTimeout(() => confirmDelivery(orderId), 0);
        }
        return {
          ...s,
          orders: s.orders.map((o) =>
            o.id === orderId
              ? { ...o, trackingStatus: nextStatus }
              : o,
          ),
        };
      });

    const confirmDelivery = (orderId: string) => {
      const order0 = state.orders.find((o) => o.id === orderId);
      const wasReshippedOrDisputed = !!order0 && (
        order0.disputeStatus === 'resolved_reshipped' ||
        order0.reshipped === true ||
        ['open', 'opened_under_review', 'escalated', 'replacement_issued_by_admin', 'resolved_reshipped'].includes(order0.disputeStatus)
      );
      if (state.authUser && !order0?.waveId) {
        supabase
          .rpc('deliver_order_and_release_escrow', { p_order_id: String(orderId) })
          .then(({ error }) => {
            if (error) {
              pushToast('error', `Delivery confirmation failed: ${error.message}`);
              return;
            }
            refetchUserState(state.authUser!.id);
            void supabase.from('disputes').update({ status: 'resolved_released', updated_at: new Date().toISOString() }).eq('order_id', String(orderId))
              .then(({ error: disputeError }) => { if (disputeError) pushToast('error', `Dispute release failed: ${disputeError.message}`); });
            if (wasReshippedOrDisputed) {
              void syncDisputeResolutionToSupabase(orderId, 'resolved_released', 'Buyer confirmed delivery of replacement. Escrow released.', pushToast);
            }
            void refreshAllMarketData();
            pushToast('success', 'Delivery confirmed and bounty released.');
          });
      } else {
        void syncOrderStatusToSupabase(orderId, {
          status: 'delivered',
          order_status: 'delivered',
          delivery_status: 'delivered',
          is_delivered: true,
          buyer_confirmed_delivery: true,
          delivered_at: new Date().toISOString(),
          escrow_status: 'released',
          bounty_status: 'released',
          dispute_status: 'resolved_released',
          dispute_resolved: true,
        }, pushToast);
        void supabase.from('disputes').update({ status: 'resolved_released', updated_at: new Date().toISOString() }).eq('order_id', String(orderId))
          .then(({ error }) => { if (error) console.error('disputes release update error:', error.message); });
        if (wasReshippedOrDisputed) {
          void syncDisputeResolutionToSupabase(orderId, 'resolved_released', 'Buyer confirmed delivery of replacement. Escrow released.', pushToast);
        }
        void refreshAllMarketData();
      }
      setState((s) => {
        const order = s.orders.find((o) => o.id === orderId);
        if (!order) return s;
        if (order.disputeStatus === 'open' || order.disputeStatus === 'opened_under_review' || order.disputeStatus === 'escalated') return s;
        const now = Date.now();
        const productBounty = order.productBounty ?? order.bountyAmount;
        const releaseProductBounty = !order.productBountyReleased && productBounty > 0;
        const newWithdrawable = s.consumerWallet.withdrawable + productBounty;
        const tx: WalletTransaction | null = releaseProductBounty
          ? {
              id: makeId(),
              type: 'PRODUCT_BOUNTY_CASHBACK',
              amount: productBounty,
              description: `Product bounty cashback released for ${order.productTitle}`,
              timestamp: now,
              orderId,
              wallet: 'consumer',
              runningBalance: newWithdrawable,
            }
          : null;
        const updatedBountyPool = releaseProductBounty
          ? (() => {
              const existing = s.brandBountyPool.find((b) => b.brandId === order.brandName);
              if (existing) {
                return s.brandBountyPool.map((b) =>
                  b.brandId === order.brandName
                    ? { ...b, convertibleBountyAmount: b.convertibleBountyAmount + productBounty }
                    : b,
                );
              }
              return [
                { brandId: order.brandName, brandName: order.brandName, convertibleBountyAmount: productBounty },
                ...s.brandBountyPool,
              ];
            })()
          : s.brandBountyPool;
        return {
          ...s,
          orders: s.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: 'delivered' as OrderStatus,
                  trackingStatus: 'Delivered' as TrackingStatus,
                  escrowStatus: 'released' as EscrowStatus,
                  disputeStatus: 'resolved_released' as DisputeStatus,
                  dispute_status: 'resolved_released',
                  isDelivered: true,
                  deliveredAt: o.deliveredAt ?? now,
                  disputeExpiresAt: now + 7 * 24 * 60 * 60 * 1000,
                  reviewExpiresAt: now + 15 * 24 * 60 * 60 * 1000,
                  reviewStatus: 'pending_upload' as ReviewStatus,
                  imageEscrowHeld: order.hasImageBounty && (order.imageReviewBounty ?? 0) > 0 ? true : o.imageEscrowHeld,
                  productBountyReleased: releaseProductBounty ? true : o.productBountyReleased,
                  bountyReleased: true,
                }
              : o,
          ),
          consumerWallet: releaseProductBounty
            ? {
                lockedEscrow: Math.max(0, s.consumerWallet.lockedEscrow - productBounty),
                withdrawable: s.consumerWallet.withdrawable + productBounty,
              }
            : s.consumerWallet,
          brandBountyPool: updatedBountyPool,
          walletTransactions: tx ? [tx, ...s.walletTransactions] : s.walletTransactions,
        };
      });
    };

    const withdrawCash = (amount: number) =>
      setState((s) => {
        const newWithdrawable = Math.max(0, s.consumerWallet.withdrawable - amount);
        const tx: WalletTransaction = {
          id: makeId(),
          type: 'WITHDRAWAL',
          amount,
          description: `Bank transfer payout`,
          timestamp: Date.now(),
          wallet: 'consumer',
          direction: 'debit',
          category: 'debit',
          runningBalance: newWithdrawable,
        };
        return {
          ...s,
          consumerWallet: {
            ...s.consumerWallet,
            withdrawable: newWithdrawable,
          },
          walletTransactions: [tx, ...s.walletTransactions],
        };
      });

    const convertCashToBrandCredit = (brandId: string, brandName: string, cashAmount: number) =>
      setState((s) => {
        if (s.consumerWallet.withdrawable < cashAmount) return s;
        const boostedAmount = Math.round(cashAmount * 1.25);
        const newWithdrawable = Math.max(0, s.consumerWallet.withdrawable - cashAmount);
        const existing = s.brandCredits.find((c) => c.brandId === brandId);
        const updatedCredits: BrandCredit[] = existing
          ? s.brandCredits.map((c) =>
              c.brandId === brandId
                ? { ...c, amount: c.amount + boostedAmount, updatedAt: Date.now() }
                : c,
            )
          : [
              { brandId, brandName, amount: boostedAmount, updatedAt: Date.now() },
              ...s.brandCredits,
            ];
        const tx: WalletTransaction = {
          id: makeId(),
          type: 'BRAND_CREDIT_CONVERSION',
          amount: cashAmount,
          description: `Converted ₹${cashAmount.toLocaleString('en-IN')} Cash to ₹${boostedAmount.toLocaleString('en-IN')} ${brandName} Credit (+25% Bonus)`,
          timestamp: Date.now(),
          wallet: 'consumer',
          direction: 'debit',
          category: 'debit',
          runningBalance: newWithdrawable,
        };
        return {
          ...s,
          consumerWallet: {
            ...s.consumerWallet,
            withdrawable: newWithdrawable,
          },
          brandCredits: updatedCredits,
          walletTransactions: [tx, ...s.walletTransactions],
        };
      });

    const convertBountyToBrandCredit = (brandId: string, convertAmount: number) =>
      setState((s) => {
        if (convertAmount <= 0) return s;
        if (s.consumerWallet.withdrawable < convertAmount) return s;
        const bountyEntry = s.brandBountyPool.find((b) => b.brandId === brandId);
        if (!bountyEntry || bountyEntry.convertibleBountyAmount < convertAmount) return s;
        const boostedCredit = Math.round(convertAmount * 1.25);
        const newWithdrawable = Math.max(0, s.consumerWallet.withdrawable - convertAmount);
        const updatedBountyPool = s.brandBountyPool
          .map((b) =>
            b.brandId === brandId
              ? { ...b, convertibleBountyAmount: b.convertibleBountyAmount - convertAmount }
              : b,
          )
          .filter((b) => b.convertibleBountyAmount > 0);
        const existing = s.brandCredits.find((c) => c.brandId === brandId);
        const updatedCredits: BrandCredit[] = existing
          ? s.brandCredits.map((c) =>
              c.brandId === brandId
                ? { ...c, amount: c.amount + boostedCredit, updatedAt: Date.now() }
                : c,
            )
          : [
              { brandId, brandName: bountyEntry.brandName, amount: boostedCredit, updatedAt: Date.now() },
              ...s.brandCredits,
            ];
        const tx: WalletTransaction = {
          id: makeId(),
          type: 'BOUNTY_BRAND_BOOST',
          amount: convertAmount,
          description: `Converted ₹${convertAmount.toLocaleString('en-IN')} bounty cash to ₹${boostedCredit.toLocaleString('en-IN')} ${bountyEntry.brandName} Credit (+25% Bonus)`,
          timestamp: Date.now(),
          wallet: 'consumer',
          direction: 'debit',
          category: 'debit',
          runningBalance: newWithdrawable,
        };
        return {
          ...s,
          consumerWallet: {
            ...s.consumerWallet,
            withdrawable: newWithdrawable,
          },
          brandBountyPool: updatedBountyPool,
          brandCredits: updatedCredits,
          walletTransactions: [tx, ...s.walletTransactions],
        };
      });

    const applyBrandCredit = (brandId: string, amount: number) =>
      setState((s) => {
        const credit = s.brandCredits.find((c) => c.brandId === brandId);
        if (!credit || credit.amount < amount) return s;
        const updatedCredits = s.brandCredits
          .map((c) =>
            c.brandId === brandId
              ? { ...c, amount: c.amount - amount, updatedAt: Date.now() }
              : c,
          )
          .filter((c) => c.amount > 0);
        return {
          ...s,
          brandCredits: updatedCredits,
        };
      });

    const adminForceRefund = (orderId: string) =>
      setState((s) => {
        const order = s.orders.find((o) => o.id === orderId);
        if (!order) return s;
        const refundAmount = order.priceInr;
        const newWithdrawable = s.consumerWallet.withdrawable + refundAmount;
        const tx: WalletTransaction = {
          id: makeId(),
          type: 'admin_refund',
          amount: refundAmount,
          description: `Admin override: Full refund for order #${orderId.slice(-6).toUpperCase()} — ${order.productTitle}`,
          timestamp: Date.now(),
          orderId,
          wallet: 'consumer',
          runningBalance: newWithdrawable,
        };
        return {
          ...s,
          orders: s.orders.map((o) =>
            o.id === orderId
              ? { ...o, status: 'refunded' as OrderStatus, disputeStatus: 'resolved_refunded' as DisputeStatus, dispute_status: 'resolved_refunded', escrowFrozen: false, escrowStatus: 'refunded' as EscrowStatus, refunded: true, trackingStatus: 'Delivered' as TrackingStatus }
              : o,
          ),
          consumerWallet: {
            lockedEscrow: Math.max(0, s.consumerWallet.lockedEscrow - order.bountyAmount),
            withdrawable: s.consumerWallet.withdrawable + refundAmount,
          },
          walletTransactions: [tx, ...s.walletTransactions],
        };
      });

    const adminForceRelease = (orderId: string) =>
      setState((s) => {
        const order = s.orders.find((o) => o.id === orderId);
        if (!order) return s;
        const newWithdrawable = s.consumerWallet.withdrawable + order.bountyAmount;
        const tx: WalletTransaction = {
          id: makeId(),
          type: 'admin_release',
          amount: order.bountyAmount,
          description: `Admin override: Escrow released to brand for order #${orderId.slice(-6).toUpperCase()} — ${order.productTitle}`,
          timestamp: Date.now(),
          orderId,
          wallet: 'consumer',
          runningBalance: newWithdrawable,
        };
        return {
          ...s,
          orders: s.orders.map((o) =>
            o.id === orderId
              ? { ...o, status: 'delivered' as OrderStatus, disputeStatus: 'resolved_released' as DisputeStatus, dispute_status: 'resolved_released', escrowFrozen: false, escrowStatus: 'released' as EscrowStatus, trackingStatus: 'Delivered' as TrackingStatus }
              : o,
          ),
          consumerWallet: {
            lockedEscrow: Math.max(0, s.consumerWallet.lockedEscrow - order.bountyAmount),
            withdrawable: s.consumerWallet.withdrawable + order.bountyAmount,
          },
          brandWallet: {
            globalBudget: s.brandWallet.globalBudget + order.priceInr - order.bountyAmount,
          },
          walletTransactions: [tx, ...s.walletTransactions],
        };
      });

    const setBrandStatus = (brandId: string, status: BrandStatus) =>
      setState((s) => ({
        ...s,
        brandRecords: s.brandRecords.map((b) =>
          b.id === brandId ? { ...b, status } : b,
        ),
      }));

    const submitReviewWithBounty = (review: Omit<Review, 'id' | 'timestamp'>, orderId: string, bountyAmount: number) => {
      const order = state.orders.find((o) => o.id === orderId);
      const imageBounty = order?.imageReviewBounty ?? bountyAmount;
      const reviewImages = review.images ?? (review.image ? [review.image] : []);
      const hasImage = reviewImages.length > 0;
      const canReleaseBounty = imageBounty > 0 && hasImage && !order?.imageReviewBountyReleased;
      const bountyClaimed = bountyAmount > 0 && hasImage;
      if (canReleaseBounty && state.authUser) {
        supabase
          .rpc('approve_image_review_bounty', { p_order_id: orderId })
          .then(({ error }) => {
            if (error) {
              pushToast('error', `Bounty approval failed: ${error.message}`);
              return;
            }
            refetchUserState(state.authUser!.id);
            pushToast('success', 'Photo review approved and bounty released!');
          });
      }
      supabase
        .from('reviews')
        .insert({
          product_id: review.productId,
          consumer_email: review.consumerEmail,
          rating: review.rating,
          comment: review.comment,
          image_url: reviewImages[0] ?? null,
          image_urls: reviewImages.length > 0 ? reviewImages : null,
          bounty_claimed: bountyClaimed,
        })
        .then(({ error }) => {
          if (error) {
            console.error('Review insert error:', error);
            pushToast('error', error?.message || 'Failed to publish review');
          }
        });
      setState((s) => {
        const order = s.orders.find((o) => o.id === orderId);
        if (!order) return s;
        const now = Date.now();
        const withinReviewWindow = order.reviewExpiresAt ? now <= order.reviewExpiresAt : true;
        const newReview: Review = { ...review, id: makeId(), timestamp: Date.now(), bountyClaimed: bountyAmount > 0 && hasImage };
        const imageBounty = order.imageReviewBounty ?? bountyAmount;
        const canReleaseBounty = imageBounty > 0 && hasImage && withinReviewWindow && !order.imageReviewBountyReleased;
        const newWithdrawable = s.consumerWallet.withdrawable + imageBounty;
        const tx: WalletTransaction | null =
          canReleaseBounty
            ? {
                id: makeId(),
                type: 'IMAGE_REVIEW_BOUNTY',
                amount: imageBounty,
                description: `Image Review Bounty Reward for ${review.productId}`,
                timestamp: Date.now(),
                orderId,
                wallet: 'consumer',
                runningBalance: newWithdrawable,
              }
            : null;
        const updatedBountyPool = canReleaseBounty
          ? (() => {
              const existing = s.brandBountyPool.find((b) => b.brandId === order.brandName);
              if (existing) {
                return s.brandBountyPool.map((b) =>
                  b.brandId === order.brandName
                    ? { ...b, convertibleBountyAmount: b.convertibleBountyAmount + imageBounty }
                    : b,
                );
              }
              return [
                { brandId: order.brandName, brandName: order.brandName, convertibleBountyAmount: imageBounty },
                ...s.brandBountyPool,
              ];
            })()
          : s.brandBountyPool;
        return {
          ...s,
          reviews: [newReview, ...s.reviews],
          orders: s.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  reviewBountyClaimed: true,
                  reviewStatus: 'uploaded' as ReviewStatus,
                  imageReviewBountyReleased: canReleaseBounty ? true : o.imageReviewBountyReleased,
                  imageEscrowHeld: canReleaseBounty ? false : o.imageEscrowHeld,
                }
              : o,
          ),
          consumerWallet: canReleaseBounty
            ? {
                lockedEscrow: Math.max(0, s.consumerWallet.lockedEscrow - imageBounty),
                withdrawable: s.consumerWallet.withdrawable + imageBounty,
              }
            : s.consumerWallet,
          brandBountyPool: updatedBountyPool,
          walletTransactions: tx ? [tx, ...s.walletTransactions] : s.walletTransactions,
        };
      });
    };

    const approveRefundFromBrand = (orderId: string, resolutionNote?: string) => {
      void syncDisputeResolutionToSupabase(orderId, 'resolved_refunded', resolutionNote || 'Refund approved and inventory restocked.', pushToast);
      refundOrderFromBrand(orderId);
      pushToast('success', 'Refund approved! Product stock and brand sales metrics have been automatically adjusted.');
    };

    const scheduleDoorstepPickupFromBrand = (orderId: string) => {
      const awb = `REV-DLV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      void syncDisputeResolutionToSupabase(
        orderId,
        'pickup_scheduled',
        `Doorstep Reverse Pickup Scheduled (AWB: ${awb}).`,
        pushToast,
        { return_status: 'pickup_scheduled', return_tracking_number: awb },
        { return_status: 'pickup_scheduled', return_tracking_number: awb, escrow_status: 'frozen' },
      );
      void syncDisputeMessagesToSupabase(orderId, appendSystemMessage([], `🚚 Doorstep Reverse Pickup Scheduled (AWB: ${awb}). Courier agent will verify Variant at buyer's doorstep. Refund releases automatically upon Doorstep QC pass.`), pushToast);
      setState((s) => {
        const order = s.orders.find((o) => o.id === orderId);
        if (!order) return s;
        const now = Date.now();
        const sysMsg: DisputeMessage = {
          id: `sys-${now}-${Math.random().toString(36).slice(2, 6)}`,
          senderRole: 'brand',
          text: `🚚 Doorstep Reverse Pickup Scheduled (AWB: ${awb}). Courier agent will verify Variant (${order.selectedSize || order.size} • ${order.selectedColor || order.color}) at buyer's doorstep. Refund releases automatically upon Doorstep QC pass.`,
          timestamp: now,
        };
        return {
          ...s,
          orders: s.orders.map((o) => o.id === orderId ? {
            ...o,
            disputeStatus: 'pickup_scheduled' as DisputeStatus,
            returnStatus: 'pickup_scheduled',
            returnTrackingNumber: awb,
            escrowFrozen: true,
            escrowStatus: 'disputed' as EscrowStatus,
            disputeMessages: [...(o.disputeMessages ?? []), sysMsg],
          } : o),
        };
      });
      void refreshDbOrders();
      pushToast('success', `Doorstep pickup scheduled! AWB: ${awb}`);
    };

    const verifyDoorstepQCAndRefundFromBrand = (orderId: string) => {
      void syncDisputeResolutionToSupabase(
        orderId,
        'resolved_refunded',
        'Doorstep QC Passed — Full Refund released to buyer.',
        pushToast,
        { return_status: 'qc_passed_refunded' },
        { return_status: 'qc_passed_refunded', status: 'refunded', order_status: 'refunded', delivery_status: 'refunded', escrow_status: 'cancelled', bounty_status: 'cancelled' },
      );
      void syncDisputeMessagesToSupabase(orderId, appendSystemMessage([], `✅ Doorstep QC Passed — Full Refund released to buyer.`), pushToast);
      refundOrderFromBrand(orderId);
      pushToast('success', 'Doorstep QC verified! Full refund issued to buyer wallet.');
    };

    const dismissDisputeFromBrand = (orderId: string, resolutionNote?: string) => {
      void syncDisputeResolutionToSupabase(orderId, 'resolution_proposed', resolutionNote || 'Brand proposed resolution. Waiting for Buyer to confirm and release escrow.', pushToast)
        .then(() => refreshDbOrders());
      void syncDisputeMessagesToSupabase(orderId, appendSystemMessage([], `🛡️ Brand proposed resolution. Waiting for Buyer to confirm and release escrow.`), pushToast);
      setState((s) => {
        const order = s.orders.find((o) => o.id === orderId);
        if (!order) return s;
        const now = Date.now();
        const sysMsg: DisputeMessage = {
          id: `sys-${now}-${Math.random().toString(36).slice(2, 6)}`,
          senderRole: 'brand',
          text: '🛡️ Brand proposed resolution. Waiting for Buyer to confirm and release escrow.',
          timestamp: now,
        };
        return {
          ...s,
          orders: s.orders.map((o) => o.id === orderId ? {
            ...o,
            disputeStatus: 'resolution_proposed' as DisputeStatus,
            escrowFrozen: true,
            escrowStatus: 'disputed' as EscrowStatus,
            disputeMessages: [...(o.disputeMessages ?? []), sysMsg],
          } : o),
        };
      });
      void refreshDbOrders();
      pushToast('info', 'Resolution proposed. Buyer must confirm to release escrow.');
    };

    const acceptProposedResolution = (orderId: string) => {
      void syncDisputeResolutionToSupabase(orderId, 'resolved_released', 'Buyer accepted resolution. Escrow released.', pushToast)
        .then(() => refreshDbOrders().then(() => refreshAllMarketData()));
      void syncDisputeMessagesToSupabase(orderId, appendSystemMessage([], `✅ Buyer accepted the proposed resolution. Escrow released to brand.`), pushToast);
      setState((s) => {
        const order = s.orders.find((o) => o.id === orderId);
        if (!order) return s;
        const now = Date.now();
        const productBounty = order.productBounty ?? order.bountyAmount;
        const newWithdrawable = s.consumerWallet.withdrawable + productBounty;
        const tx: WalletTransaction = {
          id: makeId(),
          type: 'PRODUCT_BOUNTY_CASHBACK',
          amount: productBounty,
          description: `Resolution accepted — bounty released for Order #${order.id.slice(-6).toUpperCase()}`,
          timestamp: now,
          orderId: order.id,
          wallet: 'consumer',
          runningBalance: newWithdrawable,
        };
        const sysMsg: DisputeMessage = {
          id: `sys-${now}-${Math.random().toString(36).slice(2, 6)}`,
          senderRole: 'consumer',
          text: '✅ Buyer accepted the proposed resolution. Escrow released to brand.',
          timestamp: now,
        };
        return {
          ...s,
          orders: s.orders.map((o) => o.id === orderId ? {
            ...o,
            status: 'delivered' as OrderStatus,
            trackingStatus: 'Delivered' as TrackingStatus,
            disputeStatus: 'resolved_released' as DisputeStatus,
            isDisputed: false,
            escrowFrozen: false,
            escrowStatus: 'released' as EscrowStatus,
            deliveredAt: o.deliveredAt ?? now,
            productBountyReleased: true,
            bountyReleased: true,
            disputeMessages: [...(o.disputeMessages ?? []), sysMsg],
          } : o),
          consumerWallet: {
            lockedEscrow: Math.max(0, s.consumerWallet.lockedEscrow - productBounty),
            withdrawable: newWithdrawable,
          },
          walletTransactions: [tx, ...s.walletTransactions],
        };
      });
      void refreshDbOrders();
      pushToast('success', 'Resolution accepted! Escrow released.');
    };

    const rejectProposedResolution = (orderId: string) => {
      void syncDisputeResolutionToSupabase(orderId, 'open', 'Buyer rejected the proposed resolution. Dispute reopened.', pushToast, {}, { is_disputed: true, escrow_status: 'frozen' })
        .then(() => refreshDbOrders());
      void syncDisputeMessagesToSupabase(orderId, appendSystemMessage([], `❌ Buyer rejected the proposed resolution. Dispute remains open — escrow still frozen.`), pushToast);
      setState((s) => {
        const order = s.orders.find((o) => o.id === orderId);
        if (!order) return s;
        const now = Date.now();
        const sysMsg: DisputeMessage = {
          id: `sys-${now}-${Math.random().toString(36).slice(2, 6)}`,
          senderRole: 'consumer',
          text: '❌ Buyer rejected the proposed resolution. Dispute remains open — escrow still frozen.',
          timestamp: now,
        };
        return {
          ...s,
          orders: s.orders.map((o) => o.id === orderId ? {
            ...o,
            disputeStatus: 'open' as DisputeStatus,
            escrowFrozen: true,
            escrowStatus: 'disputed' as EscrowStatus,
            disputeMessages: [...(o.disputeMessages ?? []), sysMsg],
          } : o),
        };
      });
      void refreshDbOrders();
      pushToast('info', 'Resolution rejected. Dispute reopened — escrow still frozen.');
    };

    const simulateDoorstepQCPass = (orderId: string) => {
      void syncDisputeResolutionToSupabase(
        orderId,
        'resolved_refunded',
        'Doorstep QC Passed — buyer handed item to courier. Full refund released.',
        pushToast,
        { return_status: 'qc_passed_refunded' },
        { return_status: 'qc_passed_refunded', status: 'refunded', order_status: 'refunded', delivery_status: 'refunded', escrow_status: 'cancelled', bounty_status: 'cancelled' },
      );
      void syncDisputeMessagesToSupabase(orderId, appendSystemMessage([], `✅ Doorstep QC Passed — buyer handed item to courier rider. Full refund of ₹${0} released to buyer wallet instantly.`), pushToast);
      refundOrderFromBrand(orderId);
      pushToast('success', 'Doorstep QC passed! Refund released to your wallet instantly.');
    };

    const cancelFailedDelivery = (orderId: string, cancelReason: string, notes: string) => {
      void syncOrderStatusToSupabase(orderId, {
        status: 'refunded',
        escrow_status: 'cancelled',
        bounty_status: 'cancelled',
        dispute_status: 'closed_cancelled',
        is_disputed: false,
        brand_response: `Delivery failed: ${cancelReason}. ${notes}`,
        resolved_at: new Date().toISOString(),
      }, pushToast);
      setState((s) => {
        const order = s.orders.find((o) => o.id === orderId);
        if (!order) return s;
        const now = Date.now();
        const refundAmount = order.priceAtPurchase ?? order.priceInr;
        const newWithdrawable = s.consumerWallet.withdrawable + refundAmount;
        const tx: WalletTransaction = {
          id: makeId(),
          type: 'FAILED_DELIVERY_REFUND',
          amount: refundAmount,
          description: `Refund for undelivered Order #${order.id.slice(-6).toUpperCase()} (${cancelReason})`,
          timestamp: now,
          orderId: order.id,
          wallet: 'consumer',
          runningBalance: newWithdrawable,
        };
        const remainingLockedBounty = order.productBountyReleased
          ? (order.imageReviewBounty ?? 0) - (order.imageReviewBountyReleased ? (order.imageReviewBounty ?? 0) : 0)
          : (order.bountyEscrow ?? order.bountyAmount);
        const cancelledOrders = s.orders.map((o) => o.id === orderId
          ? { ...o, status: 'cancelled' as OrderStatus, settlementStatus: 'refunded' as const, disputeStatus: 'closed_cancelled' as DisputeStatus, disputeFrozen: false, escrowFrozen: false, escrowStatus: 'refunded' as EscrowStatus, refunded: true, cancelReason, cancelNotes: notes, cancelledAt: now }
          : o);

        const clawback = applySyndicateClawback(s.syndicateWaves, cancelledOrders, orderId, 'ORDER_CANCELLATION');
        const waveResult = reconcileWaveOrders(clawback.waves, clawback.orders);
        const affectedWave = order.waveId ? waveResult.waves.find((wave) => wave.id === order.waveId) : undefined;
        const activeCount = affectedWave ? getActiveWaveOrders(affectedWave, waveResult.orders).length : 0;
        const newTier = affectedWave ? getCurrentWaveTier(affectedWave, activeCount) : undefined;
        const extraTxs = clawback.clawbackTx ? [clawback.clawbackTx] : [];
        const extraNotifications = clawback.clawbackNotification ? [clawback.clawbackNotification] : [];
        return {
          ...s,
          orders: waveResult.orders,
          syndicateWaves: waveResult.waves,
          consumerWallet: {
            ...s.consumerWallet,
            lockedEscrow: Math.max(0, s.consumerWallet.lockedEscrow - remainingLockedBounty - clawback.clawbackAmount),
            withdrawable: s.consumerWallet.withdrawable + refundAmount,
          },
          mainEscrowBalance: Math.max(0, s.mainEscrowBalance - refundAmount),
          walletTransactions: [...extraTxs, tx, ...s.walletTransactions],
          notifications: [
            ...extraNotifications,
            ...(newTier && affectedWave ? [{ id: makeId(), consumerEmail: order.consumerEmail, type: 'order' as const, title: 'Syndicate Bounty Adjusted', description: `Syndicate bounty adjusted to ${newTier.bountyPercent}% due to a participant cancellation.`, link: '/consumer/orders', timestamp: now, read: false }] : []),
            {
              id: makeId(), consumerEmail: order.consumerEmail, type: 'order' as const, title: 'Delivery Failed & Order Cancelled', description: `Order #${order.id.slice(-6).toUpperCase()} was cancelled. ₹${refundAmount.toLocaleString('en-IN')} refunded to your wallet.`, link: '/consumer/orders', timestamp: now, read: false,
            },
            ...s.notifications,
          ],
        };
      });
    };

    const expireUnclaimedReview = (orderId: string) =>
      setState((s) => {
        const order = s.orders.find((o) => o.id === orderId);
        if (!order) return s;
        if (order.imageReviewBountyReleased || order.reviewBountyClaimed) return s;
        const imageBounty = order.imageReviewBounty ?? 0;
        if (imageBounty <= 0) return s;
        const now = Date.now();
        const tx: WalletTransaction = {
          id: makeId(),
          type: 'IMAGE_REVIEW_BOUNTY_EXPIRED',
          amount: imageBounty,
          description: `15-day photo review window expired — ₹${imageBounty.toLocaleString('en-IN')} refunded to brand for ${order.productTitle}`,
          timestamp: now,
          orderId,
          wallet: 'brand',
          direction: 'credit',
          category: 'credit',
        };
        return {
          ...s,
          orders: s.orders.map((o) =>
            o.id === orderId
              ? { ...o, imageReviewBountyReleased: true, reviewStatus: 'expired' as ReviewStatus, imageEscrowHeld: false }
              : o,
          ),
          consumerWallet: {
            ...s.consumerWallet,
            lockedEscrow: Math.max(0, s.consumerWallet.lockedEscrow - imageBounty),
          },
          brandWalletBalance: s.brandWalletBalance + imageBounty,
          walletTransactions: [tx, ...s.walletTransactions],
        };
      });

    // Every wallet bucket derives from the single mutually-exclusive classifier.
    const realizedBounties = state.orders.reduce((sum, o) => {
      if (classifyOrderEscrow(o, state.disputes) === 'realized') return sum + orderEscrowBounty(o);
      return sum;
    }, 0);

    const lockedInEscrow = state.orders.reduce((sum, o) => {
      if (classifyOrderEscrow(o, state.disputes) === 'locked') return sum + orderEscrowBounty(o);
      return sum;
    }, 0);

    const frozenInDispute = state.orders.reduce((sum, o) => {
      if (classifyOrderEscrow(o, state.disputes) === 'frozen') return sum + orderEscrowBounty(o);
      return sum;
    }, 0);

    // Boost totals come ONLY from brand_tokens.principal_boosted — never from
    // wallet_transactions boost rows (they double-count) and never from
    // available_credit / total_credit_minted.
    const totalPrincipalBoosted = state.brandTokens.reduce(
      (sum, bt) => sum + Number(bt.principalBoosted ?? 0),
      0,
    );

    const totalUpiPayouts = state.walletTxns
      .filter((t) => t.txType === 'upi_payout' || t.txType === 'upi_withdrawal')
      .reduce((sum, t) => sum + Number(t.cashAmount ?? 0), 0);


    const availableBalance = Math.max(0, Math.round((realizedBounties - totalPrincipalBoosted - totalUpiPayouts) * 100) / 100);
    return {
      ...state,
      availableBalance,
      realizedBounties,
      lockedInEscrow,
      frozenInDispute,
      totalPrincipalBoosted,
      totalUpiPayouts,
      signIn,
      verifyConsumer,
      signOut,
      supabaseSignIn,
      supabaseSignUp,
      supabaseSignOut,
      addProduct,
      removeProduct,
      updateProduct,
      toggleImageReviewBounty,
      canSendPitchForProduct,
      addCampaign,
      removeCampaign,
      launchVIPPitch,
      acceptPitch,
      acceptPitchWithOrder,
      declinePitch,
      openDispute,
      raiseDispute,
      escalateDispute,
      addKeywordAlert,
      removeKeywordAlert,
      addToBag,
      removeFromBag,
      updateBagQuantity,
      clearBag,
      checkoutBag,
      markShipped,
      resolveDispute,
      resolveDisputeByAdmin,
      addDisputeMessage,
      addConsumerDisputeMessage,
      reshipOrder,
      refundOrderFromBrand,
      approveRefundFromBrand,
      scheduleDoorstepPickupFromBrand,
      verifyDoorstepQCAndRefundFromBrand,
      dismissDisputeFromBrand,
      reshipOrderFromBrand,
      fullRefundOrder,
      deleteSalesRecord,
      verifyGstin,
      setMiddeskVerified,
      connectStripe,
      addIntent,
      removeIntent,
      extendIntent,
      fulfillIntent,
      placeDirectOrder,
      verifyBrand,
      addReview,
      addAddress,
      updateAddress,
      saveAddress,
      removeAddress,
      setDefaultAddress,
      advanceOrderStatus,
      confirmDelivery,
      pushToast,
      dismissToast,
      pushNotification,
      markNotificationRead,
      markAllNotificationsRead,
      removeNotification,
      withdrawCash,
      convertCashToBrandCredit,
      convertBountyToBrandCredit,
      applyBrandCredit,
      adminForceRefund,
      adminForceRelease,
      setBrandStatus,
      submitReviewWithBounty,
      cancelFailedDelivery,
      expireUnclaimedReview,
      acceptProposedResolution,
      rejectProposedResolution,
      simulateDoorstepQCPass,
      createSyndicateWave,
      refreshSyndicateWaves,
      refreshDbOrders,
      refreshDailyAnalytics,
      refreshBrandTokensAndWalletTxns,
      refreshAllMarketData,
      boostBrandToken,
      processUpiWithdrawal,
      spendBrandToken,
      toggleBrandTokens,
      convertBountyToBrandToken,
      redeemBrandTokens,
    };

    async function createSyndicateWave(params: {
      productId: string;
      brandId: string;
      tiers: SyndicateTier[];
      durationMs: number;
      hasImageBounty: boolean;
      imageBountyAmount: number;
    }): Promise<string> {
      const product = state.products.find((p) => p.id === params.productId);
      if (!product) {
        pushToast('error', 'Product not found for wave creation.');
        return '';
      }

      let userId: string | null = null;
      try {
        const { data: authData } = await supabase.auth.getUser();
        userId = authData?.user?.id ?? null;
        if (userId) {
          await supabase.from('profiles').upsert(
            { id: userId, role: 'brand' },
            { onConflict: 'id' },
          );
        }
      } catch (e) {
        console.error('Auth/profile lookup failed:', e);
      }

      const startTime = new Date();
      const endTime = new Date(Date.now() + params.durationMs);
      const waveId = crypto.randomUUID();

      const { error: waveError } = await supabase
        .from('syndicate_waves')
        .insert({
          id: waveId,
          product_id: params.productId,
          brand_id: userId,
          status: 'active',
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          has_image_bounty: Boolean(params.hasImageBounty),
          image_bounty_amount: Number(params.imageBountyAmount || 0),
        });

      if (waveError) {
        console.error('Wave insert error:', waveError);
        pushToast('error', `Wave launch failed: ${waveError.message}`);
        return '';
      }

      const tiersToInsert = (params.tiers ?? []).map((tier, idx) => ({
        wave_id: waveId,
        tier_number: tier.tierNumber || idx + 1,
        threshold_units: Number(tier.thresholdUnits || 1),
        bounty_percent: Number(tier.bountyPercent || 10),
      }));

      if (tiersToInsert.length > 0) {
        const { error: tierError } = await supabase.from('wave_tiers').insert(tiersToInsert);
        if (tierError) {
          console.error('Tier insert error:', tierError);
          pushToast('error', `Tiers creation failed: ${tierError.message}`);
          return '';
        }
      }

      const { data: refreshed, error: refetchErr } = await supabase
        .from('syndicate_waves')
        .select('*, wave_tiers(*)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (refetchErr || !refreshed) {
        pushToast('error', 'Wave saved but failed to refresh from database.');
        return '';
      }

      setState((s) => {
        const mappedWaves: SyndicateWave[] = (refreshed as Array<{
          id: string; product_id: string; brand_id: string | null;
          status: string; start_time: string; end_time: string;
          has_image_bounty: boolean; image_bounty_amount: number;
          current_units: number;
          wave_tiers: Array<{ tier_number: number; threshold_units: number; bounty_percent: number }>;
        }>).map((w) => {
          const tiers: SyndicateTier[] = (w.wave_tiers ?? [])
            .sort((a, b) => a.tier_number - b.tier_number)
            .map((t) => ({
              tierNumber: t.tier_number,
              thresholdUnits: t.threshold_units,
              bountyPercent: Number(t.bounty_percent),
            }));
          return {
            id: w.id,
            brandId: w.brand_id ?? '',
            brandName: product.brandName,
            productId: w.product_id,
            productTitle: product.title,
            productPrice: product.priceInr,
            hasImageBounty: w.has_image_bounty,
            imageBountyAmount: Math.round(Number(w.image_bounty_amount)),
            startTime: new Date(w.start_time).getTime(),
            durationMs: Math.max(0, new Date(w.end_time).getTime() - new Date(w.start_time).getTime()),
            tiers,
            orderIds: [],
            currentUnits: Number(w.current_units ?? 0),
            status: 'active' as SyndicateWave['status'],
          };
        });
        return { ...s, syndicateWaves: mappedWaves };
      });

      pushToast('success', 'Syndicate Wave launched and saved to cloud!');
      return waveId;
    }

    async function refreshSyndicateWaves(): Promise<void> {
      try {
        const { data: dbWavesRaw, error: fetchErr } = await supabase
          .from('syndicate_waves')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (fetchErr) {
          console.error('Wave refresh error:', fetchErr);
          return;
        }

        const { data: dbTiersRaw } = await supabase
          .from('wave_tiers')
          .select('*');

        const dbWaves = (dbWavesRaw ?? []) as Array<{
          id: string;
          product_id: string;
          brand_id: string | null;
          status: string;
          start_time: string;
          end_time: string;
          has_image_bounty: boolean;
          image_bounty_amount: number;
          current_units: number;
        }>;

        const dbTiers = (dbTiersRaw ?? []) as Array<{
          wave_id: string;
          tier_number: number;
          threshold_units: number;
          bounty_percent: number;
        }>;

        setState((s) => {
          const mappedWaves: SyndicateWave[] = dbWaves.map((w) => {
            const product = s.products.find((p) => p.id === w.product_id);
            const tiers: SyndicateTier[] = dbTiers
              .filter((t) => t.wave_id === w.id)
              .sort((a, b) => a.tier_number - b.tier_number)
              .map((t) => ({
                tierNumber: t.tier_number,
                thresholdUnits: t.threshold_units,
                bountyPercent: Number(t.bounty_percent),
              }));
            const startMs = new Date(w.start_time).getTime();
            const endMs = new Date(w.end_time).getTime();
            return {
              id: w.id,
              brandId: w.brand_id ?? '',
              brandName: product?.brandName ?? '',
              productId: w.product_id,
              productTitle: product?.title ?? w.product_id,
              productPrice: product?.priceInr ?? 0,
              hasImageBounty: w.has_image_bounty,
              imageBountyAmount: Math.round(Number(w.image_bounty_amount)),
              startTime: startMs,
              durationMs: Math.max(0, endMs - startMs),
              tiers,
              orderIds: [],
              currentUnits: Number(w.current_units ?? 0),
              status: (w.status === 'active' ? 'active' : w.status === 'completed' ? 'completed' : 'expired') as SyndicateWave['status'],
            };
          });
          return { ...s, syndicateWaves: mappedWaves };
        });
      } catch (e) {
        console.error('refreshSyndicateWaves fatal error:', e);
      }
    }

    async function refreshDbOrders(): Promise<void> {
      try {
        const [ordersRes, disputesRes] = await Promise.all([
          supabase.from('orders').select('*').order('created_at', { ascending: false }),
          supabase.from('disputes').select('*'),
        ]);
        if (ordersRes.error) {
          console.error('Order refresh error:', ordersRes.error);
          return;
        }
        const dbOrdersData = (ordersRes.data ?? []) as Record<string, unknown>[];
        const disputesData = (disputesRes.data ?? []) as Record<string, unknown>[];
        const newDbOrders = dbOrdersData.map(normalizeDbOrder);
        const disputes = disputesData.map(normalizeDbDispute);
        const disputeByOrderId = new Map<string, DisputeRow>();
        for (const d of disputes) disputeByOrderId.set(d.order_id, d);
        setState((s) => {
          const derivedOrders = newDbOrders.map((db) => dbOrderToOrder(db, s.products, disputeByOrderId.get(db.id)));
          const mergedOrders = derivedOrders.length > 0 ? mergeDisputesIntoOrders(derivedOrders, disputes) : s.orders;
          return { ...s, dbOrders: newDbOrders, orders: mergedOrders, disputes };
        });
        // Also refresh daily_analytics so the Live Analytics tab stays in sync.
        const { data: daData, error: daErr } = await supabase
          .from('daily_analytics')
          .select('*')
          .order('analytics_date', { ascending: true });
        if (!daErr && daData) {
          setState((s) => ({ ...s, dailyAnalytics: (daData as Record<string, unknown>[]).map(normalizeDbDailyAnalytics) }));
        }
      } catch (e) {
        console.error('refreshDbOrders fatal error:', e);
      }
    }

    async function refreshDailyAnalytics(): Promise<void> {
      try {
        const { data, error } = await supabase
          .from('daily_analytics')
          .select('*')
          .order('analytics_date', { ascending: true });
        if (error) {
          console.error('daily_analytics refresh error:', error);
          return;
        }
        const daData = (data ?? []) as Record<string, unknown>[];
        setState((s) => ({ ...s, dailyAnalytics: daData.map(normalizeDbDailyAnalytics) }));
      } catch (e) {
        console.error('refreshDailyAnalytics fatal error:', e);
      }
    }

    // Full parallel refetch of every wallet/escrow source of truth. Called after
    // every order/dispute/token write so all wallet buckets reflect the DB immediately.
    async function refreshAllMarketData(): Promise<void> {
      try {
        const buyerKey = resolveBuyerKey(state.authUser?.email, state.authUser?.id);
        const [ordersRes, disputesRes, tokensRes, txnsRes, settingsRes] = await Promise.all([
          supabase.from('orders').select('*').order('created_at', { ascending: false }),
          supabase.from('disputes').select('*').order('created_at', { ascending: false }),
          supabase.from('brand_tokens').select('*').or(
            buyerKey && buyerKey !== 'default_buyer'
              ? `consumer_email.eq.${buyerKey},user_id.eq.${buyerKey}`
              : 'consumer_email.eq.default_buyer,user_id.eq.default_buyer',
          ).order('updated_at', { ascending: false }),
          supabase.from('wallet_transactions').select('*').order('created_at', { ascending: false }),
          supabase.from('brand_token_settings').select('*'),
        ]);
        if (ordersRes.error) console.error('refreshAllMarketData orders error:', ordersRes.error.message);
        if (disputesRes.error) console.error('refreshAllMarketData disputes error:', disputesRes.error.message);
        if (tokensRes.error) console.error('refreshAllMarketData brand_tokens error:', tokensRes.error.message);
        if (txnsRes.error) console.error('refreshAllMarketData wallet_transactions error:', txnsRes.error.message);
        if (settingsRes.error) console.error('refreshAllMarketData settings error:', settingsRes.error.message);

        setState((s) => {
          const dbOrdersData = (ordersRes.data ?? []) as Record<string, unknown>[];
          const dbOrders = dbOrdersData.length > 0 ? dbOrdersData.map(normalizeDbOrder) : s.dbOrders;
          const disputesData = (disputesRes.data ?? []) as Record<string, unknown>[];
          const disputes = disputesData.length > 0 ? disputesData.map(normalizeDbDispute) : s.disputes;
          const disputeByOrderId = new Map<string, DisputeRow>();
          for (const d of disputes) disputeByOrderId.set(String(d.order_id), d);
          const derivedOrders = dbOrders.length > 0
            ? mergeDisputesIntoOrders(dbOrders.map((db) => dbOrderToOrder(db, s.products, disputeByOrderId.get(String(db.id)))), disputes)
            : s.orders;
          return {
            ...s,
            dbOrders,
            orders: derivedOrders,
            disputes,
            brandTokens: (tokensRes.data ?? []).map((r) => normalizeDbBrandToken(r as Record<string, unknown>)),
            walletTxns: (txnsRes.data ?? []).map((r) => normalizeDbWalletTxn(r as Record<string, unknown>)),
            brandTokenSettings: normalizeTokenSettings(settingsRes.data),
          };
        });
      } catch (e) {
        console.error('refreshAllMarketData fatal error:', e);
      }
    }

    async function refreshBrandTokensAndWalletTxns(): Promise<void> {
      try {
        const [tokensRes, txnsRes, settingsRes] = await Promise.all([
          supabase.from('brand_tokens').select('*').order('updated_at', { ascending: false }),
          supabase.from('wallet_transactions').select('*').order('created_at', { ascending: false }),
          supabase.from('brand_token_settings').select('*'),
        ]);
        if (tokensRes.error) console.error('brand_tokens fetch error:', tokensRes.error);
        if (txnsRes.error) console.error('wallet_transactions fetch error:', txnsRes.error);
        if (settingsRes.error) console.error('brand_token_settings fetch error:', settingsRes.error);
        setState((s) => ({
          ...s,
          brandTokens: (tokensRes.data ?? []).map((r) => normalizeDbBrandToken(r as Record<string, unknown>)),
          walletTxns: (txnsRes.data ?? []).map((r) => normalizeDbWalletTxn(r as Record<string, unknown>)),
          brandTokenSettings: normalizeTokenSettings(settingsRes.data),
        }));
      } catch (e) {
        console.error('refreshBrandTokensAndWalletTxns fatal error:', e);
      }
    }

    async function boostBrandToken(brandName: string, principalAmount: number): Promise<void> {
      try {
        const email = state.session.email;
        if (!email) return;
        const existing = state.brandTokens.find(
          (t) => t.brandName.toUpperCase() === brandName.toUpperCase(),
        );
        const principal = Math.round(principalAmount);
        const bonus = Math.round(principal * 0.25);
        const mintedCredit = principal + bonus;
        const nowIso = new Date().toISOString();

        const { error: upsertError } = await supabase.from('brand_tokens').upsert({
          consumer_email: email,
          brand_name: brandName,
          principal_boosted: (existing?.principalBoosted ?? 0) + principal,
          bonus_earned: (existing?.bonusEarned ?? 0) + bonus,
          total_credit_minted: (existing?.totalCreditMinted ?? 0) + mintedCredit,
          credit_spent: existing?.creditSpent ?? 0,
          available_credit: (existing?.availableCredit ?? 0) + mintedCredit,
          updated_at: nowIso,
        }, { onConflict: 'consumer_email,brand_name' });

        if (upsertError) {
          pushToast('error', `Boost failed: ${upsertError.message}`);
          return;
        }

        await supabase.from('wallet_transactions').insert({
          consumer_email: email,
          tx_type: 'brand_boost',
          brand_name: brandName,
          cash_amount: principal,
          bonus_amount: bonus,
          credit_amount: mintedCredit,
        });

        await refreshBrandTokensAndWalletTxns();
        pushToast('success', `₹${mintedCredit.toLocaleString('en-IN')} ${brandName} Store Credit added! (+25% Bonus)`);
      } catch (e) {
        console.error('boostBrandToken error:', e);
        pushToast('error', 'Boost failed. Please try again.');
      }
    }

    async function processUpiWithdrawal(upiId: string, amount: number): Promise<void> {
      try {
        const email = state.session.email;
        if (!email) return;
        const { error } = await supabase.from('wallet_transactions').insert({
          consumer_email: email,
          tx_type: 'upi_withdrawal',
          upi_id: upiId,
          cash_amount: Math.round(amount),
        });
        if (error) {
          pushToast('error', `Withdrawal failed: ${error.message}`);
          return;
        }
        await refreshBrandTokensAndWalletTxns();
      } catch (e) {
        console.error('processUpiWithdrawal error:', e);
        pushToast('error', 'Withdrawal failed. Please try again.');
      }
    }

    async function spendBrandToken(brandName: string, creditAmount: number, orderId: string): Promise<void> {
      try {
        if (creditAmount <= 0) return;
        const buyerKey = resolveBuyerKey(state.authUser?.email, state.authUser?.id);
        if (!buyerKey || buyerKey === 'default_buyer') return;
        const normalized = normalizeBrand(brandName);
        const { data: matchingRows, error: fetchError } = await supabase.from('brand_tokens').select('*')
          .or(`consumer_email.eq.${buyerKey},user_id.eq.${buyerKey}`)
          .eq('brand_name', normalized);
        if (fetchError) {
          pushToast('error', `Store credit lookup failed: ${fetchError.message}`);
          return;
        }
        const candidateRows = (matchingRows ?? []).filter((row) => Number(row.available_credit || 0) > 0);
        if (candidateRows.length === 0) {
          pushToast('error', `No ${normalized} store credit row found for this account — deduction skipped.`);
          return;
        }
        const nowIso = new Date().toISOString();
        let remainingToDeduct = creditAmount;
        for (const row of candidateRows) {
          if (remainingToDeduct <= 0) break;
          const { data: liveRes, error: liveErr } = await supabase.from('brand_tokens')
            .select('*').eq('id', row.id).single();
          if (liveErr || !liveRes) {
            pushToast('error', `Store credit row ${row.id} could not be loaded: ${liveErr?.message ?? 'not found'}`);
            return;
          }
          const deductHere = Math.min(Number(liveRes.available_credit || 0), remainingToDeduct);
          if (deductHere <= 0) continue;
          const newCredit = Math.max(0, Number(liveRes.available_credit || 0) - deductHere);
          const { data: updatedRows, error: updateError } = await supabase.from('brand_tokens')
            .update({
              credit_spent: Number(liveRes.credit_spent || 0) + deductHere,
              available_credit: newCredit,
              updated_at: nowIso,
            })
            .eq('id', liveRes.id)
            .select();
          if (updateError || !updatedRows || updatedRows.length === 0) {
            pushToast('error', `Store credit deduction failed${updateError ? `: ${updateError.message}` : ' — row not updated'}`);
            return;
          }
          remainingToDeduct -= deductHere;
        }
        if (remainingToDeduct > 0) {
          pushToast('error', `Store credit deduction incomplete: ₹${remainingToDeduct.toLocaleString('en-IN')} could not be deducted.`);
          return;
        }

        const { error: txError } = await supabase.from('wallet_transactions').insert({
          consumer_email: buyerKey,
          user_id: buyerKey,
          tx_type: 'token_redeem',
          brand_name: normalized,
          credit_amount: Math.round(creditAmount),
          order_id: orderId,
        });
        if (txError) {
          pushToast('error', `Wallet ledger error: ${txError.message}`);
        }

        await refreshAllMarketData();
      } catch (e) {
        console.error('spendBrandToken error:', e);
        pushToast('error', 'Store credit deduction failed unexpectedly.');
      }
    }

    async function toggleBrandTokens(brandName: string, enabled: boolean): Promise<void> {
      const normalized = normalizeBrand(brandName);
      setState((s) => ({
        ...s,
        brandTokenSettings: {
          ...s.brandTokenSettings,
          [normalized]: {
            tokens_enabled: enabled,
            max_redemption_pct: s.brandTokenSettings[normalized]?.max_redemption_pct ?? 100,
          },
        },
      }));
      const { error } = await supabase.from('brand_token_settings').upsert({
        brand_name: normalized,
        tokens_enabled: enabled,
        max_redemption_pct: 100,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'brand_name' });
      if (error) {
        pushToast('error', `Failed to save token program setting: ${error.message}`);
        void refreshBrandTokensAndWalletTxns();
        return;
      }
      pushToast('success', enabled
        ? 'Token Boost Program active — buyers can convert bounties into 1.25x store credit.'
        : 'Token Boost Program paused — existing buyer credit remains redeemable.');
    }

    async function convertBountyToBrandToken(brandName: string, principalAmount: number): Promise<void> {
      try {
        const buyerKey = resolveBuyerKey(state.authUser?.email, state.authUser?.id);
        if (!buyerKey || buyerKey === 'default_buyer') {
          pushToast('error', 'Sign in to convert bounties into store credit.');
          return;
        }
        const settingsEnabled = state.brandTokenSettings[normalizeBrand(brandName)]?.tokens_enabled ?? true;
        if (!settingsEnabled) {
          pushToast('error', 'New conversions are paused by this brand.');
          return;
        }
        const principal = Math.max(0, Math.round(Number(principalAmount) || 0));
        if (principal <= 0) return;
        const mintedCredit = Math.round(principal * 1.25);
        const normalized = normalizeBrand(brandName);
        const existing = state.brandTokens.find((t) => normalizeBrand(t.brandName) === normalized);
        const { error: upsertError } = await supabase.from('brand_tokens').upsert({
          consumer_email: buyerKey,
          brand_name: normalized,
          principal_boosted: (existing?.principalBoosted ?? 0) + principal,
          bonus_earned: (existing?.bonusEarned ?? 0) + (mintedCredit - principal),
          total_credit_minted: (existing?.totalCreditMinted ?? 0) + mintedCredit,
          credit_spent: existing?.creditSpent ?? 0,
          available_credit: (existing?.availableCredit ?? 0) + mintedCredit,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'consumer_email,brand_name' });

        if (upsertError) {
          pushToast('error', `Boost failed: ${upsertError.message}`);
          return;
        }

        const { error: txError } = await supabase.from('wallet_transactions').insert({
          consumer_email: buyerKey,
          tx_type: 'token_boost',
          brand_name: normalized,
          cash_amount: principal,
          bonus_amount: mintedCredit - principal,
          credit_amount: mintedCredit,
        });
        if (txError) {
          console.error('token_boost ledger error:', txError);
        }

        await refreshBrandTokensAndWalletTxns();
        pushToast('success', `₹${principal.toLocaleString('en-IN')} bounty boosted to ₹${mintedCredit.toLocaleString('en-IN')} ${normalized} store credit (+25%).`);
      } catch (e) {
        console.error('convertBountyToBrandToken error:', e);
        pushToast('error', 'Boost failed. Please try again.');
      }
    }

    async function redeemBrandTokens(brandName: string, amountUsed: number): Promise<void> {
      try {
        const buyerKey = resolveBuyerKey(state.authUser?.email, state.authUser?.id);
        if (!buyerKey || buyerKey === 'default_buyer' || amountUsed <= 0) return;
        const normalized = normalizeBrand(brandName);
        const existing = state.brandTokens.find((t) => normalizeBrand(t.brandName) === normalized);
        const newAvailable = Math.max(0, (existing?.availableCredit ?? 0) - amountUsed);
        const { error: updateError } = await supabase.from('brand_tokens').update({
          credit_spent: (existing?.creditSpent ?? 0) + amountUsed,
          available_credit: newAvailable,
          updated_at: new Date().toISOString(),
        }).or(`consumer_email.eq.${buyerKey},user_id.eq.${buyerKey}`).eq('brand_name', normalized);

        if (updateError) {
          console.error('Token redeem error:', updateError);
          return;
        }

        await supabase.from('wallet_transactions').insert({
          consumer_email: buyerKey,
          tx_type: 'token_redeem',
          brand_name: normalized,
          credit_amount: Math.round(amountUsed),
        });

        await refreshAllMarketData();
      } catch (e) {
        console.error('redeemBrandTokens error:', e);
      }
    }
  }, [state]);

  useEffect(() => {
    const syncSyndicateWaves = async () => {
      try {
        const { data: dbWavesRaw, error: fetchErr } = await supabase
          .from('syndicate_waves')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (fetchErr) {
          console.error('Wave fetch error:', fetchErr);
          return;
        }

        const { data: dbTiersRaw } = await supabase
          .from('wave_tiers')
          .select('*');

        const dbWaves = (dbWavesRaw ?? []) as Array<{
          id: string;
          product_id: string;
          brand_id: string | null;
          status: string;
          start_time: string;
          end_time: string;
          has_image_bounty: boolean;
          image_bounty_amount: number;
          current_units: number;
        }>;

        const dbTiers = (dbTiersRaw ?? []) as Array<{
          wave_id: string;
          tier_number: number;
          threshold_units: number;
          bounty_percent: number;
        }>;

        setState((s) => {
          const mappedWaves: SyndicateWave[] = dbWaves.map((w) => {
            const product = s.products.find((p) => p.id === w.product_id);
            const tiers: SyndicateTier[] = dbTiers
              .filter((t) => t.wave_id === w.id)
              .sort((a, b) => a.tier_number - b.tier_number)
              .map((t) => ({
                tierNumber: t.tier_number,
                thresholdUnits: t.threshold_units,
                bountyPercent: Number(t.bounty_percent),
              }));
            const startMs = new Date(w.start_time).getTime();
            const endMs = new Date(w.end_time).getTime();
            return {
              id: w.id,
              brandId: w.brand_id ?? '',
              brandName: product?.brandName ?? '',
              productId: w.product_id,
              productTitle: product?.title ?? w.product_id,
              productPrice: product?.priceInr ?? 0,
              hasImageBounty: w.has_image_bounty,
              imageBountyAmount: Math.round(Number(w.image_bounty_amount)),
              startTime: startMs,
              durationMs: Math.max(0, endMs - startMs),
              tiers,
              orderIds: [],
              currentUnits: Number(w.current_units ?? 0),
              status: (w.status === 'active' ? 'active' : w.status === 'completed' ? 'completed' : 'expired') as SyndicateWave['status'],
            };
          });
          return { ...s, syndicateWaves: mappedWaves };
        });
      } catch (e) {
        console.error('syncSyndicateWaves fatal error:', e);
      }
    };
    syncSyndicateWaves();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const checkWaveExpirations = () => {
      setState((s) => {
        const now = Date.now();
        const expiredWaves = s.syndicateWaves.filter(
          (w) => w.status === 'active' && now >= w.startTime + w.durationMs,
        );
        if (expiredWaves.length === 0) return s;
        return {
          ...s,
          syndicateWaves: s.syndicateWaves.map((w) =>
            w.status === 'active' && now >= w.startTime + w.durationMs
              ? { ...w, status: 'completed' as const }
              : w,
          ),
        };
      });
    };
    checkWaveExpirations();
    const id = window.setInterval(checkWaveExpirations, 10_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setState((s) => {
        const now = Date.now();
        let newPlatformRevenue = s.platformRevenue;
        let newBrandWalletBalance = s.brandWalletBalance;
        let lockedEscrow = s.consumerWallet.lockedEscrow;
        let withdrawable = s.consumerWallet.withdrawable;
        const newTxs: WalletTransaction[] = [];

        const updatedOrders = s.orders.map((o) => {
          if (!o.deliveredAt) return o;
          let updated = o;

          const disputeWindowPassed = o.disputeExpiresAt ? now > o.disputeExpiresAt : false;
          const reviewWindowPassed = o.reviewExpiresAt ? now > o.reviewExpiresAt : false;

          if (disputeWindowPassed && !updated.brandPayoutReleased && !updated.disputeFrozen && updated.escrowStatus !== 'disputed') {
            const imageBountyForDeduction = updated.hasImageBounty ? (updated.imageReviewBounty ?? 0) : 0;
            const payout = updated.brandNetPayout ?? Math.max(0, updated.priceInr - updated.bountyAmount - imageBountyForDeduction - (updated.platformFee ?? 0));
            const fee = updated.platformFee ?? Math.round(updated.priceInr * 0.05);
            newBrandWalletBalance += payout;
            newPlatformRevenue += fee;
            updated = { ...updated, brandPayoutReleased: true, escrowStatus: 'released' as EscrowStatus };
            newTxs.push({
              id: makeId(),
              type: 'ESCROW_RELEASE',
              amount: payout,
              description: `Escrow released to brand for ${updated.productTitle}`,
              timestamp: now,
              orderId: updated.id,
              wallet: 'brand',
              direction: 'credit',
              category: 'credit',
              runningBalance: newBrandWalletBalance,
            });
            newTxs.push({
              id: makeId(),
              type: 'BOUNTY_ESCROW_DEDUCTION',
              amount: updated.bountyEscrow ?? updated.bountyAmount,
              description: `Cashback bounty funded for Order #${updated.id.slice(-6).toUpperCase()}`,
              timestamp: now,
              orderId: updated.id,
              wallet: 'brand',
              direction: 'debit',
              category: 'debit',
              runningBalance: newBrandWalletBalance,
            });
          }

          if (reviewWindowPassed && !updated.imageReviewBountyReleased && !updated.reviewBountyClaimed && !updated.disputeFrozen && updated.escrowStatus !== 'disputed') {
            const imageBounty = updated.imageReviewBounty ?? 0;
            if (imageBounty > 0) {
              lockedEscrow = Math.max(0, lockedEscrow - imageBounty);
              newBrandWalletBalance += imageBounty;
              newTxs.push({
                id: makeId(),
                type: 'IMAGE_REVIEW_BOUNTY_EXPIRED',
                amount: imageBounty,
                description: `Unclaimed photo review bounty refunded to brand for ${updated.productTitle}`,
                timestamp: now,
                orderId: updated.id,
                wallet: 'brand',
                direction: 'credit',
                category: 'credit',
                runningBalance: newBrandWalletBalance,
              });
            }
            updated = { ...updated, imageReviewBountyReleased: true, reviewStatus: 'expired' as ReviewStatus };
          }

          return updated;
        });

        if (newTxs.length === 0) return s;

        return {
          ...s,
          orders: updatedOrders,
          consumerWallet: { lockedEscrow, withdrawable },
          platformRevenue: newPlatformRevenue,
          brandWalletBalance: newBrandWalletBalance,
          walletTransactions: [...newTxs, ...s.walletTransactions],
        };
      });
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const runMaintenance = () => {
      supabase.rpc('run_syndicate_maintenance').then(({ error }) => {
        if (error) return;
      });
    };
    runMaintenance();
    const id = window.setInterval(runMaintenance, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketContextValue {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error('useMarket must be used within MarketProvider');
  return ctx;
}
